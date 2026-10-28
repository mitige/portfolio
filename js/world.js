/*
 * world.js — the live backdrop every piece of liquid glass refracts.
 *
 * MacShell's shader samples a ShaderEffectSource that captures what is really
 * behind the glass. On the web we paint that backdrop, so the refraction has
 * real structure to bend: an aurora field of low-frequency light bodies, one
 * drifting silk sweep, a top light that matches the shader's specular vector,
 * a vignette and fine grain.
 *
 *   dark  — the Tahoe hero. Deep indigo, emerald, amber; brightest top-left.
 *   pearl — the pale Apple surface. Warm off-white with sage and blush.
 *
 * Each <canvas class="world"> is section-local and inflated by `margin` px so
 * the refraction of an edge slab still has backdrop to reach into. It paints at
 * ~0.7x CSS resolution: the shader blurs and mipmaps this anyway, so extra
 * source pixels would be wasted. `dirty` is set on every painted frame and the
 * glass overlay re-uploads only then.
 */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;

  function makeGrain(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = 128 + (Math.random() - 0.5) * 255;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  const PALETTES = {
    dark: {
      base: ['#04060c', '#070a13', '#0a0e18'],
      blobs: [
        { x: 0.20, y: 0.16, r: 0.60, color: [96, 142, 255], a: 0.42, sx: 0.10, sy: 0.06 },
        { x: 0.74, y: 0.22, r: 0.50, color: [38, 208, 186], a: 0.26, sx: 0.08, sy: 0.10 },
        { x: 0.52, y: 0.80, r: 0.56, color: [255, 156, 72], a: 0.30, sx: 0.09, sy: 0.05 },
        { x: 0.88, y: 0.70, r: 0.42, color: [228, 94, 148], a: 0.22, sx: 0.06, sy: 0.08 },
        { x: 0.10, y: 0.84, r: 0.48, color: [88, 186, 255], a: 0.16, sx: 0.11, sy: 0.05 },
      ],
      vignette: 'rgba(0,0,0,0.58)',
      grain: 0.05,
      silk: 'rgba(186,216,255,0.045)',
      topGlow: 'rgba(255,255,255,0.09)',
    },
    pearl: {
      base: ['#fcfbf8', '#f5f4f0', '#eceef3'],
      blobs: [
        { x: 0.22, y: 0.14, r: 0.62, color: [255, 194, 154], a: 0.46, sx: 0.09, sy: 0.06 },
        { x: 0.72, y: 0.20, r: 0.52, color: [172, 214, 206], a: 0.38, sx: 0.07, sy: 0.09 },
        { x: 0.58, y: 0.84, r: 0.58, color: [202, 210, 242], a: 0.40, sx: 0.08, sy: 0.05 },
        { x: 0.10, y: 0.76, r: 0.48, color: [255, 212, 188], a: 0.30, sx: 0.06, sy: 0.08 },
      ],
      vignette: 'rgba(120,110,95,0.09)',
      grain: 0.028,
      silk: 'rgba(255,255,255,0.32)',
      topGlow: 'rgba(255,255,255,0.66)',
    },
    nocturne: {
      base: ['#050407', '#08060a', '#0b0810'],
      blobs: [
        { x: 0.30, y: 0.20, r: 0.55, color: [120, 96, 220], a: 0.30, sx: 0.07, sy: 0.05 },
        { x: 0.76, y: 0.30, r: 0.46, color: [220, 120, 96], a: 0.26, sx: 0.06, sy: 0.07 },
        { x: 0.50, y: 0.86, r: 0.54, color: [64, 150, 180], a: 0.20, sx: 0.08, sy: 0.05 },
      ],
      vignette: 'rgba(0,0,0,0.66)',
      grain: 0.045,
      silk: 'rgba(255,220,190,0.035)',
      topGlow: 'rgba(255,235,215,0.07)',
    },
  };

  class World {
    constructor(canvas, options) {
      const opts = options || {};
      this.canvas = canvas;
      this.mode = opts.mode || 'dark';
      this.margin = opts.margin || 0;
      this.speed = opts.speed == null ? 1 : opts.speed;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.pointer = { x: 0, y: 0 };
      this.target = { x: 0, y: 0 };
      this.grainTile = makeGrain(96);
      this.pattern = this.ctx.createPattern(this.grainTile, 'repeat');
      this.dirty = true;
      this.scale = 1;
      this.time = 0;
      this.raf = 0;
      this.visible = true;
      this._visibleDrawn = false;
      this.paused = false;
      this.minDelta = 1000 / (opts.fps || 8);    // ambient light, not a game loop
      this._lastDraw = 0;
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      /*
       * The ink layer.
       *
       * This is the important one. The drawing cannot live above the glass as a
       * DOM node, or the shader only ever refracts the flat aurora and the glass
       * has nothing distinctive to bend. So the SVG is rasterised once into an
       * offscreen canvas, and the painter composites it *into* the backdrop.
       * The shader then samples a texture that already contains the drawing, and
       * refraction finally has hard black lines to work on — which is the whole
       * reason liquid glass over ink looks like anything at all.
       */
      this.ink = null;
      this.inkUrl = opts.ink || null;
    }

    /* Rasterise an SVG string into the backdrop at the canvas's own resolution. */
    setInk(svgMarkup) {
      if (!svgMarkup) return;
      const w = this.canvas.width || 1;
      const h = this.canvas.height || 1;
      const img = new Image();
      const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const cx = c.getContext('2d');
        // The SVG uses a 1200x760 viewBox with xMidYMid meet: reproduce that
        // fit exactly so the composition matches what was designed.
        const scale = Math.max(w / 1200, h / 760);   // slice: cover, crop overflow
        const dw = 1200 * scale;
        const dh = 760 * scale;
        cx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        this.ink = c;
        this.dirty = true;
        URL.revokeObjectURL(url);
      };
      img.onerror = () => { URL.revokeObjectURL(url); };
      img.src = url;
    }

    setMode(mode) {
      if (mode === this.mode) return;
      this.mode = mode;
      this.dirty = true;
    }

    setPointer(nx, ny) {
      this.target.x = Math.max(-1, Math.min(1, nx));
      this.target.y = Math.max(-1, Math.min(1, ny));
    }

    resize() {
      const r = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Deliberately under-sample: the glass blurs and mipmaps this anyway.
      const targetScale = Math.min(0.7 * dpr, 1.1);
      const w = Math.max(2, Math.round(r.width * targetScale));
      const h = Math.max(2, Math.round(r.height * targetScale));
      this.scale = targetScale;
      this.cssW = r.width;
      this.cssH = r.height;
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.pattern = this.ctx.createPattern(this.grainTile, 'repeat');
        if (this.inkUrl) this.setInk(this.inkUrl);
      }
      this.dirty = true;
    }

    start() {
      if (this.raf) return;
      this.resize();
      this._loop = (t) => {
        this.raf = requestAnimationFrame(this._loop);
        // A paused world paints nothing at all. That is the whole point: while
        // the page is scrolling, not one backdrop canvas is being repainted, so
        // the compositor has the main thread to itself.
        if (!this.visible || document.hidden || this.paused) return;
        if (t - this._lastDraw < this.minDelta) return;
        this._lastDraw = t;
        const dt = Math.min(0.06, (t - (this._last || t)) / 1000);
        this._last = t;
        this.time += dt * this.speed;
        const k = Math.min(1, dt * 3.0);
        this.pointer.x += (this.target.x - this.pointer.x) * k;
        this.pointer.y += (this.target.y - this.pointer.y) * k;
        this.draw();
        this.dirty = true;
      };
      this.raf = requestAnimationFrame(this._loop);

      if (!this._io) {
        this._io = new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            this.visible = e.isIntersecting;
            if (this.visible) this.dirty = true;
          });
        }, { rootMargin: '200px' });
        this._io.observe(this.canvas);
      }
      if (!this._onResize) {
        this._onResize = () => this.resize();
        window.addEventListener('resize', this._onResize, { passive: true });
        if (window.ResizeObserver) {
          this._ro = new ResizeObserver(() => this.resize());
          this._ro.observe(this.canvas);
        }
      }
    }

    stop() {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      if (this._io) { this._io.disconnect(); this._io = null; }
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
      if (this._onResize) {
        window.removeEventListener('resize', this._onResize);
        this._onResize = null;
      }
    }

    blobPos(p, t) {
      const parallax = 0.05;
      return {
        x: p.x + Math.sin(t * p.sx + p.x * 9.1) * 0.05 + this.pointer.x * parallax,
        y: p.y + Math.cos(t * p.sy + p.y * 7.3) * 0.045 + this.pointer.y * parallax,
      };
    }

    draw() {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;
      if (!w || !h) return;
      const pal = PALETTES[this.mode] || PALETTES.dark;
      const t = this.reduced ? 0 : this.time;
      const dark = this.mode !== 'pearl';

      const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
      g.addColorStop(0, pal.base[0]);
      g.addColorStop(0.55, pal.base[1]);
      g.addColorStop(1, pal.base[2]);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // aurora bodies
      ctx.globalCompositeOperation = dark ? 'lighter' : 'soft-light';
      for (const b of pal.blobs) {
        const pos = this.blobPos(b, t);
        const cx = pos.x * w;
        const cy = pos.y * h;
        const rad = b.r * Math.max(w, h);
        const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        const [r, gr, bl] = b.color;
        const a = b.a * (dark ? 0.55 : 0.9);
        rg.addColorStop(0, `rgba(${r},${gr},${bl},${a})`);
        rg.addColorStop(0.36, `rgba(${r},${gr},${bl},${a * 0.44})`);
        rg.addColorStop(0.7, `rgba(${r},${gr},${bl},${a * 0.11})`);
        rg.addColorStop(1, `rgba(${r},${gr},${bl},0)`);
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, TAU);
        ctx.fill();
      }

      // silk sweep
      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      const sweepX = (Math.sin(t * 0.05) * 0.28 + 0.54) * w;
      const sg = ctx.createLinearGradient(sweepX - w * 0.55, -h * 0.25, sweepX + w * 0.5, h * 1.1);
      sg.addColorStop(0, 'rgba(0,0,0,0)');
      sg.addColorStop(0.44, pal.silk);
      sg.addColorStop(0.56, pal.silk);
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, w, h);

      // top light keeps the shader's top-left specular believable
      ctx.globalCompositeOperation = 'source-over';
      const tg = ctx.createRadialGradient(w * 0.2, -h * 0.18, 0, w * 0.2, -h * 0.08, Math.max(w, h) * 0.92);
      tg.addColorStop(0, pal.topGlow);
      tg.addColorStop(0.6, 'rgba(255,255,255,0)');
      ctx.fillStyle = tg;
      ctx.fillRect(0, 0, w, h);

      // vignette
      const vg = ctx.createRadialGradient(w * 0.5, h * 0.44, Math.min(w, h) * 0.16, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(0.6, dark ? 'rgba(0,0,0,0.16)' : 'rgba(120,110,95,0.025)');
      vg.addColorStop(1, pal.vignette);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);

      // the drawing, composited into the same buffer the shader samples
      if (this.ink) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.drawImage(this.ink, 0, 0, w, h);
      }

      // grain: stops banding in the gradients and gives the glass something to hold
      if (this.pattern && (this._paintNo = (this._paintNo || 0) + 1) % 4 === 1) {
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = pal.grain;
        ctx.fillStyle = this.pattern;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  global.World = World;
})(window);