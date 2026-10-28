/*
 * art.js — the illustrations.
 *
 * Everything on this page that used to be a UI mockup is now a drawing: ink
 * contour, cross-hatching for shadow, halftone for midtone, one accent, and a
 * strong diagonal composition. Graphic-novel cinema, not software screenshots.
 *
 * The rule that keeps it from becoming noise: a single bold silhouette per
 * scene, and every detail mark lives inside it. You read the shape from across
 * the room; you find the hatching up close. Simple at a glance, dense in the
 * hand.
 *
 * The liquid glass is drawn *over* the ink, which is the best possible subject
 * for a refracting material: hard black lines bend and separate at the rim far
 * more legibly than a soft photograph ever could.
 */
(function (global) {
  'use strict';

  const W = 1200;
  const H = 760;

  /* Ink palettes. Monochrome plus exactly one accent, per surface tone. */
  const INK = {
    dark: {
      ink: '#f2ede3',
      sub: 'rgba(242,237,227,0.42)',
      faint: 'rgba(242,237,227,0.16)',
      accent: '#ffb066',
      accentSoft: 'rgba(255,176,102,0.32)',
      paper: 'rgba(255,255,255,0.02)',
    },
    pearl: {
      ink: '#15141a',
      sub: 'rgba(21,20,26,0.46)',
      faint: 'rgba(21,20,26,0.15)',
      accent: '#b2481f',
      accentSoft: 'rgba(178,72,31,0.26)',
      paper: 'rgba(0,0,0,0.02)',
    },
  };

  function defs(id, k) {
    return `<defs>
      <pattern id="${id}-dots" width="7" height="7" patternUnits="userSpaceOnUse">
        <circle cx="1.9" cy="1.9" r="1.25" fill="${k.ink}" opacity="0.5"/>
      </pattern>
      <pattern id="${id}-dots-fine" width="4.4" height="4.4" patternUnits="userSpaceOnUse">
        <circle cx="1.2" cy="1.2" r="0.72" fill="${k.ink}" opacity="0.42"/>
      </pattern>
      <pattern id="${id}-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
        <line x1="0" y1="0" x2="0" y2="7" stroke="${k.ink}" stroke-width="1.15" opacity="0.46"/>
      </pattern>
      <pattern id="${id}-hatch2" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
        <line x1="0" y1="0" x2="0" y2="7" stroke="${k.ink}" stroke-width="1.15" opacity="0.46"/>
      </pattern>
      <pattern id="${id}-hatch-tight" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
        <line x1="0" y1="0" x2="0" y2="4" stroke="${k.ink}" stroke-width="1.1" opacity="0.6"/>
      </pattern>
      <radialGradient id="${id}-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="${k.accent}" stop-opacity="0.75"/>
        <stop offset="0.55" stop-color="${k.accent}" stop-opacity="0.16"/>
        <stop offset="1" stop-color="${k.accent}" stop-opacity="0"/>
      </radialGradient>
      <filter id="${id}-rough" x="-6%" y="-6%" width="112%" height="112%">
        <feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="2" seed="7" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </defs>`;
  }

  function svg(id, k, inner) {
    return `<svg class="art__svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      ${defs(id, k)}
      ${inner}
    </svg>`;
  }

  /* A ring of construction rays: the cheapest way to make a drawing feel framed. */
  function rays(cx, cy, count, r0, r1, k, opacity) {
    let out = `<g stroke="${k.ink}" stroke-width="0.9" opacity="${opacity}">`;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const x0 = cx + Math.cos(a) * r0;
      const y0 = cy + Math.sin(a) * r0;
      const x1 = cx + Math.cos(a) * r1;
      const y1 = cy + Math.sin(a) * r1;
      out += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"/>`;
    }
    return out + '</g>';
  }

  /* Tick marks along a path — the "technical drawing" texture. */
  function ticks(x0, y0, x1, y1, n, len, k, opacity) {
    let out = `<g stroke="${k.ink}" stroke-width="0.8" opacity="${opacity}">`;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      out += `<line x1="${(x - len).toFixed(1)}" y1="${(y + len).toFixed(1)}" x2="${(x + len).toFixed(1)}" y2="${(y - len).toFixed(1)}"/>`;
    }
    return out + '</g>';
  }

  /* ── 1. mind — a head opened onto its own workspace ─────────────────── */
  function mind(k, id) {
    const nodes = [
      [520, 300, 5], [640, 268, 4], [700, 340, 6], [660, 430, 4],
      [560, 452, 5], [490, 386, 4], [600, 352, 9], [742, 400, 3],
      [540, 486, 3], [688, 486, 4], [470, 300, 3],
    ];
    let chain = '';
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i], b = nodes[i + 1];
      chain += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
    }
    chain += `<line x1="600" y1="352" x2="520" y2="300"/><line x1="600" y1="352" x2="700" y2="340"/>
      <line x1="600" y1="352" x2="660" y2="430"/><line x1="600" y1="352" x2="560" y2="452"/>`;

    return svg(id, k, `
      <rect width="${W}" height="${H}" fill="${k.paper}"/>
      ${rays(600, 392, 48, 300, 760, k, 0.2)}
      <circle cx="600" cy="392" r="300" fill="url(#${id}-dots)" opacity="0.34"/>
      <circle cx="600" cy="392" r="214" fill="none" stroke="${k.ink}" stroke-width="1" opacity="0.28"/>
      <circle cx="600" cy="392" r="258" fill="none" stroke="${k.ink}" stroke-width="0.8" opacity="0.16" stroke-dasharray="2 7"/>

      <!-- orbits -->
      <g fill="none" stroke="${k.sub}" stroke-width="1.4">
        <ellipse cx="600" cy="392" rx="196" ry="86" transform="rotate(-20 600 392)"/>
        <ellipse cx="600" cy="392" rx="150" ry="62" transform="rotate(28 600 392)"/>
        <ellipse cx="600" cy="392" rx="104" ry="42" transform="rotate(-8 600 392)"/>
      </g>

      <!-- the head, in profile, cut away -->
      <g filter="url(#${id}-rough)">
        <path d="M470 648 C438 604 418 548 423 492 C428 430 452 358 506 312
                 C562 264 654 256 710 296 C748 322 765 362 768 402
                 C770 421 784 429 802 433 C820 437 830 445 826 453
                 C822 464 806 467 792 469 C788 481 792 493 786 501
                 C780 512 767 514 761 521 C755 534 760 550 748 564
                 C733 582 705 593 681 601 C659 609 640 621 620 637 L620 648 Z"
              fill="none" stroke="${k.ink}" stroke-width="7.5" stroke-linejoin="round"/>
      </g>
      <!-- interior shading: back of the skull -->
      <path d="M470 648 C438 604 418 548 423 492 C428 430 452 358 506 312
               C562 264 654 256 710 296 C700 300 640 300 590 330
               C530 366 500 430 498 500 C496 566 520 616 560 648 Z"
            fill="url(#${id}-hatch)" opacity="0.75"/>
      <!-- jaw + neck -->
      <path d="M560 648 L566 712 L512 742 L470 700 Z" fill="url(#${id}-hatch2)" opacity="0.55"/>
      <path d="M560 648 L566 712 L512 742 L470 700 Z" fill="none" stroke="${k.ink}" stroke-width="4" opacity="0.5"/>

      <!-- the cut: cranium opens -->
      <path d="M506 312 C548 372 556 466 536 560 C526 606 512 640 500 660"
            fill="none" stroke="${k.ink}" stroke-width="2" opacity="0.55"/>

      <!-- constellations inside -->
      <g stroke="${k.ink}" stroke-width="1.3" opacity="0.62">${chain}</g>
      ${nodes.map((n, i) => `<circle cx="${n[0]}" cy="${n[1]}" r="${n[2]}"
          fill="${i === 6 ? k.accent : 'none'}" stroke="${k.ink}" stroke-width="1.6"/>`).join('')}

      <!-- the igniting hub -->
      <circle cx="600" cy="352" r="52" fill="url(#${id}-glow)"/>
      <circle cx="600" cy="352" r="17" fill="${k.accent}"/>
      <circle cx="600" cy="352" r="30" fill="none" stroke="${k.accent}" stroke-width="1.4" opacity="0.8"/>
      <circle cx="600" cy="352" r="44" fill="none" stroke="${k.accent}" stroke-width="0.9" opacity="0.4" stroke-dasharray="3 5"/>

      <!-- brow, eye socket, sculptural marks -->
      <path d="M700 348 C724 352 748 366 760 386" fill="none" stroke="${k.ink}" stroke-width="5" stroke-linecap="round"/>
      <path d="M700 402 C716 398 734 398 746 404" fill="none" stroke="${k.ink}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M742 470 C756 476 768 484 772 494" fill="none" stroke="${k.ink}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
      ${ticks(800, 250, 800, 620, 12, 6, k, 0.22)}
      <g stroke="${k.ink}" stroke-width="1" opacity="0.2">
        <line x1="120" y1="660" x2="1080" y2="660"/>
        <line x1="120" y1="672" x2="1080" y2="672"/>
      </g>
    `);
  }

  /* ── 2. editor — a monolith of text standing on a plain ─────────────── */
  function editor(k, id) {
    let strata = '';
    for (let i = 0; i < 26; i++) {
      const y = 216 + i * 17;
      const w = 60 + ((i * 37) % 150);
      strata += `<line x1="452" y1="${y}" x2="${452 + w}" y2="${y}" stroke="${k.ink}" stroke-width="2.2" opacity="${0.16 + (i % 4) * 0.07}"/>`;
      if (i % 5 === 2) strata += `<rect x="${452 + w + 10}" y="${y - 3}" width="${28 + (i * 11) % 40}" height="5" fill="${k.accent}" opacity="0.5"/>`;
    }
    let floor = '';
    for (let i = -8; i <= 8; i++) {
      floor += `<line x1="${600 + i * 26}" y1="600" x2="${600 + i * 175}" y2="760" stroke="${k.ink}" stroke-width="1" opacity="0.18"/>`;
    }
    for (let i = 1; i <= 6; i++) {
      const y = 600 + i * i * 4.6;
      floor += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${k.ink}" stroke-width="1" opacity="0.14"/>`;
    }
    return svg(id, k, `
      <rect width="${W}" height="${H}" fill="${k.paper}"/>
      <circle cx="600" cy="300" r="228" fill="url(#${id}-dots)" opacity="0.28"/>
      <circle cx="600" cy="300" r="228" fill="none" stroke="${k.ink}" stroke-width="1.2" opacity="0.3"/>
      ${rays(600, 300, 40, 240, 700, k, 0.13)}

      <!-- ground -->
      <g>${floor}</g>
      <line x1="0" y1="600" x2="${W}" y2="600" stroke="${k.ink}" stroke-width="2.5" opacity="0.55"/>

      <!-- monolith, seen in perspective -->
      <path d="M440 600 L440 190 L470 168 L470 600 Z" fill="url(#${id}-hatch)" opacity="0.6"/>
      <path d="M470 168 L712 168 L712 600 L470 600 Z" fill="none" stroke="${k.ink}" stroke-width="6" stroke-linejoin="round"/>
      <path d="M470 168 L712 168 L712 600 L470 600 Z" fill="${k.paper}"/>
      <g>${strata}</g>
      <!-- caret -->
      <rect x="452" y="392" width="7" height="26" fill="${k.accent}"/>
      <rect x="452" y="392" width="120" height="26" fill="${k.accent}" opacity="0.12"/>
      <!-- the slab's cast shadow -->
      <path d="M712 600 L860 668 L700 668 L712 600 Z" fill="url(#${id}-hatch-tight)" opacity="0.45"/>
      <!-- side rail detail -->
      <g stroke="${k.ink}" stroke-width="1.2" opacity="0.45">
        <line x1="430" y1="190" x2="430" y2="600"/>
        <line x1="420" y1="200" x2="420" y2="600"/>
      </g>
      ${ticks(760, 180, 760, 600, 14, 7, k, 0.24)}
      <!-- one small figure for scale -->
      <g stroke="${k.ink}" stroke-width="3" opacity="0.75">
        <circle cx="900" cy="556" r="9" fill="none"/>
        <line x1="900" y1="565" x2="900" y2="596"/>
        <line x1="900" y1="578" x2="884" y2="590"/>
        <line x1="900" y1="578" x2="916" y2="588"/>
        <line x1="900" y1="596" x2="888" y2="620"/>
        <line x1="900" y1="596" x2="912" y2="620"/>
      </g>
    `);
  }

  /* ── 3. training — the reward curve as a mountain range ─────────────── */
  function training(k, id) {
    const pts = [[60, 690], [150, 650], [230, 660], [320, 592], [410, 606], [500, 520],
      [590, 536], [680, 440], [770, 462], [860, 348], [950, 372], [1040, 262], [1130, 300]];
    const ridge = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
    const area = ridge + ` L1130 700 L60 700 Z`;
    let contours = '';
    for (let off = 1; off <= 5; off++) {
      const shifted = pts.map((p) => `${p[0]},${p[1] + off * 22}`).join(' ');
      contours += `<polyline points="${shifted}" fill="none" stroke="${k.ink}" stroke-width="0.9" opacity="${0.3 - off * 0.04}"/>`;
    }
    return svg(id, k, `
      <rect width="${W}" height="${H}" fill="${k.paper}"/>
      <!-- sun -->
      <circle cx="940" cy="216" r="118" fill="url(#${id}-dots)" opacity="0.5"/>
      <circle cx="940" cy="216" r="118" fill="none" stroke="${k.ink}" stroke-width="2.4" opacity="0.6"/>
      <circle cx="940" cy="216" r="150" fill="none" stroke="${k.ink}" stroke-width="1" opacity="0.28" stroke-dasharray="3 9"/>
      ${rays(940, 216, 32, 158, 210, k, 0.16)}
      <!-- range -->
      <path d="${area}" fill="url(#${id}-hatch)" opacity="0.5"/>
      <path d="${ridge}" fill="none" stroke="${k.ink}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>
      <g>${contours}</g>
      <!-- the rising path -->
      <path d="${ridge}" fill="none" stroke="${k.accent}" stroke-width="2.4" stroke-dasharray="14 10" opacity="0.9"/>
      <circle cx="1130" cy="300" r="13" fill="${k.accent}"/>
      <circle cx="1130" cy="300" r="26" fill="none" stroke="${k.accent}" stroke-width="1.3" opacity="0.7"/>
      <!-- reference grid -->
      <g stroke="${k.ink}" stroke-width="0.8" opacity="0.16">
        <line x1="60" y1="700" x2="1140" y2="700"/>
        ${[0, 1, 2, 3, 4].map((i) => `<line x1="60" y1="${700 - i * 88}" x2="1140" y2="${700 - i * 88}" stroke-dasharray="2 10"/>`).join('')}
      </g>
      ${ticks(60, 700, 1140, 700, 24, 6, k, 0.3)}
      <!-- foreground speed marks -->
      <g stroke="${k.ink}" stroke-width="1.4" opacity="0.28">
        ${Array.from({ length: 9 }, (_, i) => `<line x1="${70 + i * 34}" y1="${726 + (i % 2) * 8}" x2="${120 + i * 34}" y2="${726 + (i % 2) * 8}"/>`).join('')}
      </g>
    `);
  }

  /* ── 4. kernel — a die as a walled city seen from above ─────────────── */
  function kernel(k, id) {
    let traces = '';
    for (let i = 0; i < 14; i++) {
      const y = 250 + i * 20;
      const x = i % 2 ? 380 : 820;
      traces += `<path d="M${x} ${y} h${i % 2 ? -90 : 90} v${i % 3 ? 14 : -14}"
        fill="none" stroke="${k.ink}" stroke-width="1.6" opacity="0.4"/>`;
      if (i % 4 === 0) traces += `<rect x="${i % 2 ? 286 : 906}" y="${y - 3}" width="10" height="10" fill="${k.accent}" opacity="0.9"/>`;
    }
    let pins = '';
    for (let i = 0; i < 18; i++) {
      const t = 200 + i * 46;
      pins += `<rect x="${t}" y="176" width="16" height="26" fill="url(#${id}-hatch-tight)" stroke="${k.ink}" stroke-width="1.2" opacity="0.7"/>`;
      pins += `<rect x="${t}" y="558" width="16" height="26" fill="url(#${id}-hatch-tight)" stroke="${k.ink}" stroke-width="1.2" opacity="0.7"/>`;
      pins += `<rect x="146" y="${t}" width="26" height="16" fill="url(#${id}-hatch-tight)" stroke="${k.ink}" stroke-width="1.2" opacity="0.7"/>`;
      pins += `<rect x="1028" y="${t}" width="26" height="16" fill="url(#${id}-hatch-tight)" stroke="${k.ink}" stroke-width="1.2" opacity="0.7"/>`;
    }
    return svg(id, k, `
      <rect width="${W}" height="${H}" fill="${k.paper}"/>
      <rect x="120" y="150" width="960" height="460" fill="url(#${id}-dots)" opacity="0.2"/>
      ${pins}
      <!-- package -->
      <rect x="172" y="202" width="856" height="356" fill="none" stroke="${k.ink}" stroke-width="4" opacity="0.75"/>
      <!-- the die -->
      <rect x="330" y="270" width="540" height="220" fill="${k.paper}" stroke="${k.ink}" stroke-width="6"/>
      <rect x="330" y="270" width="540" height="220" fill="url(#${id}-hatch)" opacity="0.2"/>
      <!-- floorplan inside the die -->
      <g fill="none" stroke="${k.ink}" stroke-width="2" opacity="0.75">
        <rect x="368" y="306" width="130" height="66"/>
        <rect x="368" y="392" width="86" height="64"/>
        <rect x="510" y="306" width="112" height="150"/>
        <rect x="650" y="306" width="86" height="66"/>
        <rect x="650" y="392" width="182" height="64"/>
        <rect x="474" y="392" width="18" height="64"/>
        <rect x="758" y="306" width="74" height="66"/>
      </g>
      <!-- vias -->
      <g fill="${k.ink}" opacity="0.5">
        ${Array.from({ length: 60 }, (_, i) => {
          const x = 340 + (i % 20) * 27 + (i % 3) * 3;
          const y = 282 + Math.floor(i / 20) * 66 + (i % 5) * 4;
          return `<circle cx="${x}" cy="${y}" r="1.8"/>`;
        }).join('')}
      </g>
      <g>${traces}</g>
      <!-- a single hot trace -->
      <path d="M330 380 H280 V330 H200" fill="none" stroke="${k.accent}" stroke-width="2.6"/>
      <circle cx="200" cy="330" r="7" fill="${k.accent}"/>
      <!-- corner registration -->
      <g stroke="${k.ink}" stroke-width="1.2" opacity="0.4">
        <path d="M120 150 h40 M120 150 v40 M1080 150 h-40 M1080 150 v40
                 M120 610 h40 M120 610 v-40 M1080 610 h-40 M1080 610 v-40" fill="none"/>
      </g>
      ${ticks(120, 130, 1080, 130, 20, 6, k, 0.25)}
    `);
  }

  /* ── 5. tokamak — the reactor as a hero object ──────────────────────── */
  function tokamak(k, id) {
    let coils = '';
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const cx = 600 + Math.cos(a) * 236;
      const cy = 392 + Math.sin(a) * 150;
      const rot = (a * 180) / Math.PI + 90;
      coils += `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="30" ry="108"
        transform="rotate(${rot.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})"
        fill="none" stroke="${k.ink}" stroke-width="2.2" opacity="0.55"/>`;
    }
    return svg(id, k, `
      <rect width="${W}" height="${H}" fill="${k.paper}"/>
      <!-- speed lines -->
      <g stroke="${k.ink}" stroke-width="1.1" opacity="0.2">
        ${Array.from({ length: 40 }, (_, i) => {
          const a = (i / 40) * Math.PI * 2;
          const x0 = 600 + Math.cos(a) * 300, y0 = 392 + Math.sin(a) * 210;
          const x1 = 600 + Math.cos(a) * 760, y1 = 392 + Math.sin(a) * 540;
          return `<line x1="${x0.toFixed(0)}" y1="${y0.toFixed(0)}" x2="${x1.toFixed(0)}" y2="${y1.toFixed(0)}"/>`;
        }).join('')}
      </g>
      <circle cx="600" cy="392" r="286" fill="url(#${id}-dots)" opacity="0.16"/>
      <g>${coils}</g>
      <!-- torus body -->
      <ellipse cx="600" cy="392" rx="236" ry="150" fill="none" stroke="${k.ink}" stroke-width="7"/>
      <ellipse cx="600" cy="392" rx="150" ry="92" fill="none" stroke="${k.ink}" stroke-width="5"/>
      <path d="M364 392 C364 475 470 542 600 542 C730 542 836 475 836 392
               C836 309 730 242 600 242 C470 242 364 309 364 392 Z"
            fill="url(#${id}-hatch)" opacity="0.3"/>
      <!-- plasma -->
      <ellipse cx="600" cy="392" rx="150" ry="92" fill="url(#${id}-glow)" opacity="0.9"/>
      <ellipse cx="600" cy="392" rx="108" ry="64" fill="none" stroke="${k.accent}" stroke-width="2.6"/>
      <ellipse cx="600" cy="392" rx="72" ry="42" fill="none" stroke="${k.accent}" stroke-width="1.6" opacity="0.8"/>
      <ellipse cx="600" cy="392" rx="34" ry="20" fill="${k.accent}" opacity="0.85"/>
      <!-- field lines -->
      <g fill="none" stroke="${k.ink}" stroke-width="1" opacity="0.5">
        <ellipse cx="600" cy="392" rx="196" ry="122" transform="rotate(12 600 392)" stroke-dasharray="5 7"/>
        <ellipse cx="600" cy="392" rx="196" ry="122" transform="rotate(-16 600 392)" stroke-dasharray="5 7"/>
      </g>
      ${ticks(364, 566, 836, 566, 16, 6, k, 0.28)}
      <!-- base shadow -->
      <ellipse cx="600" cy="612" rx="250" ry="26" fill="url(#${id}-hatch-tight)" opacity="0.3"/>
    `);
  }

  /* ── 6. journal — an open book, and a lock ──────────────────────────── */
  function journal(k, id) {
    let lines = '';
    for (let i = 0; i < 9; i++) {
      const y = 330 + i * 26;
      lines += `<line x1="250" y1="${y}" x2="${470 - (i % 3) * 26}" y2="${y}" stroke="${k.ink}" stroke-width="1.8" opacity="0.32"/>`;
      lines += `<line x1="730" y1="${y}" x2="${950 - (i % 4) * 20}" y2="${y}" stroke="${k.ink}" stroke-width="1.8" opacity="0.32"/>`;
    }
    return svg(id, k, `
      <rect width="${W}" height="${H}" fill="${k.paper}"/>
      ${rays(600, 300, 44, 250, 720, k, 0.14)}
      <circle cx="600" cy="300" r="210" fill="url(#${id}-dots)" opacity="0.22"/>
      <circle cx="600" cy="300" r="248" fill="none" stroke="${k.ink}" stroke-width="1" opacity="0.24" stroke-dasharray="3 8"/>
      <!-- book -->
      <path d="M212 300 C330 270 480 292 600 330 C720 292 870 270 988 300
               L988 618 C870 588 720 610 600 648 C480 610 330 588 212 618 Z"
            fill="${k.paper}" stroke="${k.ink}" stroke-width="6.5" stroke-linejoin="round"/>
      <path d="M212 300 C330 270 480 292 600 330 L600 648 C480 610 330 588 212 618 Z"
            fill="url(#${id}-hatch)" opacity="0.16"/>
      <line x1="600" y1="330" x2="600" y2="648" stroke="${k.ink}" stroke-width="3.4"/>
      <g>${lines}</g>
      <!-- the lock, centre -->
      <g transform="translate(600 470)">
        <rect x="-46" y="-14" width="92" height="76" rx="12" fill="${k.paper}" stroke="${k.ink}" stroke-width="5"/>
        <path d="M-26 -14 v-22 a26 26 0 0 1 52 0 v22" fill="none" stroke="${k.ink}" stroke-width="5"/>
        <circle cx="0" cy="18" r="9" fill="${k.accent}"/>
        <line x1="0" y1="27" x2="0" y2="42" stroke="${k.accent}" stroke-width="5" stroke-linecap="round"/>
      </g>
      <!-- pages fanning -->
      <g stroke="${k.ink}" stroke-width="1.2" opacity="0.35">
        <path d="M212 618 C330 588 480 610 600 648 L600 672 C480 636 330 612 212 642 Z" fill="none"/>
        <path d="M988 618 C870 588 720 610 600 648 L600 672 C720 636 870 612 988 642 Z" fill="none"/>
      </g>
      ${ticks(212, 700, 988, 700, 20, 6, k, 0.25)}
    `);
  }

  /* ── 7. eye — the all-seeing eye over a terminal ────────────────────── */
  function eye(k, id) {
    let lashes = '';
    for (let i = 0; i <= 22; i++) {
      const t = i / 22;
      const x = 250 + t * 700;
      const y = 300 + Math.sin(t * Math.PI) * -78;
      lashes += `<line x1="${x}" y1="${y}" x2="${x + (t - 0.5) * 34}" y2="${y - 34 - (1 - Math.abs(t - 0.5) * 2) * 18}" stroke="${k.ink}" stroke-width="2" opacity="0.6"/>`;
    }
    let iris = '';
    for (let r = 74; r > 8; r -= 8) iris += `<circle cx="600" cy="392" r="${r}" fill="none" stroke="${k.ink}" stroke-width="1.2" opacity="0.35"/>`;
    let pupil = '';
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2;
      pupil += `<line x1="${600 + Math.cos(a) * 20}" y1="${392 + Math.sin(a) * 20}" x2="${600 + Math.cos(a) * 52}" y2="${392 + Math.sin(a) * 52}" stroke="${k.ink}" stroke-width="1.1" opacity="0.4"/>`;
    }
    return svg(id, k, `
      <rect width="${W}" height="${H}" fill="${k.paper}"/>
      ${rays(600, 392, 52, 200, 760, k, 0.16)}
      <!-- upper lid -->
      <path d="M250 300 C400 190 800 190 950 300" fill="none" stroke="${k.ink}" stroke-width="7" stroke-linecap="round"/>
      <path d="M250 300 C400 496 800 496 950 300" fill="none" stroke="${k.ink}" stroke-width="7" stroke-linecap="round"/>
      <path d="M250 300 C400 190 800 190 950 300 C800 496 400 496 250 300 Z"
            fill="url(#${id}-dots-fine)" opacity="0.28"/>
      <g>${lashes}</g>
      <!-- iris -->
      <circle cx="600" cy="392" r="98" fill="none" stroke="${k.ink}" stroke-width="5"/>
      <circle cx="600" cy="392" r="98" fill="url(#${id}-hatch)" opacity="0.3"/>
      <g>${iris}</g>
      <g>${pupil}</g>
      <circle cx="600" cy="392" r="20" fill="${k.ink}"/>
      <circle cx="566" cy="358" r="14" fill="${k.paper}" opacity="0.85"/>
      <!-- the terminal beneath, small -->
      <g opacity="0.8">
        <rect x="470" y="596" width="260" height="112" rx="8" fill="${k.paper}" stroke="${k.ink}" stroke-width="4"/>
        <line x1="470" y1="620" x2="730" y2="620" stroke="${k.ink}" stroke-width="2"/>
        <g stroke="${k.ink}" stroke-width="2" opacity="0.5">
          <line x1="492" y1="640" x2="560" y2="640"/>
          <line x1="492" y1="656" x2="612" y2="656"/>
          <line x1="492" y1="672" x2="536" y2="672"/>
        </g>
        <rect x="492" y="686" width="8" height="12" fill="${k.accent}"/>
      </g>
      ${ticks(250, 720, 950, 720, 18, 6, k, 0.25)}
    `);
  }

  /* ── 8. learning — a monument of cards and a beam ───────────────────── */
  function learning(k, id) {
    let cards = '';
    const specs = [
      [420, 300, 250, 150, -7], [530, 350, 250, 150, 3],
      [400, 420, 250, 150, 5], [560, 470, 250, 150, -4],
    ];
    specs.forEach((s, i) => {
      cards += `<g transform="rotate(${s[4]} ${s[0] + s[2] / 2} ${s[1] + s[3] / 2})">
        <rect x="${s[0]}" y="${s[1]}" width="${s[2]}" height="${s[3]}" rx="10"
          fill="${k.paper}" stroke="${k.ink}" stroke-width="${i % 2 ? 3 : 4.5}"/>
        ${[0, 1, 2, 3].map((j) => `<line x1="${s[0] + 22}" y1="${s[1] + 40 + j * 24}"
          x2="${s[0] + s[2] - 26 - j * 14}" y2="${s[1] + 40 + j * 24}"
          stroke="${k.ink}" stroke-width="2" opacity="0.3"/>`).join('')}
        <rect x="${s[0] + 22}" y="${s[1] + 20}" width="34" height="8" fill="${k.accent}" opacity="0.8"/>
      </g>`;
    });
    return svg(id, k, `
      <rect width="${W}" height="${H}" fill="${k.paper}"/>
      <circle cx="600" cy="300" r="230" fill="url(#${id}-dots)" opacity="0.24"/>
      <!-- beam -->
      <path d="M560 60 L640 60 L760 700 L440 700 Z" fill="url(#${id}-glow)" opacity="0.5"/>
      ${rays(600, 300, 36, 250, 700, k, 0.12)}
      <g>${cards}</g>
      <!-- pedestal -->
      <path d="M300 690 L900 690 L860 730 L340 730 Z" fill="url(#${id}-hatch-tight)" opacity="0.5"/>
      <line x1="300" y1="690" x2="900" y2="690" stroke="${k.ink}" stroke-width="4"/>
      <g stroke="${k.ink}" stroke-width="1.6" opacity="0.5">
        <line x1="180" y1="240" x2="260" y2="240"/>
        <line x1="940" y1="240" x2="1020" y2="240"/>
        <line x1="180" y1="240" x2="180" y2="300"/>
        <line x1="1020" y1="240" x2="1020" y2="300"/>
      </g>
      ${ticks(180, 706, 1020, 706, 18, 6, k, 0.25)}
    `);
  }

  /* ── 9. player — a record, a wave, a beam ───────────────────────────── */
  function player(k, id) {
    let grooves = '';
    for (let r = 190; r > 40; r -= 7) grooves += `<circle cx="600" cy="392" r="${r}" fill="none" stroke="${k.ink}" stroke-width="1" opacity="0.26"/>`;
    let wave = '';
    for (let i = 0; i < 64; i++) {
      const x = 120 + i * 15;
      const amp = 30 + Math.sin(i * 0.55) * 40 + Math.sin(i * 0.17) * 30;
      wave += `<line x1="${x}" y1="${392 - amp / 2}" x2="${x}" y2="${392 + amp / 2}" stroke="${k.ink}" stroke-width="3" opacity="0.5"/>`;
    }
    return svg(id, k, `
      <rect width="${W}" height="${H}" fill="${k.paper}"/>
      ${rays(600, 392, 56, 210, 780, k, 0.16)}
      <circle cx="600" cy="392" r="230" fill="url(#${id}-dots)" opacity="0.2"/>
      <g>${grooves}</g>
      <circle cx="600" cy="392" r="196" fill="none" stroke="${k.ink}" stroke-width="5"/>
      <circle cx="600" cy="392" r="64" fill="none" stroke="${k.ink}" stroke-width="4"/>
      <circle cx="600" cy="392" r="18" fill="${k.accent}"/>
      <circle cx="600" cy="392" r="120" fill="none" stroke="${k.accent}" stroke-width="1.6" opacity="0.7" stroke-dasharray="6 10"/>
      <g>${wave}</g>
      <path d="M120 392 H1080" stroke="${k.ink}" stroke-width="1" opacity="0.2"/>
      ${ticks(120, 640, 1080, 640, 24, 6, k, 0.24)}
    `);
  }

  const ART = { mind, editor, training, kernel, tokamak, journal, eye, learning, player };

  /*
   * The drawing is the only thing in here.
   *
   * There are deliberately no floating "glass cards" sprinkled over the art:
   * a small pane over a big tile reads as a sticker, and it was the ugliest
   * thing on the page. The glass is the tile itself — one large slab, one
   * rounded edge, the drawing beneath it. That is both calmer and much closer
   * to what MacShell actually looks like: a whole surface of glass, not a
   * collection of cutouts.
   */
  function render(name, mode) {
    const k = INK[mode === 'pearl' ? 'pearl' : 'dark'];
    const fn = ART[name] || ART.mind;
    const id = 'a-' + name;
    return `<div class="art art--${name}" data-art="${name}">
      <div class="art__frame">${fn(k, id)}</div>
    </div>`;
  }

  global.Art = { render, names: Object.keys(ART) };
})(window);