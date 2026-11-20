// Visual widgets. Each: (box, vis, cfg, RK) -> {update(p, t, local)} where p = beat progress 0..1
(function () {
  const RK = window.RK; const { h, svg, clamp, ease, fmt } = RK;
  const PALETTE = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#ec4899', '#84cc16'];
  const card = (box, cfg, extra) => h('div', Object.assign({
    width: '900px', borderRadius: '40px', padding: '44px', boxSizing: 'border-box', background: cfg.colors.card || '#fff',
    color: cfg.colors.cardFg || '#0f172a', boxShadow: '0 30px 80px rgba(0,0,0,.28), 0 0 0 1px rgba(128,128,128,.14)',
    fontFamily: RK.FONT_STACK, position: 'relative',
  }, cfg.glass ? { backdropFilter: 'blur(26px) saturate(1.4)', WebkitBackdropFilter: 'blur(26px) saturate(1.4)', boxShadow: '0 20px 60px rgba(0,0,0,.25), inset 0 0 0 1.5px rgba(255,255,255,.28)' } : {}, extra || {}), box);
  const curve = (pts, w, hh) => {
    const mn = Math.min(...pts), mx = Math.max(...pts), rg = mx - mn || 1;
    const xy = pts.map((v, i) => [(i / (pts.length - 1)) * w, hh - 14 - ((v - mn) / rg) * (hh - 30)]);
    let d = `M${xy[0][0]},${xy[0][1]}`;
    for (let i = 1; i < xy.length; i++) { const [x0, y0] = xy[i - 1], [x1, y1] = xy[i]; const cx = (x0 + x1) / 2; d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`; }
    return { d, xy };
  };
  const shapes = { up: [2, 3, 3, 4, 6, 9, 15, 26, 40, 62], down: [60, 52, 44, 30, 22, 14, 9, 6, 4, 3], s: [2, 2, 3, 5, 12, 30, 52, 62, 66, 68], flat: [10, 11, 10, 12, 11, 12, 11, 12, 12, 12] };

  function chart(parent, cfg, pts, w, hh, color) {
    const s = svg('svg', { width: w, height: hh, viewBox: `0 0 ${w} ${hh}` }, parent); s.style.display = 'block'; s.style.overflow = 'visible';
    const { d, xy } = curve(pts, w, hh);
    const gid = 'g' + Math.floor(Math.random() * 1e6);
    const defs = svg('defs', {}, s);
    const lg = svg('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    svg('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': 0.35 }, lg); svg('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': 0 }, lg);
    const clipId = 'c' + gid; const cp = svg('clipPath', { id: clipId }, defs); const cr = svg('rect', { x: 0, y: -20, width: 0, height: hh + 40 }, cp);
    const g = svg('g', { 'clip-path': `url(#${clipId})` }, s);
    svg('path', { d: d + ` L${w},${hh} L0,${hh} Z`, fill: `url(#${gid})` }, g);
    svg('path', { d, fill: 'none', stroke: color, 'stroke-width': 7, 'stroke-linecap': 'round' }, g);
    const dot = svg('circle', { r: 11, fill: color, stroke: '#fff', 'stroke-width': 4 }, s);
    const path = s.querySelectorAll('path')[1];
    return p => {
      const e = ease.inOut(clamp(p)); cr.setAttribute('width', e * w);
      const len = path.getTotalLength(); const pt = path.getPointAtLength(len * e); dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y); dot.style.opacity = e > 0.02 ? 1 : 0;
    };
  }

  RK.widgets.counter = (box, v, cfg) => {
    const C = cfg.colors; const c = card(box, cfg);
    const top = h('div', { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '30px', fontSize: '26px', fontWeight: 700, opacity: 0.8 }, c);
    h('div', { width: '30px', height: '30px', borderRadius: '9px', background: C.accent }, top);
    h('div', {}, top, v.app || 'Dashboard');
    const tabs = h('div', { marginLeft: 'auto', display: 'flex', gap: '12px', fontSize: '22px', fontWeight: 600 }, top);
    ['Overview', 'Customers', 'Revenue'].forEach((t, i) => h('div', { padding: '6px 14px', borderRadius: '99px', background: i === 0 ? (C.accent + '22') : 'transparent', color: i === 0 ? C.accent : 'inherit', opacity: i === 0 ? 1 : 0.55 }, tabs, t));
    h('div', { fontSize: '26px', letterSpacing: '.14em', textTransform: 'uppercase', opacity: 0.6, fontWeight: 700 }, c, v.label || 'TOTAL');
    const row = h('div', { display: 'flex', alignItems: 'center', gap: '22px', margin: '8px 0 24px' }, c);
    const num = h('div', { fontSize: '190px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }, row, '0');
    if (v.delta) h('div', { padding: '8px 18px', borderRadius: '99px', background: '#22c55e22', color: '#16a34a', fontWeight: 800, fontSize: '30px' }, row, v.delta);
    const chartBox = h('div', {}, c); const upd = chart(chartBox, cfg, v.points || shapes.s, 812, 240, C.accent);
    const lab = h('div', { display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '20px', opacity: 0.5, fontWeight: 700, letterSpacing: '.1em' }, c);
    ['WEEK 1', 'WEEK 2', 'WEEK 3', 'WEEK 4'].forEach(x => h('span', {}, lab, x));
    return { update(p) { num.textContent = (v.prefix || '') + fmt(v.value * ease.out(clamp((p - 0.05) / 0.6))) + (v.suffix || ''); upd(clamp((p - 0.05) / 0.7)); } };
  };

  RK.widgets.chart = (box, v, cfg) => {
    const C = cfg.colors; const c = card(box, cfg);
    if (v.title) h('div', { fontSize: '34px', fontWeight: 800, marginBottom: '18px' }, c, v.title);
    const upd = chart(c, cfg, v.points || shapes[v.shape] || shapes.up, 812, 520, v.shape === 'down' ? '#ef4444' : C.accent);
    return { update(p) { upd(clamp((p - 0.05) / 0.75)); } };
  };

  RK.widgets.bars = (box, v, cfg) => {
    const C = cfg.colors; const c = card(box, cfg, { padding: '40px 44px' });
    h('div', { fontSize: '24px', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 800, opacity: 0.6, marginBottom: '20px' }, c, v.title || '');
    const items = v.items; const mx = Math.max(...items.map(i => Math.max(i.to, i.from || 0)));
    const RH = 112; const wrap = h('div', { position: 'relative', height: (items.length * RH) + 'px' }, c);
    const rows = items.map((it, k) => {
      const r = h('div', { position: 'absolute', left: 0, right: 0, height: '92px', display: 'flex', alignItems: 'center', gap: '18px' }, wrap);
      h('div', { width: '62px', height: '62px', borderRadius: '18px', background: PALETTE[k % PALETTE.length], color: '#fff', fontWeight: 900, fontSize: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }, r, it.name[0].toUpperCase());
      const col = h('div', { flex: 1 }, r);
      h('div', { fontSize: '28px', fontWeight: 700, marginBottom: '6px' }, col, it.name);
      const track = h('div', { height: '30px', borderRadius: '99px', background: 'rgba(128,128,128,.16)', overflow: 'hidden' }, col);
      const fill = h('div', { height: '100%', width: 0, borderRadius: '99px', background: PALETTE[k % PALETTE.length] }, track);
      const val = h('div', { fontSize: '38px', fontWeight: 900, width: '150px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }, r);
      return { r, fill, val, it };
    });
    return { update(p) {
      const e = ease.inOut(clamp((p - 0.05) / 0.75));
      const vals = rows.map(o => (o.it.from || 0) + (o.it.to - (o.it.from || 0)) * e);
      rows.forEach((o, i) => {
        o.fill.style.width = (vals[i] / mx * 100) + '%'; o.val.textContent = (Math.round(vals[i] * 10) / 10) + (v.unit || '');
        let rank = 0; vals.forEach((x, j) => { if (j !== i) rank += 1 / (1 + Math.exp(-(x - vals[i]) / (mx * 0.035))); });
        o.r.style.top = (rank * RH) + 'px';
      });
    } };
  };

  RK.widgets.tier = (box, v, cfg) => {
    const c = card(box, cfg, { padding: '30px' }); const COL = { S: '#ef4444', A: '#f59e0b', B: '#eab308', C: '#22c55e', D: '#06b6d4', F: '#64748b' };
    const rows = v.rows.map(r => {
      const row = h('div', { display: 'flex', alignItems: 'stretch', gap: '14px', margin: '10px 0', minHeight: '110px' }, c);
      h('div', { width: '110px', borderRadius: '18px', background: COL[r.tier] || '#6366f1', color: '#fff', fontWeight: 900, fontSize: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }, row, r.tier);
      const area = h('div', { flex: 1, display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', background: 'rgba(128,128,128,.1)', borderRadius: '18px', padding: '10px 14px' }, row);
      return r.items.map(n => h('div', { padding: '12px 22px', borderRadius: '14px', background: cfg.colors.accent, color: cfg.colors.keyFg || '#fff', fontWeight: 800, fontSize: '32px', opacity: 0 }, area, n));
    }).flat();
    return { update(p) { rows.forEach((el, i) => { const q = ease.back(clamp((p - 0.1 - i * (0.6 / rows.length)) / 0.12)); el.style.opacity = clamp(q * 2); el.style.transform = `scale(${0.6 + 0.4 * q})`; }); } };
  };

  RK.widgets.code = (box, v, cfg) => {
    const c = h('div', { width: '900px', borderRadius: '32px', background: '#0b1020', color: '#d1fae5', boxShadow: '0 30px 80px rgba(0,0,0,.4)', overflow: 'hidden', fontFamily: "ui-monospace,'Cascadia Code',Menlo,Consolas,monospace" }, box);
    const bar = h('div', { display: 'flex', gap: '12px', padding: '22px 26px', background: '#141b33' }, c);
    ['#ef4444', '#f59e0b', '#22c55e'].forEach(x => h('div', { width: '22px', height: '22px', borderRadius: '50%', background: x }, bar));
    const body = h('div', { padding: '36px', fontSize: '44px', lineHeight: 1.4, minHeight: '300px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }, c);
    return { update(p) { const n = Math.floor(v.text.length * clamp((p - 0.05) / 0.6)); body.textContent = '$ ' + v.text.slice(0, n) + (Math.floor(p * 14) % 2 ? '▌' : ' '); } };
  };

  RK.widgets.list = (box, v, cfg) => {
    const c = card(box, cfg, { padding: '34px 40px' });
    const items = v.items.map(t => { const r = h('div', { display: 'flex', alignItems: 'center', gap: '24px', padding: '22px 0', borderBottom: '1px solid rgba(128,128,128,.18)', opacity: 0 }, c);
      h('div', { width: '54px', height: '54px', borderRadius: '50%', background: cfg.colors.accent, color: cfg.colors.keyFg || '#fff', fontWeight: 900, fontSize: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }, r, '✓');
      h('div', { fontSize: '44px', fontWeight: 700 }, r, t); return r; });
    return { update(p) { items.forEach((el, i) => { const q = ease.out(clamp((p - 0.08 - i * (0.65 / items.length)) / 0.14)); el.style.opacity = q; el.style.transform = `translateX(${(1 - q) * -50}px)`; }); } };
  };

  RK.widgets.big = (box, v, cfg) => {
    const e = h('div', { fontFamily: RK.FONT_STACK, fontWeight: 900, fontSize: '240px', letterSpacing: '-0.05em', color: cfg.colors.accent, textAlign: 'center', lineHeight: 1 }, box, v.text);
    return { update(p) { const q = ease.back(clamp(p / 0.25)); e.style.transform = `scale(${0.5 + 0.5 * q})`; } };
  };

  RK.widgets.photo = (box, v, cfg) => { // a real photo, softly zoomed (Ken Burns), rounded card
    const f = h('div', { width: '700px', height: cfg.compact ? '440px' : '540px', borderRadius: '48px', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,.38)', position: 'relative', background: '#111' }, box);
    const img = h('img', { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover', transformOrigin: '50% 40%' }, f); img.src = v.src;
    h('div', { position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,.28))' }, f);
    return { update(p) { img.style.transform = `scale(${1.04 + 0.12 * p}) translate(${(p - 0.5) * -2}%, ${(p - 0.5) * -2}%)`; } };
  };
  RK.widgets.image = (box, v, cfg) => {
    const f = h('div', { width: '520px', height: '740px', borderRadius: '54px', border: '12px solid #0b0b0f', boxShadow: '0 30px 80px rgba(0,0,0,.4)', overflow: 'hidden', background: '#fff', position: 'relative' }, box);
    const img = h('img', { width: '100%', position: 'absolute', left: 0, top: 0, transformOrigin: '50% 0' }, f); img.src = v.src;
    return { update(p) { img.style.transform = `scale(${1 + 0.1 * p}) translateY(${-p * (v.pan ?? 8)}%)`; } };
  };
})();
