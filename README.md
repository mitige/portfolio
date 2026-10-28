# mitige — portfolio

A portfolio for **Evan (mitige)**: instruments for minds, terminals and light.

Apple's measured layout system carrying a faithful port of the
[MacShell](https://github.com/0-ss/MacShell) liquid glass shader.

```
open index.html            # or: python3 -m http.server 4321
```

No build step, no dependencies, no external requests at runtime. Fonts, shaders
and every illustration are local.

---

## The idea

Two things, combined on purpose rather than decorated onto each other:

1. **Apple's page architecture, measured.** The nav is 44px with a 980px inner
   rail; hero cards are 692px tall, promo cards 580px; headlines are 56/60 at
   weight 600, subheads 28/32 at 400; buttons are 17px in a 980px-radius pill
   with 11×21 padding; the footer is 1024px wide, five columns, 12px type at
   `rgba(0,0,0,.56)`. These numbers were read off apple.com's computed styles at
   1440px, not approximated.

2. **MacShell's liquid glass, ported.** `liquidglass.frag` is reproduced in
   WebGL2: rounded-rect SDF → convex squircle bezel normal → Snell refraction →
   per-channel dispersion → 24-tap golden-angle blur on LOD-selected mips →
   vibrancy/tint → specular rim, meniscus, inner depth, drop shadow.

The combination is the point: hard ink lines are the best possible subject for a
refracting material, because refraction has hard edges to bend. Glass over a soft
photograph mostly reads as "blurry rectangle"; glass over a drawing reads as
glass.

## Files

```
index.html
assets/css/tokens.css     type scale, colour, geometry — the measured tokens
assets/css/layout.css     nav, tiles, band, footer, responsive
assets/css/art.css        the illustration layer and the glass slab
assets/css/feature.css    closing section, skip link, lab-era leftovers
js/world.js               the aurora backdrop + ink rasteriser
js/art.js                 nine ink drawings, as generated SVG
js/gl/glass.js            the WebGL2 liquid glass renderer
js/app.js                 controller: scenes, worlds, layers, scroll discipline
assets/fonts/             Switzer, Instrument Serif, JetBrains Mono
```

## How the glass is built

**One WebGL2 context for the whole page.** A fixed viewport-sized canvas renders
every slab, scissored to each scene's box, and the result is copied into a small
2D layer per scene. The GL surface is never in the DOM.

**The layer sits between the drawing and the text** — world (0) → glass (1) →
UI (2) → copy (3). That is macOS's stacking model: wallpaper, glass, apps, words.
A single overlay above the page would cover the very content the glass carries.

**The drawing is inside the backdrop texture.** `world.js` rasterises each SVG
once into an offscreen canvas and composites it into the aurora before the shader
samples it. If the drawing lived above the glass as DOM, the shader would only
ever refract the flat aurora and the material would be decorative.

**Scissor per scene.** Every stage's draw is clipped to its own box, so no piece
of glass can bleed into a neighbour, and a card that has scrolled under the nav
cannot pick up the nav's pixels.

## Performance notes

The page is event driven, not a free-running rAF loop:

- At rest it idles at 60fps and costs nothing; a frame is requested only when a
  world paints, a slab changes, or the page settles after a scroll.
- **Scrolling performs zero GPU work.** Every non-sticky layer scrolls with the
  page, so its pixels stay correct without a blit. The sticky nav refreshes once,
  160ms after the scroll stops.
- Texture uploads are budgeted to two stages per frame. Ten `texImage2D` +
  `generateMipmap` calls in one frame was the cause of a ~1.4s stall.
- The aurora painters run at 8fps (they are ambient light, not a game loop) and
  pause entirely during scroll.

Measured at 1440×900 on software rasterisation: 16.6ms median frame during
scroll, worst 23.4ms, zero frames over 33ms.

## Accessibility

- One `h1`, ordered `h2`s, landmark elements, skip link.
- Decorative canvases and SVGs are `aria-hidden`; every interactive control is a
  real link or button with a visible focus ring.
- `prefers-reduced-motion` disables all ambient motion.
- `prefers-reduced-transparency` falls back to opaque chrome.
- Without WebGL2 the drawings are still shown and the glass degrades to a frosted
  CSS pane (`html.no-webgl`).

## Credits

- Liquid glass material: [MacShell](https://github.com/0-ss/MacShell) by 0-ss, MIT.
- Layout system: measured from apple.com. This is an independent design study —
  not affiliated with, endorsed by, or published by Apple Inc.
- Type: Switzer (Fontshare), Instrument Serif and JetBrains Mono (Google Fonts),
  all under the SIL Open Font License.

## Content

Copy is drawn from the public READMEs of
[github.com/mitige](https://github.com/mitige): Humanity, nana, judas,
prometheus, Seuil, Deezer Glass, Confinement, All-Seeing Eye, rust-man/c-man.