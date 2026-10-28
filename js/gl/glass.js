/*
 * glass.js — Liquid Glass for the web.
 *
 * A WebGL2 port of MacShell's liquidglass.frag (github.com/0-ss/MacShell, MIT).
 * The material model is preserved exactly:
 *
 *   rounded-rect SDF -> convex squircle bezel normal -> Snell refraction
 *   -> per-channel dispersion -> 24-tap golden-angle blur on LOD-selected mips
 *   -> vibrancy / tint / milky lift -> specular rim, meniscus, inner depth, shadow
 *
 * What changed, and why:
 *   - GLSL ES 3.00 instead of GLSL 440. Same math; textureLod on a mipmapped
 *     NPOT texture is legal in WebGL2.
 *   - The backdrop is a live 2D canvas instead of a ShaderEffectSource. Mipmaps
 *     are rebuilt whenever the painter marks itself dirty, which is what keeps
 *     the taps reading as one continuous surface instead of ghosted copies.
 *   - All shader geometry is in CSS pixels, so thickness, blur and radius mean
 *     the same thing on every display.
 *
 * Rendering architecture — the part that had to be right:
 *   ONE WebGL context renders every slab. Its output is then blitted into small
 *   2D "glass layers", one per scene, each living in the scene's own stacking
 *   order: world (0) < glass (1) < UI (2) < copy (3). That is the macOS model,
 *   glass sits behind the interface it carries. A single fixed overlay above
 *   the page would instead cover the very text the glass is supposed to hold,
 *   so the blit step is not an optimisation, it is the correctness fix.
 */
