/*
 * app.js — the page controller.
 *
 * Boot order matters: worlds first (they are what gets refracted), then each
 * scene mounted into its tile, then a glass layer inserted between the scene's
 * world and its interface. Every [data-glass] node in the scene registers with
 * that scene's stage.
 *
 * The layer order inside a tile is the whole point:
 *   .tile__world  (0)  aurora backdrop, painted by world.js
 *   .glass-layer  (1)  the shader output — this is the material
 *   .tile__visual (2)  the macOS UI sitting on the glass
 *   .tile__copy   (3)  the headline and buttons
 * which is exactly how the MacShell desktop stacks: wallpaper, glass, apps.
 */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasWebGL = window.Glass && window.Glass.supported();

  let manager = null;

  /* Page scene names → drawing names. A scene can be reused (Judas and the
     gallery both want the training drawing) without duplicating the art. */
  const ART_FOR = {
    neuro: 'mind',
    terminal: 'editor',
    chart: 'training',
    code: 'kernel',
    torus: 'tokamak',
    device: 'journal',
    laptop: 'eye',
    lab: 'learning',
    desk: 'player',
    cc: 'training',
    watch: 'eye',
    buds: 'player',
    dock: 'editor',
    widget: 'journal',
  };

  function artName(scene) { return ART_FOR[scene] || 'mind'; }

  /*
   * The <svg> markup itself, for rasterising into the backdrop texture.
   *
   * The explicit width/height matter: an SVG loaded through an <img> with only a
   * viewBox rasterises at the browser's default 300x150 replacement size, so the
   * ink arrived at 237x150 and was then stretched over the tile — which is why it
   * looked absent. Sizing it to the viewBox makes the raster exact.
   */
  function extractSvg(markup) {
    const i = markup.indexOf('<svg');
    const j = markup.indexOf('</svg>');
    if (i < 0 || j <= i) return '';
    let tag = markup.slice(i, j + 6);
    if (!/\swidth=/.test(tag.slice(0, 200))) {
      tag = tag.replace('<svg ', '<svg width="1200" height="760" ');
    }
    return tag;
  }

  /* ── worlds ──────────────────────────────────────────────────────────── */
  function bootWorld(canvas, mode) {
    const world = new window.World(canvas, { mode: mode, margin: 0 });
    world.start();
    return world;
  }

  /*
   * The material on ink.
   *
   * MacShell's defaults are tuned for a wallpaper: soft, low contrast, forgiving.
   * Ink is the opposite — hard black lines — so the panes want more thickness
   * (longer refraction at the rim), more dispersion (the split is finally
   * visible), and a little less tint (keep the drawing readable through it).
   */
  /*
   * The one material used for every card.
   *
   * Tuned specifically for ink: more thickness than MacShell's wallpaper preset
   * (46 vs 22) because a long refraction at the rim is what makes black lines
   * visibly bend, and more dispersion because the split finally has contrast to
   * act on. Tint stays low so the drawing remains readable through the glass.
   */
  const SLAB = {
    pad: 34,
    radius: 28,
    bezel: 30,
    thickness: 44,
    dispersion: 0.085,
    blur: 1.0,
    tint: 0.20,
    saturation: 1.3,
    rim: 1.0,
    shadow: 0.85,
    magnify: 0.05,
    rimTint: 1,
    ring: -1.2,
  };

  /* Pearl needs a touch more tint to keep the contrast on pale paper. */
  const SLAB_PEARL = { tint: 0.10, rimTint: 0, ring: -0.9, thickness: 40 };

  /* ── one scene → one tile ────────────────────────────────────────────── */
  function mountScene(tile) {
    const name = tile.getAttribute('data-scene');
    const stageEl = tile.querySelector('.tile__stage');
    const mount = tile.querySelector('[data-scene-mount]');
    const canvas = tile.querySelector('canvas.world');
    if (!name || !mount || !stageEl) return;

    const mode = tile.getAttribute('data-world') || 'dark';
    const artMode = mode === 'pearl' ? 'pearl' : 'dark';
    const markup = window.Art.render(artName(name), artMode);
    mount.innerHTML = markup;

    if (!hasWebGL) {
      tile.classList.add('scene-static');
      return;
    }

    const world = bootWorld(canvas, mode);
    world.setInk(extractSvg(markup));
    // The canvas paints the drawing now; the DOM copy would double it.
    if (mount) mount.setAttribute('aria-hidden', 'true'), (mount.style.opacity = '0');
    const stage = manager.addStage(world, stageEl, { mode });
    // The layer lives in the stage box (behind everything); the UI that the
    // glass carries is the sibling .tile__visual placed after the copy.
    manager.addLayer(stageEl, { stage });
    const slab = stageEl.querySelector('[data-glass="slab"]');
    if (slab) stage.add(slab, Object.assign({}, SLAB, mode === 'pearl' ? SLAB_PEARL : {}));
    tile._world = world;
    tile._stage = stage;
  }

  /* ── gallery cards ───────────────────────────────────────────────────── */
  function mountGallery(card) {
    const name = card.getAttribute('data-gallery-scene');
    const mount = card.querySelector('[data-scene-mount]');
    const canvas = card.querySelector('canvas.world');
    if (!name || !mount) return;
    const mode = card.getAttribute('data-world') || 'dark';
    const artMode = mode === 'pearl' ? 'pearl' : 'dark';
    const markup = window.Art.render(artName(name), artMode);
    mount.innerHTML = markup;

    if (!hasWebGL) return;

    const world = bootWorld(canvas, mode);
    world.setInk(extractSvg(markup));
    const stage = manager.addStage(world, card, { mode });
    const layer = manager.addLayer(card, { stage });
    layer.canvas.style.zIndex = '1';
    card.insertBefore(layer.canvas, mount);
    const gslab = card.querySelector('[data-glass="slab"]');
    if (gslab) stage.add(gslab, Object.assign({}, SLAB, { pad: 22, thickness: 30, blur: 1.2 }));
    card._world = world;
    card._stage = stage;
  }

  /* ── the nav's own slab ──────────────────────────────────────────────── */
  function bootNav() {
    if (!hasWebGL) return;
    const nav = document.getElementById('globalnav');
    if (!nav) return;
    const navWorldCanvas = document.createElement('canvas');
    navWorldCanvas.className = 'world';
    navWorldCanvas.setAttribute('aria-hidden', 'true');
    navWorldCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    nav.insertBefore(navWorldCanvas, nav.firstChild);

    const world = bootWorld(navWorldCanvas, 'dark');
    world.margin = 0;
    const stage = manager.addStage(world, nav, { mode: 'dark', sticky: true });
    const layer = manager.addLayer(nav, { stage });
    layer.canvas.style.zIndex = '0';
    nav.insertBefore(layer.canvas, navWorldCanvas.nextSibling);
    stage.add(nav, {
      radius: 0,
      bezel: 8,
      thickness: 14,
      dispersion: 0.02,
      blur: 4.5,
      tint: 0.42,
      rim: 0.16,
      shadow: 0,
      flatInner: 1,
      ring: 0,
      pad: 2,
    });
    // The nav's own background tint would double up with the shader.
    nav.style.background = 'transparent';
  }

  /* ── chrome ──────────────────────────────────────────────────────────── */
  /*
   * Scroll discipline.
   *
   * Scrolling is the one interaction that must feel like paper. So while a
   * scroll is in flight every aurora painter is frozen (they are ambient light,
   * nobody can read them mid-flick) and the overlay only re-copies its already
   * rendered glass. Backdrops resume once the page settles.
   */
  function bootScrollDiscipline() {
    let settle = 0;
    let scrolling = false;
    const worlds = () => manager ? manager.stages.map((st) => st.world).filter(Boolean) : [];
    const begin = () => {
      if (!scrolling) {
        scrolling = true;
        worlds().forEach((w) => { w.paused = true; });
      }
      clearTimeout(settle);
      settle = setTimeout(() => {
        scrolling = false;
        worlds().forEach((w) => { w.paused = false; w.dirty = true; });
        manager.stages.forEach((st) => { st._dirty = true; });
        if (manager.requestFrame) manager.requestFrame();
      }, 140);
    };
    window.addEventListener('scroll', begin, { passive: true });
    window.addEventListener('wheel', begin, { passive: true });
    window.addEventListener('touchmove', begin, { passive: true });

    // The sticky nav is the only glass that must re-render while scrolling, and
    // even that waits for the scroll to settle: every other layer scrolls with
    // the page, so its pixels are already correct.
    let navSettle = 0;
    window.addEventListener('scroll', () => {
      clearTimeout(navSettle);
      navSettle = setTimeout(() => {
        const navStage = manager.stages.find((st) => st.sticky);
        if (!navStage) return;
        navStage._dirty = true;
        if (navStage.world) navStage.world.dirty = true;
        if (manager.requestFrame) manager.requestFrame();
      }, 160);
    }, { passive: true });

    // idle: paint again occasionally, so the glass keeps living
    setInterval(() => {
      if (scrolling || document.hidden) return;
      worlds().forEach((w) => { w.dirty = true; });
      if (manager.requestFrame) manager.requestFrame();
    }, 900);
  }

  function bootChrome() {
    const nav = document.getElementById('globalnav');
    if (nav) {
      window.addEventListener('scroll', () => {
        nav.classList.toggle('is-scrolled', window.scrollY > 8);
      }, { passive: true });
    }

    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      const id = a.getAttribute('href').slice(1);
      if (!id) return;
      a.addEventListener('click', (e) => {
        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY - 52;
        window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });

    if (!reduceMotion) {
      let raf = 0;
      let last = null;
      window.addEventListener('pointermove', (e) => {
        last = e;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (!last) return;
          const nx = (last.clientX / window.innerWidth) * 2 - 1;
          const ny = (last.clientY / window.innerHeight) * 2 - 1;
          manager.stages.forEach((s) => s.world && s.world.setPointer(nx, ny));
        });
      }, { passive: true });
    }
  }

  /* ── boot ────────────────────────────────────────────────────────────── */
  function boot() {
    if (hasWebGL) manager = window.Glass.init();

    if (manager) {
      document.querySelectorAll('.tile[data-scene]').forEach((tile) => {
        try { mountScene(tile); } catch (err) { console.error('[scene]', err); }
      });
      document.querySelectorAll('.gallery__card[data-gallery-scene]').forEach((card) => {
        try { mountGallery(card); } catch (err) { console.error('[gallery]', err); }
      });
      try { bootNav(); } catch (err) { console.error('[nav]', err); }
      manager.resize();
    } else {
      document.querySelectorAll('.tile[data-scene], .gallery__card[data-gallery-scene]').forEach((el) => {
        const mount = el.querySelector('[data-scene-mount]');
        const name = el.getAttribute('data-scene') || el.getAttribute('data-gallery-scene');
        const mode = el.getAttribute('data-world') === 'pearl' ? 'pearl' : 'dark';
        if (mount && name) mount.innerHTML = window.Art.render(artName(name), mode);
      });
      document.getElementById('labPane')?.classList.add('is-fallback');
    }

    bootChrome();
    if (manager) bootScrollDiscipline();
    document.documentElement.classList.add(manager ? 'has-glass' : 'no-webgl');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();