// Built-in animated presenters. Free, offline, deterministic. Lip-sync is driven by the real audio envelope
// (spec.envelope = {fps, data[]}) with a word-timing fallback when there is no audio.
(function () {
  const RK = window.RK; const { svg, h, clamp } = RK;

  // 0..1 mouth openness at time t
  RK.mouthAt = t => {
    const env = RK.spec.envelope;
    if (env && env.data && env.data.length) { const f = t * env.fps, i = Math.floor(f), a = env.data[i] ?? 0, b = env.data[i + 1] ?? a; return clamp(a + (b - a) * (f - i)); }
    for (const w of RK.words || []) if (t >= w.s && t <= w.e) { const u = (t - w.s) / Math.max(0.05, w.e - w.s); return clamp(0.25 + 0.65 * Math.abs(Math.sin(u * Math.PI * Math.max(1, Math.round(w.t.length / 3))))); }
    return 0;
  };
  // vowel shape of the word being spoken: {wide, round}
  RK.visemeAt = t => {
    for (const w of RK.words || []) if (t >= w.s && t <= w.e) { const l = w.t.toLowerCase(); return { wide: /[ei]/.test(l) ? 1 : 0, round: /[ouw]/.test(l) ? 1 : 0, closed: /^[mbp]/.test(l) && t - w.s < 0.07 ? 1 : 0 }; }
    return { wide: 0, round: 0, closed: 0 };
  };
  RK.emphAt = t => { for (const w of RK.words || []) if (w.key && t >= w.s - 0.05 && t <= w.e + 0.35) return clamp(Math.min((t - w.s + 0.05) / 0.15, (w.e + 0.35 - t) / 0.2, 1)); return 0; };
  const blinkAt = t => { let b = 0; for (let k = 0; k < 40; k++) { const bt = 1.1 + k * 3.1 + 0.8 * Math.sin(k * 7.3); const d = Math.abs(t - bt); if (d < 0.09) b = Math.max(b, 1 - d / 0.09); } return b; };
  const smooth = (() => { let last = 0, lt = -1; return (t, v) => { const dt = t - lt; lt = t; const k = v > last ? 0.7 : 0.35; last = Math.abs(dt) > 0.2 ? v : last + (v - last) * k; return last; }; })();

  const P = (tag, a, parent) => svg(tag, a, parent);

  const characters = {
    host(g, o) { // a flat-vector presenter: proper proportions, shaded face, expressive brows, lip shapes that follow the audio
      const long = !!o.long, skin = o.skin || '#f0c4a0', skinD = o.skinShade || '#dba583', hair = o.hair || (long ? '#4a2a18' : '#2b2118'), hairL = o.hairLight || (long ? '#6b3f26' : '#44352a'), shirt = o.shirt || '#6366f1', shirtD = o.shirtShade || '#4f46e5', iris = o.iris || '#5b7ea6';
      const uid = 'h' + Math.floor(Math.random() * 1e6); const defs = P('defs', {}, g);
      const sg = P('linearGradient', { id: uid + 's', x1: 0, y1: 0, x2: 0, y2: 1 }, defs); P('stop', { offset: 0, 'stop-color': skin }, sg); P('stop', { offset: 1, 'stop-color': skinD }, sg);
      const hg = P('linearGradient', { id: uid + 'h', x1: 0, y1: 0, x2: 1, y2: 1 }, defs); P('stop', { offset: 0, 'stop-color': hairL }, hg); P('stop', { offset: 1, 'stop-color': hair }, hg);
      const clip = P('clipPath', { id: uid + 'c' }, defs); const clipPath = P('path', { d: '' }, clip);
      const bodyG = P('g', {}, g), headG = P('g', {}, g);
      if (long) P('path', { d: 'M128 330 C96 130 215 86 300 86 C400 86 506 134 472 336 L506 640 C440 668 384 610 380 566 L220 566 C216 610 160 668 94 640 Z', fill: `url(#${uid}h)` }, bodyG);
      P('path', { d: 'M20 770 C22 650 110 604 228 588 L372 588 C490 604 578 650 580 770 Z', fill: shirt }, bodyG); P('path', { d: 'M20 770 C22 690 60 640 120 616 C100 660 96 720 100 770 Z', fill: shirtD, opacity: .55 }, bodyG);
      P('rect', { x: 252, y: 460, width: 96, height: 150, rx: 40, fill: skinD }, bodyG); P('path', { d: 'M222 592 C250 650 350 650 378 592 C350 626 250 626 222 592 Z', fill: skin }, bodyG); P('path', { d: 'M226 588 C256 640 344 640 374 588 L380 600 C350 668 250 668 220 600 Z', fill: shirtD }, bodyG);
      P('ellipse', { cx: 300, cy: 512, rx: 46, ry: 20, fill: '#000', opacity: .12 }, bodyG);
      P('ellipse', { cx: 146, cy: 345, rx: 20, ry: 38, fill: skinD }, headG); P('ellipse', { cx: 454, cy: 345, rx: 20, ry: 38, fill: skinD }, headG);
      P('path', { d: 'M300 126 C412 126 462 214 457 322 C452 424 386 496 300 496 C214 496 148 424 143 322 C138 214 188 126 300 126 Z', fill: `url(#${uid}s)` }, headG);
      P('ellipse', { cx: 206, cy: 398, rx: 34, ry: 20, fill: '#f08a8a', opacity: .22 }, headG); P('ellipse', { cx: 394, cy: 398, rx: 34, ry: 20, fill: '#f08a8a', opacity: .22 }, headG);
      const eyes = [240, 360].map(cx => { const e = P('g', {}, headG); P('ellipse', { cx, cy: 332, rx: 30, ry: 22, fill: '#fff' }, e); const ir = P('g', {}, e); P('circle', { cx, cy: 332, r: 15, fill: iris }, ir); P('circle', { cx, cy: 332, r: 7.5, fill: '#101820' }, ir); P('circle', { cx: cx + 4, cy: 327, r: 3.2, fill: '#fff' }, ir);
        const lid = P('ellipse', { cx, cy: 332, rx: 30, ry: 22, fill: skin }, e); P('path', { d: `M${cx - 30} 330 Q${cx} ${306} ${cx + 30} 330`, fill: 'none', stroke: hair, 'stroke-width': 5, 'stroke-linecap': 'round' }, e); return { cx, ir, lid }; });
      const brows = [240, 360].map((cx, i) => P('path', { d: '', fill: 'none', stroke: hair, 'stroke-width': 10, 'stroke-linecap': 'round' }, headG));
      P('path', { d: 'M298 350 C291 384 286 398 300 402 C312 402 312 396 307 392', fill: 'none', stroke: skinD, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, headG);
      const mouth = P('g', { transform: 'translate(300 440)' }, headG); const inner = P('path', { d: '', fill: '#5a1f2b' }, mouth); const teeth = P('rect', { x: -60, y: -4, width: 120, height: 10, rx: 4, fill: '#fff', 'clip-path': `url(#${uid}c)` }, mouth); const tongue = P('ellipse', { cx: 0, cy: 18, rx: 20, ry: 8, fill: '#e87a86', 'clip-path': `url(#${uid}c)` }, mouth); const lips = P('path', { d: '', fill: 'none', stroke: '#d9726f', 'stroke-width': 9, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, mouth);
      // hair on top of the head
      if (long) { P('path', { d: 'M138 316 C118 150 214 98 300 98 C400 98 486 150 462 316 C448 236 400 176 300 168 C250 172 190 190 138 316 Z', fill: `url(#${uid}h)` }, headG); P('path', { d: 'M300 98 C250 128 200 170 150 262 C170 190 230 120 300 98 Z', fill: hairL, opacity: .5 }, headG); }
      else { P('path', { d: 'M137 322 C112 160 204 96 300 96 C408 96 492 162 463 322 C452 258 424 214 384 196 C330 214 232 214 190 196 C160 222 142 268 137 322 Z', fill: `url(#${uid}h)` }, headG); P('path', { d: 'M190 198 C250 170 340 170 400 198 C330 190 250 190 190 198 Z', fill: hairL, opacity: .6 }, headG); }
      return (t, m, v, em, blink) => {
        const nod = Math.sin(t * 2.1) * 3 + em * 8, tilt = Math.sin(t * 1.15) * 2.4 + (v.wide - v.round) * 0.8;
        headG.setAttribute('transform', `translate(0 ${nod}) rotate(${tilt} 300 500)`); bodyG.setAttribute('transform', `translate(0 ${Math.sin(t * 1.4) * 2.2})`);
        const dx = Math.sin(t * 0.8) * 3, dy = Math.sin(t * 0.55 + 1) * 1.6; eyes.forEach(e => { e.ir.setAttribute('transform', `translate(${dx} ${dy})`); const top = 310, b = blink > 0.05 ? blink : 0; e.lid.setAttribute('transform', `translate(0 ${top}) scale(1 ${b}) translate(0 ${-top})`); });
        brows.forEach((b, i) => { const cx = [240, 360][i], dir = i ? 1 : -1, y = 282 - em * 12 - m * 4; b.setAttribute('d', `M${cx - 32} ${y + 8 + (dir > 0 ? 0 : 0)} Q${cx + dir * 2} ${y - 12 - em * 4} ${cx + 32} ${y + 6}`); });
        const w = 44 + v.wide * 10 - v.round * 14, open = m * 36 + (v.closed ? 0 : 1), sm = 7 - m * 5;
        const d = `M${-w} ${-sm} C${-w * 0.5} ${-8} ${w * 0.5} ${-8} ${w} ${-sm} C${w * 0.62} ${open + 8} ${-w * 0.62} ${open + 8} ${-w} ${-sm} Z`; inner.setAttribute('d', open > 3 ? d : ''); clipPath.setAttribute('d', d); lips.setAttribute('d', d);
        teeth.setAttribute('height', Math.min(14, open * 0.5)); teeth.setAttribute('opacity', open > 5 ? 1 : 0); tongue.setAttribute('cy', open * 0.8); tongue.setAttribute('ry', Math.max(1, open * 0.26)); tongue.setAttribute('rx', w * 0.4);
      };
    },
    hostw(g, o) { return characters.host(g, Object.assign({ long: true, skin: '#eebb99', skinShade: '#d89e7e', iris: '#6b8f5e' }, o)); },
    founder(g, o) {
      const skin = o.skin || '#e8b48a', skinD = o.skinShade || '#d39a72', hair = o.hair || '#2b2118', shirt = o.shirt || '#6366f1', shirtD = o.shirtShade || '#4f46e5';
      const body = P('g', {}, g);
      P('path', { d: 'M40 760 C40 610 150 565 300 565 C450 565 560 610 560 760 Z', fill: shirt }, body);
      P('path', { d: 'M185 585 C230 640 370 640 415 585 C380 560 220 560 185 585 Z', fill: shirtD }, body);
      P('rect', { x: 268, y: 470, width: 64, height: 120, rx: 26, fill: skinD }, body);
      P('path', { d: 'M248 600 L244 680 M352 600 L356 680', stroke: '#fff', 'stroke-width': 5, 'stroke-linecap': 'round', opacity: .8 }, body);
      const hand = P('g', {}, g); P('rect', { x: -26, y: 0, width: 52, height: 170, rx: 26, fill: shirt }, hand); P('circle', { cx: 0, cy: -8, r: 36, fill: skin }, hand);
      const head = P('g', {}, g);
      P('ellipse', { cx: 168, cy: 312, rx: 20, ry: 32, fill: skinD }, head); P('ellipse', { cx: 432, cy: 312, rx: 20, ry: 32, fill: skinD }, head);
      P('ellipse', { cx: 300, cy: 300, rx: 132, ry: 152, fill: skin }, head);
      P('path', { d: 'M158 304 C122 70 478 54 442 304 C424 252 392 226 350 214 C318 236 262 232 232 212 C196 232 172 262 158 304 Z', fill: hair }, head);
      P('path', { d: 'M236 206 C270 150 360 150 392 212 C350 196 290 190 236 206Z', fill: hair, opacity: .6 }, head);
      const eyeL = P('ellipse', { cx: 248, cy: 306, rx: 26, ry: 22, fill: '#fff' }, head), eyeR = P('ellipse', { cx: 352, cy: 306, rx: 26, ry: 22, fill: '#fff' }, head);
      const pl = P('circle', { cx: 252, cy: 308, r: 11, fill: '#1f2937' }, head), pr = P('circle', { cx: 356, cy: 308, r: 11, fill: '#1f2937' }, head);
      const bl = P('path', { d: '', stroke: hair, 'stroke-width': 11, 'stroke-linecap': 'round', fill: 'none' }, head), br = P('path', { d: '', stroke: hair, 'stroke-width': 11, 'stroke-linecap': 'round', fill: 'none' }, head);
      if (o.glasses !== false) { P('rect', { x: 212, y: 280, width: 76, height: 56, rx: 20, fill: 'none', stroke: '#111827', 'stroke-width': 6 }, head); P('rect', { x: 312, y: 280, width: 76, height: 56, rx: 20, fill: 'none', stroke: '#111827', 'stroke-width': 6 }, head); P('path', { d: 'M288 306 L312 306', stroke: '#111827', 'stroke-width': 6 }, head); }
      P('path', { d: 'M296 336 Q300 352 308 350', stroke: skinD, 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' }, head);
      const mouthBg = P('path', { d: '', fill: '#5b1a1a' }, head), teeth = P('path', { d: '', fill: '#fff' }, head), lip = P('path', { d: '', stroke: '#9a3412', 'stroke-width': 7, 'stroke-linecap': 'round', fill: 'none' }, head);
      P('ellipse', { cx: 222, cy: 372, rx: 20, ry: 11, fill: '#f87171', opacity: .25 }, head); P('ellipse', { cx: 378, cy: 372, rx: 20, ry: 11, fill: '#f87171', opacity: .25 }, head);
      return (t, m, v, em, blink) => {
        const tilt = Math.sin(t * 1.3) * 2.2 + em * 2, bob = Math.sin(t * 2.1) * 3 + m * 4;
        head.setAttribute('transform', `translate(0 ${bob}) rotate(${tilt} 300 480)`); body.setAttribute('transform', `translate(0 ${Math.sin(t * 2.1) * 1.5})`);
        const ey = 22 * (1 - blink * 0.92); eyeL.setAttribute('ry', ey); eyeR.setAttribute('ry', ey); pl.setAttribute('ry', Math.max(1, 11 * (1 - blink))); pr.setAttribute('ry', Math.max(1, 11 * (1 - blink)));
        const lift = em * 14; bl.setAttribute('d', `M218 ${262 - lift} Q248 ${250 - lift} 280 ${264 - lift}`); br.setAttribute('d', `M320 ${264 - lift} Q352 ${250 - lift} 382 ${262 - lift}`);
        const w = 34 + 14 * v.wide - 12 * v.round, hgt = 3 + m * 46 * (v.closed ? 0.1 : 1) + v.round * 6; const cx = 300, cy = 396;
        if (hgt < 6) { mouthBg.setAttribute('d', ''); teeth.setAttribute('d', ''); lip.setAttribute('d', `M${cx - w} ${cy - 2} Q${cx} ${cy + 16 - m * 8} ${cx + w} ${cy - 2}`); }
        else { mouthBg.setAttribute('d', `M${cx - w} ${cy} Q${cx} ${cy + hgt * 1.5} ${cx + w} ${cy} Q${cx} ${cy - hgt * 0.25} ${cx - w} ${cy} Z`); teeth.setAttribute('d', `M${cx - w + 5} ${cy + 1} Q${cx} ${cy - hgt * 0.25 + 2} ${cx + w - 5} ${cy + 1} L${cx + w - 9} ${cy + 11} Q${cx} ${cy + 6} ${cx - w + 9} ${cy + 11} Z`); lip.setAttribute('d', `M${cx - w} ${cy} Q${cx} ${cy - hgt * 0.3} ${cx + w} ${cy}`); }
        hand.setAttribute('transform', `translate(${470 + em * 30} ${690 - em * 210}) rotate(${-14 + em * 20})`);
      };
    },
    robot(g, o) {
      const c = o.shell || '#cbd5e1', d = o.shellShade || '#94a3b8', led = o.led || '#22d3ee';
      P('rect', { x: 120, y: 560, width: 360, height: 220, rx: 60, fill: d }, g); P('circle', { cx: 300, cy: 650, r: 26, fill: led }, g);
      P('rect', { x: 275, y: 500, width: 50, height: 70, rx: 12, fill: d }, g);
      const head = P('g', {}, g); P('rect', { x: 290, y: 90, width: 20, height: 70, rx: 8, fill: d }, head); P('circle', { cx: 300, cy: 84, r: 22, fill: led }, head);
      P('rect', { x: 130, y: 150, width: 340, height: 330, rx: 90, fill: c }, head); P('rect', { x: 160, y: 200, width: 280, height: 150, rx: 56, fill: '#0f172a' }, head);
      const eL = P('rect', { x: 200, y: 245, width: 56, height: 56, rx: 20, fill: led }, head), eR = P('rect', { x: 344, y: 245, width: 56, height: 56, rx: 20, fill: led }, head);
      const bars = [...Array(9)].map((_, i) => P('rect', { x: 188 + i * 26, y: 405, width: 16, height: 6, rx: 8, fill: led }, head));
      return (t, m, v, em, blink) => {
        head.setAttribute('transform', `translate(0 ${Math.sin(t * 2.4) * 4}) rotate(${Math.sin(t * 1.1) * 2.5} 300 480)`);
        const hh = 56 * (1 - blink * 0.9) * (1 + em * 0.15); eL.setAttribute('height', hh); eR.setAttribute('height', hh); eL.setAttribute('y', 273 - hh / 2); eR.setAttribute('y', 273 - hh / 2);
        bars.forEach((b, i) => { const k = 0.35 + 0.65 * Math.abs(Math.sin(t * 15 + i * 1.9)); const hh2 = 6 + m * 56 * k * (1 - Math.abs(i - 4) / 6); b.setAttribute('height', hh2); b.setAttribute('y', 408 - hh2 / 2); });
      };
    },
    orb(g, o) { // a calm glowing voice orb: no face, nothing to look awkward. Pulses and ripples with the real audio.
      const c = o.led || o.body || '#6366f1';
      const defs = P('defs', {}, g); const gr = P('radialGradient', { id: 'orbg', cx: '38%', cy: '34%', r: '75%' }, defs); P('stop', { offset: '0', 'stop-color': '#ffffff', 'stop-opacity': '.95' }, gr); P('stop', { offset: '.35', 'stop-color': c, 'stop-opacity': '.95' }, gr); P('stop', { offset: '1', 'stop-color': c, 'stop-opacity': '.35' }, gr);
      const halo = P('circle', { cx: 300, cy: 380, r: 230, fill: c, opacity: .12 }, g); const rings = [0, 1, 2].map(() => P('circle', { cx: 300, cy: 380, r: 200, fill: 'none', stroke: c, 'stroke-width': 4, opacity: 0 }, g));
      const core = P('circle', { cx: 300, cy: 380, r: 160, fill: 'url(#orbg)' }, g); const bars = [...Array(24)].map((_, i) => { const a = (i / 24) * Math.PI * 2; return { a, el: P('rect', { x: -4, y: -4, width: 8, height: 8, rx: 4, fill: '#fff', opacity: .85 }, g) }; });
      return (t, m, v, em) => {
        const sc = 1 + m * 0.16 + em * 0.05 + Math.sin(t * 1.6) * 0.012; core.setAttribute('transform', `translate(300 380) scale(${sc}) translate(-300 -380)`); halo.setAttribute('r', 230 + m * 60); halo.setAttribute('opacity', 0.1 + m * 0.18);
        rings.forEach((r, i) => { const u = ((t * 0.7 + i / 3) % 1); r.setAttribute('r', 175 + u * 110 * (0.4 + m)); r.setAttribute('opacity', (1 - u) * (0.1 + m * 0.5)); });
        bars.forEach((b, i) => { const k = 0.3 + 0.7 * Math.abs(Math.sin(t * 9 + i * 1.7)); const len = 8 + m * 70 * k; const rr = 178 * sc + len / 2; b.el.setAttribute('height', len); b.el.setAttribute('transform', `translate(${300 + Math.cos(b.a) * rr} ${380 + Math.sin(b.a) * rr}) rotate(${(b.a * 180) / Math.PI + 90}) translate(-4 ${-len / 2})`); });
      };
    },
    blob(g, o) {
      const c = o.body || '#fb923c', d = o.shade || '#ea580c';
      const body = P('g', {}, g); P('ellipse', { cx: 300, cy: 600, rx: 210, ry: 230, fill: d }, body); const face = P('g', {}, g); const bl = P('ellipse', { cx: 300, cy: 330, rx: 200, ry: 190, fill: c }, face);
      P('ellipse', { cx: 230, cy: 280, rx: 34, ry: 60, fill: '#fff', opacity: .12 }, face);
      const eL = P('ellipse', { cx: 230, cy: 310, rx: 36, ry: 44, fill: '#fff' }, face), eR = P('ellipse', { cx: 370, cy: 310, rx: 36, ry: 44, fill: '#fff' }, face);
      const pl = P('circle', { cx: 236, cy: 316, r: 17, fill: '#111827' }, face), pr = P('circle', { cx: 376, cy: 316, r: 17, fill: '#111827' }, face);
      P('ellipse', { cx: 168, cy: 395, rx: 24, ry: 14, fill: '#fb7185', opacity: .5 }, face); P('ellipse', { cx: 432, cy: 395, rx: 24, ry: 14, fill: '#fb7185', opacity: .5 }, face);
      const mouth = P('ellipse', { cx: 300, cy: 410, rx: 38, ry: 8, fill: '#7f1d1d' }, face), tongue = P('ellipse', { cx: 300, cy: 420, rx: 22, ry: 6, fill: '#fb7185' }, face);
      return (t, m, v, em, blink) => {
        const sy = 1 + m * 0.07 - 0.02, sx = 1 - m * 0.04; face.setAttribute('transform', `translate(${300 - 300 * sx} ${Math.sin(t * 2) * 4 + (1 - sy) * 300}) scale(${sx} ${sy}) rotate(${Math.sin(t * 1.2) * 2} 300 480)`);
        const ey = 44 * (1 - blink * 0.9); eL.setAttribute('ry', ey); eR.setAttribute('ry', ey);
        mouth.setAttribute('rx', 38 - v.round * 12 + v.wide * 10); mouth.setAttribute('ry', 8 + m * 44); tongue.setAttribute('ry', 4 + m * 14); tongue.setAttribute('cy', 414 + m * 24);
      };
    },
  };

  RK.makeAvatar = (layer, avCfg, cfg) => {
    const width = avCfg.width || 860; const k = width / 600; const holder = h('div', { position: 'absolute', left: ((1080 - width) / 2) + 'px', top: (avCfg.top ?? (1920 - 760 * k + 130)) + 'px', width: width + 'px', height: (760 * k) + 'px' }, layer);
    const s = svg('svg', { viewBox: '0 0 600 760', width, height: 760 * k }, holder); s.style.overflow = 'visible';
    const g = svg('g', {}, s); const draw = (characters[avCfg.character] || characters.orb)(g, Object.assign({ shirt: cfg.colors.accent, shirtShade: cfg.colors.accent2 || cfg.colors.accent, led: cfg.colors.accent, body: cfg.colors.accent }, avCfg));
    return { update(t) { const m = smooth(t, RK.mouthAt(t)); draw(t, m, RK.visemeAt(t), RK.emphAt(t), blinkAt(t)); } };
  };
})();