(function (global) {
  'use strict';

  const VERT = `#version 300 es
  precision highp float;
  layout(location = 0) in vec2 aPos;
  uniform vec4 uRect;    // x, y, w, h in device px, viewport space
  uniform vec2 uCanvas;  // viewport canvas size in device px
  void main() {
    vec2 p = uRect.xy + aPos * uRect.zw;
    vec2 clip = (p / uCanvas) * 2.0 - 1.0;
    gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  }`;

  const FRAG = `#version 300 es
  precision highp float;

  out vec4 fragColor;

  uniform sampler2D src;
  uniform float uOpacity;
  uniform float uDpr;        // device px per CSS px
  uniform float uLodBias;    // log2(backdrop sampling factor)
  uniform vec4  uRect;       // matches the vertex shader
  uniform vec2  uCanvas;     // framebuffer size in device px

  uniform vec2  itemSize;    // whole shader item, CSS px (glass + pad each side)
  uniform vec2  glassSize;   // the slab rectangle, CSS px
  uniform vec2  srcSize;     // backdrop canvas size, CSS px
  uniform vec2  srcOffset;   // item top-left inside the backdrop, CSS px
  uniform float pad;
  uniform float radius;
  uniform float bezel;
  uniform float thickness;
  uniform float dispersion;
  uniform float blurPx;
  uniform float tintMix;
  uniform float saturation;
  uniform float dark;
  uniform float debug;
  uniform float rim;
  uniform float grain;
  uniform float magnify;
  uniform float shadowAmt;
  uniform float rimTint;
  uniform float ringW;
  uniform float flatInner;
  uniform float rimOnly;   // 1 = glass is just the refracting edge; interior is clear

  const int   TAPS   = 24;
  const float GOLDEN = 2.39996323;

  vec3 backdropLod(vec2 pItem, float lod) {
    vec2 uv = (pItem + srcOffset) / srcSize;
    return textureLod(src, clamp(uv, vec2(0.0015), vec2(0.9985)), lod).rgb;
  }

  float ign(vec2 p) {
    return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
  }

  vec3 blurredDisp(vec2 pItem, vec2 disp, float disperse, float rad) {
    float R   = max(rad, 0.5) * 1.5;
    float gap = R * sqrt(3.14159265 / float(TAPS));
    float lod = clamp(log2(max(gap, 1.0)) + 0.35 + uLodBias, 0.0, 7.0);
    float rot = ign(gl_FragCoord.xy) * 6.2831853;
    vec3  acc = vec3(0.0);
    float wsum = 0.0;
    for (int i = 0; i < TAPS; ++i) {
      float fi = float(i) + 0.5;
      float r  = sqrt(fi / float(TAPS));
      float a  = fi * GOLDEN + rot;
      float w  = exp(-2.2 * r * r);
      vec2  o  = vec2(cos(a), sin(a)) * r * R;
      vec3  c;
      c.r = backdropLod(pItem + o + disp * (1.0 + disperse), lod).r;
      c.g = backdropLod(pItem + o + disp,                    lod).g;
      c.b = backdropLod(pItem + o + disp * (1.0 - disperse), lod).b;
      acc  += c * w;
      wsum += w;
    }
    return acc / wsum;
  }

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float roundBox(vec2 q, vec2 hs, float r) {
    vec2 d = abs(q) - (hs - r);
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
  }

  void main() {
    // gl_FragCoord is y-up from the framebuffer bottom; uRect is y-down from the
    // viewport top. Flip through the canvas height first, then go item-local.
    vec2 fragTopDown = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
    vec2 p = (fragTopDown - uRect.xy) / uDpr;      // y-down item space, CSS px

    vec2 hs = glassSize * 0.5;
    vec2 q  = p - vec2(pad) - hs;
    float r = min(radius, min(hs.x, hs.y));

    float sd  = roundBox(q, hs, r);
    float cov = clamp(0.5 - sd, 0.0, 1.0);

    if (debug > 0.5) {
      vec4 s = texture(src, clamp((p + srcOffset) / srcSize, vec2(0.001), vec2(0.999)));
      fragColor = (s.a < 0.01 ? vec4(1.0, 0.0, 1.0, 1.0) : vec4(s.rgb / max(s.a, 1e-3), 1.0)) * cov * uOpacity;
      return;
    }

    // soft drop shadow, only outside the glass
    float sds    = roundBox(q - vec2(0.0, 3.0), hs, r);
    float shadow = 0.30 * shadowAmt * (1.0 - smoothstep(-2.0, 9.0, sds));
    if (sd > 1.0) {
      fragColor = vec4(0.0, 0.0, 0.0, shadow) * uOpacity;
      return;
    }

    // distance to edge + outward edge direction
    float t = max(-sd, 0.0);
    vec2 d2 = abs(q) - (hs - r);
    vec2 sg = vec2(q.x >= 0.0 ? 1.0 : -1.0, q.y >= 0.0 ? 1.0 : -1.0);
    vec2 m  = max(d2, 0.0);
    vec2 g  = (length(m) > 1e-4) ? normalize(m) * sg
                                 : ((d2.x > d2.y) ? vec2(sg.x, 0.0) : vec2(0.0, sg.y));

    // convex squircle bezel -> surface normal
    float bz   = max(bezel, 1.0) * 1.45;
    float u    = clamp(t / bz, 0.0, 1.0);
    float om   = 1.0 - u;
    float om4  = om * om * om * om;
    float slope = (om * om * om) / pow(max(1.0 - om4, 1e-3), 0.75);
    slope = min(slope, 7.0);
    vec3 n = normalize(vec3(g * slope, 1.0));

    // refraction: glass n~1.5, ray enters straight down
    vec3 rd   = refract(vec3(0.0, 0.0, -1.0), n, 1.0 / 1.5);
    vec2 disp = rd.xy / max(-rd.z, 0.2) * thickness * 1.35;

    vec2 ps = vec2(p.x, (p.y - pad - hs.y) * (1.0 - magnify * 1.5) + pad + hs.y);
    float rad = blurPx * mix(0.45, 1.0, smoothstep(0.0, bz, t));

    vec3 col = blurredDisp(ps, disp, dispersion * 0.6, rad);

    // colour grading: vibrancy, tint, milky lift
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l), col, saturation);
    vec3 tintC = mix(vec3(1.0), vec3(0.09, 0.09, 0.10), dark);
    col = mix(col, tintC, tintMix);
    col += mix(0.055, 0.020, dark);

    // depth: soft top sheen, darker lower inner edge
    float ty = clamp((q.y + hs.y) / glassSize.y, 0.0, 1.0);
    col += (1.0 - ty) * mix(0.040, 0.030, dark);
    float innerK = 1.0 - clamp(flatInner, 0.0, 1.0);
    col *= 1.0 - 0.12 * exp(-t / 6.0) * clamp(g.y, 0.0, 1.0) * innerK;
    col *= 1.0 - 0.10 * exp(-t / (bz * 0.45)) * innerK;

    vec3 rimCol = mix(vec3(0.96, 0.98, 1.0), clamp(col * 1.5 + 0.12, 0.0, 1.0), rimTint);

    // specular rim, light from the top-left
    vec2  L      = normalize(vec2(-0.55, -0.83));
    float facing = dot(g, L);
    float spec   = pow(max(facing, 0.0), 1.6) + 0.55 * pow(max(-facing, 0.0), 2.2);
    float hair   = exp(-t / 1.1);
    float wide   = exp(-t / 5.0);
    float edgeHi = hair * (0.18 + 0.78 * spec) + wide * 0.10 * (0.30 + spec);
    edgeHi *= rim * mix(0.85, 1.0, dark);
    col += edgeHi * rimCol;

    // meniscus: surface tension pulling the liquid together
    float mx  = (t - bz * 0.5) / (bz * 0.2 + 1.0);
    float men = exp(-mx * mx);
    col += men * 0.07 * (0.35 + spec) * rim * rimCol;

    if (ringW > 0.0) {
      float ring = 1.0 - smoothstep(ringW * 0.5, ringW * 0.5 + 1.0, t);
      col = mix(col, rimCol, ring * (0.55 + 0.35 * clamp(facing * 0.5 + 0.5, 0.0, 1.0)));
    }

    if (ringW < 0.0) {
      float rw   = -ringW;
      float ring = 1.0 - smoothstep(rw * 0.5, rw * 0.5 + 1.0, t);
      float glow = exp(-t / (rw * 2.2)) * 0.30;
      float fall = max(r * 3.0, 26.0);
      float wTR  = pow(clamp(1.0 - length(q - vec2( hs.x, -hs.y)) / fall, 0.0, 1.0), 1.2);
      float wBL  = pow(clamp(1.0 - length(q - vec2(-hs.x,  hs.y)) / fall, 0.0, 1.0), 1.2);
      float cw   = 1.0 - max(wTR, wBL);
      vec3  ringCol = clamp(col * 2.0 + 0.18, 0.0, 1.0);
      col = mix(col, ringCol, clamp((ring + glow) * cw, 0.0, 1.0) * 0.95);
    }

    float gn = hash12(gl_FragCoord.xy) + hash12(gl_FragCoord.xy * 1.7 + 17.0) - 1.0;
    col += gn * grain;

    col = clamp(col, 0.0, 1.0);

    float a = cov + shadow * (1.0 - cov);

    /*
     * Rim-only mode.
     *
     * A pane you look *through* behaves like an edge, not a fill: light is bent
     * and coloured where the surface turns away, and the middle stays clear.
     * Filling the whole card washed the illustration out — that was the bug.
     *
     * Here the interior alpha fades to nothing, but the rim keeps its full
     * coverage, so the refractive arête survives and the drawing stays readable.
     */
    if (rimOnly > 0.5) {
      float rimZone = max(bz * 1.4, 14.0);
      float interior = smoothstep(0.0, rimZone, t);   // 0 at edge, 1 inside
      a = cov * (1.0 - interior * 0.97);              // interior ~3% see-through-fill
    }

    fragColor = vec4(col * a, a) * uOpacity;   // premultiplied alpha
  }`;

  const UNIFORMS = [
    'src', 'uOpacity', 'uDpr', 'uLodBias', 'uRect', 'uCanvas',
    'itemSize', 'glassSize', 'srcSize', 'srcOffset',
    'pad', 'radius', 'bezel', 'thickness', 'dispersion', 'blurPx', 'tintMix',
    'saturation', 'dark', 'debug', 'rim', 'grain', 'magnify', 'shadowAmt',
    'rimTint', 'ringW', 'flatInner', 'rimOnly',
  ];

  const DEFAULTS = {
    pad: 24,
    radius: 22,
    bezel: 22,
    thickness: 22,
    dispersion: 0.05,
    blur: 1.8,
    tint: 0.34,
    saturation: 1.25,
    dark: 1,
    rim: 0.9,
    grain: 0.010,
    magnify: 0.05,
    shadow: 0.5,
    rimTint: 0,
    ring: 0,
    flatInner: 0,
    rimOnly: 0,
    opacity: 1,
  };

  function compile(gl, type, source) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('[glass] shader compile failed:\n' + gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function buildProgram(gl) {
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('[glass] link failed:\n' + gl.getProgramInfoLog(p));
      return null;
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return p;
  }

  /* ── a rendered piece of glass ────────────────────────────────────────── */
  class Slab {
    constructor(stage, el, options) {
      this.stage = stage;
      this.el = el;
      this.o = Object.assign({}, DEFAULTS, options || {});
    }
    set(patch) { Object.assign(this.o, patch); return this; }
  }

  /* ── a backdrop world + the slabs painted from it ─────────────────────── */
  class Stage {
    constructor(world, element, options) {
      this.world = world;
      this.element = element;
      this.mode = (options && options.mode) || 'dark';
      this.slabs = [];
      this.layers = [];
      this.texture = null;
      this.visible = true;
      this._dirty = true;
    }
    add(el, options) {
      const slab = new Slab(this, el, options);
      this.slabs.push(slab);
      return slab;
    }
    rect() { return this.element.getBoundingClientRect(); }
  }

  /* ── a 2D layer that receives the rendered glass for one scene ────────── */
  class GlassLayer {
    constructor(manager, host, options) {
      const opts = options || {};
      this.manager = manager;
      this.host = host;
      this.stage = opts.stage || null;
      this.fixed = !!opts.fixed;
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'glass-layer' + (this.fixed ? ' glass-layer--fixed' : '');
      this.canvas.setAttribute('aria-hidden', 'true');
      this.ctx = this.canvas.getContext('2d', { alpha: true });
      this.size = { w: 0, h: 0 };
      this.visible = true;
      host.appendChild(this.canvas);

      if (this.fixed) {
        Object.assign(this.canvas.style, {
          position: 'fixed',
          left: '0',
          top: opts.top || '0',
          width: '100%',
          height: (opts.height || 0) + 'px',
        });
      } else {
        Object.assign(this.canvas.style, {
          position: 'absolute',
          inset: '0',
          width: '100%',
          height: '100%',
        });
      }
      this.resize();
    }

    resize() {
      const dpr = this.manager.dpr || 1;
      const r = this.canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      this.size = { w: r.width, h: r.height };
      this.rect = r;
    }

    rectNow() { return this.canvas.getBoundingClientRect(); }
    markDirty() { this._dirty = true; }
  }

  /* ── the single WebGL context and its blit fan-out ────────────────────── */
  class GlassManager {
    constructor() {
      this.stages = [];
      this.layers = [];
      this.ready = false;
      this.frame = 0;
      this.maxFps = 60;
      this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      this._build();
    }

    _build() {
      // The GL surface is never in the DOM. Its pixels are blitted into layers.
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
      if (!gl) {
        document.documentElement.classList.add('no-webgl');
        return;
      }
      this.glCanvas = canvas;
      this.gl = gl;
      this.prog = buildProgram(gl);
      if (!this.prog) {
        document.documentElement.classList.add('no-webgl');
        return;
      }
      gl.useProgram(this.prog);
      this.loc = {};
      UNIFORMS.forEach((n) => { this.loc[n] = gl.getUniformLocation(this.prog, n); });
      gl.uniform1i(this.loc.src, 0);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

      this.ready = true;
      this.resize();
      this._start();
    }

    /* Called by a world after it painted, so the glass picks the frame up. */
    markWorldDirty(stage) {
      if (stage) stage._dirty = true;
      if (this._schedule) this._schedule();
    }

    resize() {
      if (!this.ready) return;
      this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(window.innerWidth * this.dpr));
      const h = Math.max(1, Math.round(window.innerHeight * this.dpr));
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
        this.glCanvas.width = w;
        this.glCanvas.height = h;
      }
      this.gl.viewport(0, 0, w, h);
      this.layers.forEach((l) => l.resize());
      this.stages.forEach((s) => { s._dirty = true; });
      this._force = true;
      if (this.requestFrame) this.requestFrame();
    }

    _start() {
      this._onResize = () => this.resize();
      window.addEventListener('resize', this._onResize, { passive: true });

      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          const stage = this.stages.find((s) => s.world && s.world.canvas === e.target);
          if (stage) stage.visible = e.isIntersecting;
        });
      }, { rootMargin: '200px 0px' });
      this._io = io;

      /*
       * The overlay is event driven, not free running.
       *
       * A rAF loop that renders every frame is what made scrolling stutter: ten
       * backdrop canvases and ten texture uploads per frame compete with the
       * compositor for the main thread. Instead the manager idles until
       * something actually asks for a frame — a scroll, a resize, a world that
       * painted. At rest the page costs nothing.
       */
      this._schedule = () => {
        if (this._pending || document.hidden) return;
        this._pending = true;
        this._raf = requestAnimationFrame(() => {
          this._pending = false;
          this.render();
        });
      };
      this.requestFrame = this._schedule;

      /*
       * While scrolling, the only glass that must be re-rendered is the sticky
       * nav: its layer is fixed to the viewport while the world behind it moves.
       * Every other layer scrolls with the page, so its pixels are still exactly
       * right and re-blitting them would be pure cost — a drawImage out of a
       * WebGL canvas forces a GPU sync per layer. Scroll therefore paints the
       * nav and nothing else.
       */
      /*
       * Scrolling cheap: nothing at all.
       *
       * Every non-sticky layer is positioned inside its tile and scrolls with the
       * page, so its already-rendered pixels remain pixel-correct without a
       * single GPU operation. The sticky nav is the one exception, and because a
       * drawImage out of a WebGL canvas forces a CPU sync, even the nav is only
       * refreshed once the scroll has settled — never during the flick.
       */
      this._onScroll = () => { this._needsNavRefresh = true; };
      window.addEventListener('scroll', this._onScroll, { passive: true });
    }

    addStage(world, element, options) {
      const stage = new Stage(world, element, options);
      if (options && options.sticky) stage.sticky = true;
      stage.texture = this._makeTexture();
      this.stages.push(stage);
      if (this._io && world && world.canvas) this._io.observe(world.canvas);
      return stage;
    }

    addLayer(host, options) {
      const layer = new GlassLayer(this, host, options);
      this.layers.push(layer);
      if (layer.stage) layer.stage.layers.push(layer);
      return layer;
    }

    /* Copy one stage's glass from the GL surface into its own 2D layers. */
    _blitStage(stage) {
      const dpr = this.dpr;
      const fbW = this.glCanvas.width;
      const fbH = this.glCanvas.height;
      const vh = window.innerHeight;
      for (const layer of stage.layers) {
        if (!layer.canvas.isConnected) continue;
        const lr = layer.canvas.getBoundingClientRect();
        if (lr.width < 1 || lr.height < 1) continue;
        // Off screen: keep the last pixels. They are already correct in page
        // space, so clearing here is what used to make glass pop on scroll.
        if (lr.bottom < 0 || lr.top > vh) continue;

        const sx = Math.round(lr.left * dpr);
        const sy = Math.round(lr.top * dpr);
        const sw = Math.round(lr.width * dpr);
        const sh = Math.round(lr.height * dpr);
        if (sw < 1 || sh < 1) continue;

        const x0 = Math.max(0, sx);
        const y0 = Math.max(0, sy);
        const x1 = Math.min(fbW, sx + sw);
        const y1 = Math.min(fbH, sy + sh);
        if (x1 <= x0 || y1 <= y0) continue;

        const dx = ((x0 - sx) / sw) * layer.canvas.width;
        const dy = ((y0 - sy) / sh) * layer.canvas.height;
        const dw = ((x1 - x0) / sw) * layer.canvas.width;
        const dh = ((y1 - y0) / sh) * layer.canvas.height;
        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        layer.ctx.drawImage(this.glCanvas, x0, y0, x1 - x0, y1 - y0, dx, dy, dw, dh);
      }
    }

    _makeTexture() {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    }

    _upload(stage) {
      const gl = this.gl;
      const world = stage.world;
      if (!world || !world.canvas) return false;
      const src = world.canvas;
      if (stage._w !== src.width || stage._h !== src.height) {
        stage._w = src.width;
        stage._h = src.height;
        stage._dirty = true;
      }
      if (!stage._dirty && !world.dirty) return false;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, stage.texture);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
        gl.generateMipmap(gl.TEXTURE_2D);
      } catch (err) {
        console.warn('[glass] upload failed', err);
        return false;
      }
      world.dirty = false;
      stage._dirty = false;
      return true;
    }

    /*
     * Render one stage at a time.
     *
     * The GL surface is full viewport, but every stage's draw is scissored to
     * that stage's own box before its layers are blitted. That is what kills
     * the cross-talk: the nav's glass, a neighbouring tile's glass, or a tile
     * that has scrolled under the nav can no longer bleed into another tile,
     * because those pixels simply are not inside the scissors at blit time.
     */
    render() {
      if (!this.ready) return;
      const gl = this.gl;
      const dpr = this.dpr;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const fbW = this.glCanvas.width;
      const fbH = this.glCanvas.height;

      gl.viewport(0, 0, fbW, fbH);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.prog);
      gl.uniform2f(this.loc.uCanvas, fbW, fbH);
      gl.uniform1f(this.loc.uDpr, dpr);
      gl.enable(gl.SCISSOR_TEST);

      const onlySticky = this._scheduleSticky === true;
      this._scheduleSticky = false;

      /*
       * Upload budget.
       *
       * texImage2D + generateMipmap on a full tile backdrop is the single most
       * expensive thing this manager does. Doing it for every dirty stage in one
       * frame is what produced the ~1.4 s stall during a scroll. At most two
       * stages are refreshed per frame; the rest keep their previous texture,
       * which is still valid, and get refreshed as the budget rotates.
       */
      let uploads = 0;
      const UPLOAD_BUDGET = 2;

      let drew = 0;
      for (const stage of this.stages) {
        if (!stage.slabs.length) continue;
        if (onlySticky && !stage.sticky) continue;
        const sr = stage.rect();
        // Nothing to do if the whole stage is off screen: its layers keep their
        // last frame, which is still correct because they scroll with the page.
        if (sr.bottom < -120 || sr.top > vh + 120) continue;
        if (!stage.visible) continue;
        if (uploads < UPLOAD_BUDGET && (stage._dirty || stage.world.dirty)) {
          this._upload(stage);
          uploads++;
        } else if (!stage._uploadedOnce) {
          // first paint is worth the cost, or the tile would be see-through
          this._upload(stage);
          uploads++;
        }
        stage._uploadedOnce = true;
        // never draw a stage whose texture has never been filled
        if (!stage.texture) continue;

        // scissor to the stage box (GL scissor is y-up, window is y-down)
        const sX = Math.max(0, Math.floor(sr.left * dpr));
        const sY = Math.max(0, Math.floor(fbH - (sr.bottom * dpr)));
        const sW = Math.min(fbW - sX, Math.ceil(sr.width * dpr));
        const sH = Math.min(fbH - sY, Math.ceil(sr.height * dpr));
        if (sW <= 0 || sH <= 0) continue;
        gl.scissor(sX, sY, sW, sH);

        const world = stage.world;
        const ws = world.scale || 1;
        gl.bindTexture(gl.TEXTURE_2D, stage.texture);
        gl.uniform1f(this.loc.uLodBias, Math.log2(Math.max(ws, 0.05)));

        for (const slab of stage.slabs) {
          const el = slab.el;
          if (!el.isConnected || slab.o.visible === false) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) continue;
          if (r.bottom < -200 || r.top > vh + 200) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;

          const o = slab.o;
          const radius = parseFloat(cs.borderTopLeftRadius) || o.radius;
          const margin = world.margin || 0;
          const pad = o.pad;
          const w = r.width;
          const h = r.height;

          gl.uniform4f(this.loc.uRect, r.left * dpr, r.top * dpr, w * dpr, h * dpr);
          gl.uniform2f(this.loc.itemSize, w + 2 * pad, h + 2 * pad);
          gl.uniform2f(this.loc.glassSize, w, h);
          gl.uniform2f(this.loc.srcSize, sr.width + 2 * margin, sr.height + 2 * margin);
          gl.uniform2f(this.loc.srcOffset, r.left - sr.left + margin - pad, r.top - sr.top + margin - pad);
          gl.uniform1f(this.loc.pad, pad);
          gl.uniform1f(this.loc.radius, radius);
          gl.uniform1f(this.loc.bezel, Math.min(h * 0.36, 26));
          gl.uniform1f(this.loc.thickness, o.thickness);
          gl.uniform1f(this.loc.dispersion, o.dispersion);
          gl.uniform1f(this.loc.blurPx, Math.max(o.blur, 0.4));
          gl.uniform1f(this.loc.tintMix, o.tint);
          gl.uniform1f(this.loc.saturation, o.saturation);
          gl.uniform1f(this.loc.dark, stage.mode === 'pearl' ? 0 : o.dark);
          gl.uniform1f(this.loc.debug, 0);
          gl.uniform1f(this.loc.rim, o.rim);
          gl.uniform1f(this.loc.grain, o.grain);
          gl.uniform1f(this.loc.magnify, o.magnify);
          gl.uniform1f(this.loc.shadowAmt, o.shadow);
          gl.uniform1f(this.loc.rimTint, o.rimTint);
          gl.uniform1f(this.loc.ringW, o.ring);
          gl.uniform1f(this.loc.flatInner, o.flatInner);
          gl.uniform1f(this.loc.rimOnly, o.rimOnly);
          gl.uniform1f(this.loc.uOpacity, o.opacity);

          gl.drawArrays(gl.TRIANGLES, 0, 6);
          drew++;
        }

        gl.disable(gl.SCISSOR_TEST);
        this._blitStage(stage);
        gl.enable(gl.SCISSOR_TEST);
      }

      gl.disable(gl.SCISSOR_TEST);
      this._drew = drew;
    }

    destroy() {
      cancelAnimationFrame(this._raf);
      if (this._onResize) window.removeEventListener('resize', this._onResize);
      if (this._onScroll) window.removeEventListener('scroll', this._onScroll);
      if (this._io) this._io.disconnect();
      this.layers.forEach((l) => l.canvas.remove());
      const ext = this.gl && this.gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
  }

  global.Glass = {
    manager: null,
    init() {
      if (!this.manager) this.manager = new GlassManager();
      return this.manager;
    },
    supported() {
      try {
        const c = document.createElement('canvas');
        return !!c.getContext('webgl2');
      } catch (e) { return false; }
    },
  };
})(window);