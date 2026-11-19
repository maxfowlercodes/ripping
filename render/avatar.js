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
    const g = svg('g', {}, s); const draw = (characters[avCfg.character] || characters.founder)(g, Object.assign({ shirt: cfg.colors.accent, shirtShade: cfg.colors.accent2 || cfg.colors.accent, led: cfg.colors.accent, body: cfg.colors.accent }, avCfg));
    return { update(t) { const m = smooth(t, RK.mouthAt(t)); draw(t, m, RK.visemeAt(t), RK.emphAt(t), blinkAt(t)); } };
  };
})();
