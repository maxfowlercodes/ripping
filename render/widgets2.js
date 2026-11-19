// Additional widgets: chat, notify, donut, compare, timeline, browser, quote, price, stats
(function () {
  const RK = window.RK; const { h, svg, clamp, ease, fmt } = RK;
  const card = (box, cfg, extra) => h('div', Object.assign({ width: '900px', borderRadius: '40px', padding: '40px', boxSizing: 'border-box', background: cfg.colors.card || '#fff', color: cfg.colors.cardFg || '#0f172a', boxShadow: '0 30px 80px rgba(0,0,0,.28), 0 0 0 1px rgba(128,128,128,.14)', fontFamily: RK.FONT_STACK, position: 'relative' }, extra || {}), box);
  const stagger = (els, p, from = 0.08, span = 0.7) => els.forEach((el, i) => { const q = ease.out(clamp((p - from - i * (span / els.length)) / 0.14)); el.style.opacity = q; el.style.transform = `translateY(${(1 - q) * 34}px) scale(${0.94 + 0.06 * q})`; });

  RK.widgets.chat = (box, v, cfg) => {
    const C = cfg.colors; const wrap = h('div', { width: '900px', display: 'flex', flexDirection: 'column', gap: '18px', fontFamily: RK.FONT_STACK }, box);
    const bubbles = v.msgs.map(m => { const me = m.who === 'me'; const b = h('div', { alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '78%', padding: '24px 32px', borderRadius: '38px', borderBottomRightRadius: me ? '10px' : '38px', borderBottomLeftRadius: me ? '38px' : '10px', background: me ? C.accent : (C.card || '#fff'), color: me ? (C.keyFg || '#fff') : (C.cardFg || '#111'), fontSize: '42px', fontWeight: 600, lineHeight: 1.25, boxShadow: '0 10px 30px rgba(0,0,0,.18)', opacity: 0 }, wrap, m.text); return b; });
    return { update(p) { stagger(bubbles, p, 0.05, 0.75); } };
  };
  RK.widgets.notify = (box, v, cfg) => {
    const C = cfg.colors; const wrap = h('div', { width: '900px', display: 'flex', flexDirection: 'column', gap: '18px' }, box);
    const cards = v.items.map((it, i) => { const c = card(wrap, cfg, { padding: '26px 30px', borderRadius: '34px', display: 'flex', gap: '22px', alignItems: 'center', opacity: 0 });
      h('div', { width: '74px', height: '74px', borderRadius: '20px', background: ['#6366f1', '#22c55e', '#f59e0b', '#ef4444'][i % 4], color: '#fff', fontWeight: 900, fontSize: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }, c, it.app[0].toUpperCase());
      const col = h('div', { flex: 1 }, c); h('div', { fontSize: '26px', opacity: .55, fontWeight: 700 }, col, it.app + ' · now'); h('div', { fontSize: '38px', fontWeight: 800, marginTop: '2px' }, col, it.text); return c; });
    return { update(p) { stagger(cards, p, 0.05, 0.7); } };
  };
  RK.widgets.donut = (box, v, cfg) => {
    const C = cfg.colors; const c = card(box, cfg, { display: 'flex', alignItems: 'center', gap: '44px', padding: '44px' }); const R = 150, SW = 46, L = 2 * Math.PI * R;
    const s = svg('svg', { width: 400, height: 400, viewBox: '0 0 400 400' }, c); svg('circle', { cx: 200, cy: 200, r: R, fill: 'none', stroke: 'rgba(128,128,128,.2)', 'stroke-width': SW }, s);
    const arc = svg('circle', { cx: 200, cy: 200, r: R, fill: 'none', stroke: C.accent, 'stroke-width': SW, 'stroke-linecap': 'round', 'stroke-dasharray': `0 ${L}`, transform: 'rotate(-90 200 200)' }, s);
    const num = h('div', { position: 'absolute', left: '44px', top: '170px', width: '400px', textAlign: 'center', fontSize: '110px', fontWeight: 900, letterSpacing: '-0.04em' }, c, '0');
    const col = h('div', { flex: 1 }, c); h('div', { fontSize: '50px', fontWeight: 800, lineHeight: 1.15 }, col, v.label || ''); if (v.sub) h('div', { fontSize: '30px', opacity: .6, marginTop: '10px' }, col, v.sub);
    return { update(p) { const q = ease.out(clamp((p - 0.05) / 0.6)); arc.setAttribute('stroke-dasharray', `${L * (v.value / 100) * q} ${L}`); num.textContent = Math.round(v.value * q) + '%'; } };
  };
  RK.widgets.compare = (box, v, cfg) => {
    const C = cfg.colors; const wrap = h('div', { width: '900px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px' }, box);
    const mk = (side, bad) => { const c = card(wrap, cfg, { width: 'auto', padding: '40px 30px', textAlign: 'center', opacity: 0, background: bad ? 'rgba(239,68,68,.12)' : (C.card || '#fff'), boxShadow: bad ? '0 0 0 3px #ef444455' : `0 0 0 3px ${C.accent}88, 0 30px 80px rgba(0,0,0,.25)` });
      h('div', { fontSize: '28px', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 800, opacity: .6 }, c, side.label); h('div', { fontSize: '100px', fontWeight: 900, letterSpacing: '-0.04em', margin: '14px 0', color: bad ? '#ef4444' : C.accent }, c, side.big); h('div', { fontSize: '32px', fontWeight: 600, opacity: .8 }, c, side.text || ''); return c; };
    const a = mk(v.left, true), b = mk(v.right, false);
    return { update(p) { stagger([a, b], p, 0.05, 0.4); } };
  };
  RK.widgets.timeline = (box, v, cfg) => {
    const C = cfg.colors; const c = card(box, cfg, { padding: '40px 44px' }); const line = h('div', { position: 'absolute', left: '84px', top: '60px', bottom: '60px', width: '6px', borderRadius: '9px', background: 'rgba(128,128,128,.25)' }, c);
    const fill = h('div', { width: '100%', height: 0, borderRadius: '9px', background: C.accent }, line);
    const rows = v.items.map(it => { const r = h('div', { display: 'flex', gap: '34px', alignItems: 'center', padding: '24px 0', opacity: 0 }, c); h('div', { width: '44px', height: '44px', borderRadius: '50%', background: C.accent, border: '8px solid ' + (C.card || '#fff'), flex: 'none', zIndex: 1, marginLeft: '-1px' }, r); const col = h('div', {}, r); h('div', { fontSize: '26px', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: C.accent }, col, it.when); h('div', { fontSize: '44px', fontWeight: 800, lineHeight: 1.15 }, col, it.what); return r; });
    return { update(p) { stagger(rows, p, 0.06, 0.7); fill.style.height = (ease.inOut(clamp((p - 0.05) / 0.75)) * 100) + '%'; } };
  };
  RK.widgets.browser = (box, v, cfg) => {
    const f = h('div', { width: '900px', height: '640px', borderRadius: '30px', overflow: 'hidden', background: '#fff', boxShadow: '0 30px 80px rgba(0,0,0,.4)', position: 'relative' }, box);
    const top = h('div', { height: '70px', background: '#e5e7eb', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 24px' }, f); ['#ef4444', '#f59e0b', '#22c55e'].forEach(x => h('div', { width: '18px', height: '18px', borderRadius: '50%', background: x }, top)); h('div', { flex: 1, margin: '0 18px', background: '#fff', borderRadius: '99px', padding: '8px 22px', fontSize: '24px', color: '#475569', fontFamily: 'ui-monospace,Menlo,Consolas,monospace' }, top, (v.url || '').replace(/^https?:\/\//, '').slice(0, 40));
    const view = h('div', { position: 'absolute', left: 0, right: 0, top: '70px', bottom: 0, overflow: 'hidden' }, f); const img = h('img', { width: '100%', position: 'absolute', left: 0, top: 0 }, view); img.src = v.src;
    return { update(p) { img.style.transform = `translateY(${-p * 14}%) scale(${1 + 0.04 * p})`; } };
  };
  RK.widgets.quote = (box, v, cfg) => {
    const C = cfg.colors; const c = card(box, cfg, { padding: '56px 52px' }); h('div', { fontSize: '200px', lineHeight: .6, color: C.accent, fontWeight: 900, height: '90px' }, c, '“'); const q = h('div', { fontSize: '54px', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em' }, c, v.text);
    const by = h('div', { marginTop: '30px', fontSize: '32px', fontWeight: 700, opacity: .65 }, c, v.who ? '— ' + v.who : ''); return { update(p) { const e = ease.out(clamp(p / 0.3)); q.style.opacity = e; by.style.opacity = clamp((p - 0.3) / 0.2); } };
  };
  RK.widgets.price = (box, v, cfg) => {
    const C = cfg.colors; const c = card(box, cfg, { textAlign: 'center', padding: '56px 40px' }); if (v.badge) h('div', { display: 'inline-block', padding: '8px 22px', borderRadius: '99px', background: C.accent, color: C.keyFg || '#fff', fontWeight: 900, fontSize: '28px', marginBottom: '18px' }, c, v.badge);
    const row = h('div', { display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '16px' }, c); const num = h('div', { fontSize: '230px', fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1 }, row, v.price); h('div', { fontSize: '52px', fontWeight: 700, opacity: .6 }, row, v.per || '');
    const was = v.was ? h('div', { fontSize: '48px', fontWeight: 700, opacity: .5, textDecoration: 'line-through', marginTop: '10px' }, c, v.was) : null; return { update(p) { const e = ease.back(clamp(p / 0.3)); num.style.transform = `scale(${0.6 + 0.4 * e})`; if (was) was.style.opacity = clamp((p - 0.3) / 0.2) * 0.5; } };
  };
  RK.widgets.stats = (box, v, cfg) => {
    const C = cfg.colors; const wrap = h('div', { width: '900px', display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, v.items.length)}, 1fr)`, gap: '22px' }, box);
    const cells = v.items.map(it => { const c = card(wrap, cfg, { width: 'auto', padding: '38px 20px', textAlign: 'center', opacity: 0 }); const n = h('div', { fontSize: '90px', fontWeight: 900, letterSpacing: '-0.04em', color: C.accent, lineHeight: 1 }, c, it.value); h('div', { fontSize: '30px', fontWeight: 700, opacity: .7, marginTop: '10px' }, c, it.label); return c; });
    return { update(p) { stagger(cells, p, 0.05, 0.45); } };
  };
})();
