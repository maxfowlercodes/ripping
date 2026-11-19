// Reelkit stage runtime. Deterministic: every frame is a pure function of time t (seconds).
(function () {
  const RK = (window.RK = { styles: {}, widgets: {}, spec: null, inst: null });
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const ease = {
    lin: t => t,
    out: t => 1 - Math.pow(1 - t, 3),
    inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    back: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  };
  const h = (tag, css, parent, text) => {
    const e = document.createElement(tag);
    if (css) Object.assign(e.style, css);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };
  const svg = (tag, attrs, parent) => {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const fmt = n => Math.round(n).toLocaleString('en-US');
  Object.assign(RK, { clamp, ease, h, svg, fmt });

  RK.registerStyle = (name, def) => { RK.styles[name] = def; };
  RK.FONT_STACK = "'Inter','Segoe UI','SF Pro Display','Helvetica Neue',Arial,'Noto Sans','Noto Sans JP','Noto Sans KR','Noto Sans SC','Noto Sans Devanagari','Noto Sans Hebrew','Noto Sans Arabic',system-ui,sans-serif";

  RK.beatAt = t => {
    const bs = RK.spec.beats;
    for (let i = 0; i < bs.length; i++) if (t < bs[i].end) return i;
    return bs.length - 1;
  };

  // Resolve a style definition by following "extends".
  RK.resolve = name => {
    let def = RK.styles[name] || RK.styles['aurora-dark'];
    const chain = [];
    while (def) { chain.unshift(def); def = def.extends ? RK.styles[def.extends] : null; }
    const out = {};
    for (const d of chain) { for (const k in d) { if (k === 'colors') out.colors = Object.assign({}, out.colors, d.colors); else out[k] = d[k]; } }
    return out;
  };

  RK.setScale = k => { document.getElementById('root').style.transform = `scale(${k})`; };

  // spec: {style, beats:[{text, start, end, words:[{t,s,e,key}], visual}], total, rtl, colors?}
  RK.setup = async spec => {
    RK.spec = spec;
    const root = document.getElementById('root');
    root.innerHTML = '';
    root.dir = spec.rtl ? 'rtl' : 'ltr';
    const cfg = RK.resolve(spec.style);
    if (spec.colors) cfg.colors = Object.assign({}, cfg.colors, spec.colors);
    RK.cfg = cfg;
    RK.inst = cfg.build ? cfg.build(root, spec, cfg, RK) : RK.engine(root, spec, cfg);
    const imgs = [...root.querySelectorAll('img')];
    await Promise.all(imgs.map(i => (i.decode ? i.decode().catch(() => {}) : Promise.resolve())));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    return true;
  };
  RK.seek = t => { RK.inst.frame(t); return true; };

  // ---------------------------------------------------------------- engine
  RK.engine = (root, spec, cfg) => {
    const C = cfg.colors;
    const W = 1080, H = 1920;
    const bg = h('div', { position: 'absolute', inset: 0, background: C.bg1 }, root);
    const bgUpdate = (RK.backgrounds[cfg.bg] || RK.backgrounds.gradient)(bg, cfg, C);
    const widgetLayer = h('div', { position: 'absolute', left: 0, top: 0, width: W + 'px', height: H + 'px' }, root);
    const capLayer = h('div', { position: 'absolute', left: 0, top: 0, width: W + 'px', height: H + 'px' }, root);
    const bar = cfg.progressBar === false ? null : h('div', { position: 'absolute', left: 0, top: 0, height: '8px', width: 0, background: C.accent, opacity: 0.9 }, root);
    const zones = cfg.zones || {};

    // --- build widgets & captions per beat
    const beats = spec.beats.map((b, i) => {
      const hasVis = b.visual && b.visual.type && b.visual.type !== 'none';
      const capBox = h('div', {
        position: 'absolute', left: '90px', width: '900px',
        top: (hasVis ? (zones.capTop ?? 170) : (zones.capTopFree ?? 560)) + 'px',
        height: (hasVis ? (zones.capH ?? 620) : (zones.capHFree ?? 800)) + 'px',
        display: 'flex', alignItems: cfg.caption.valign || 'center', justifyContent: cfg.caption.align === 'left' ? 'flex-start' : 'center',
        opacity: 0,
      }, capLayer);
      const line = h('div', {
        display: 'block', width: '100%', textAlign: cfg.caption.align || 'center', fontFamily: cfg.font + ',' + RK.FONT_STACK,
        fontWeight: cfg.caption.weight || 800, fontSize: ((hasVis ? cfg.caption.sizeVis : cfg.caption.size) || 84) + 'px',
        lineHeight: cfg.caption.lh || 1.12, color: C.fg, letterSpacing: cfg.caption.ls || '-0.02em',
        textTransform: cfg.caption.upper ? 'uppercase' : 'none', textShadow: cfg.caption.shadow || 'none', wordBreak: 'break-word',
      }, capBox);
      const words = b.words.map(w => {
        const sp = h('span', { display: 'inline-block', opacity: 0, margin: ['ja', 'zh', 'th'].includes(spec.lang) ? '0' : '0 .11em', padding: '0 .06em', borderRadius: '.14em', whiteSpace: 'pre' }, line, w.t);
        if (w.key) {
          const ke = cfg.key || 'highlight';
          if (ke === 'highlight') { sp.style.backgroundImage = `linear-gradient(${C.accent},${C.accent})`; sp.style.backgroundRepeat = 'no-repeat'; sp.style.backgroundSize = '0% 100%'; sp.style.backgroundPosition = spec.rtl ? 'right' : 'left'; sp.dataset.ke = 'h'; }
          else if (ke === 'gradient') { sp.style.backgroundImage = `linear-gradient(90deg,${C.accent},${C.accent2 || C.accent})`; sp.style.webkitBackgroundClip = 'text'; sp.style.backgroundClip = 'text'; sp.style.color = 'transparent'; sp.style.webkitTextFillColor = 'transparent'; sp.dataset.ke = 'g'; }
          else if (ke === 'underline') { sp.style.color = C.accent; sp.style.boxShadow = `inset 0 -.12em 0 ${C.accent}`; sp.dataset.ke = 'u'; }
          else { sp.style.color = C.accent; sp.dataset.ke = 'c'; }
        }
        return { w, sp };
      });
      let wd = null;
      if (hasVis) {
        const box = h('div', {
          position: 'absolute', left: '90px', width: '900px', top: (zones.visTop ?? 800) + 'px', height: (zones.visH ?? 760) + 'px',
          opacity: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }, widgetLayer);
        const W_ = RK.widgets[b.visual.type] || RK.widgets.big;
        wd = { box, api: W_(box, b.visual, cfg, RK) };
      }
      return { b, capBox, words, wd };
    });

    let lastKeyColor = C.keyFg || C.bg1;
    const frame = t => {
      bgUpdate(t);
      const i = RK.beatAt(t);
      if (bar) bar.style.width = (clamp(t / spec.total) * W) + 'px';
      beats.forEach((o, j) => {
        const b = o.b;
        const active = j === i;
        const local = t - b.start, dur = b.end - b.start;
        // caption box
        if (!active) { o.capBox.style.opacity = 0; if (o.wd) o.wd.box.style.opacity = 0; return; }
        const outP = clamp((b.end - t) / 0.12);
        o.capBox.style.opacity = outP;
        const mode = cfg.caption.mode || 'words';
        o.words.forEach(({ w, sp }, k) => {
          let p, vis = 1;
          if (mode === 'oneword') {
            const on = t >= w.s && (k === o.words.length - 1 ? true : t < o.words[k + 1].w.s);
            vis = on ? 1 : 0; p = clamp((t - w.s) / 0.12);
            sp.style.display = on ? 'inline-block' : 'none';
          } else if (mode === 'block') {
            p = clamp(local / 0.3); vis = 1;
          } else {
            p = clamp((t - w.s) / 0.16); vis = t >= w.s - 0.001 ? 1 : 0;
          }
          const e = ease.back(p);
          sp.style.opacity = vis ? clamp(p * 1.6) : 0;
          const sc = mode === 'oneword' ? 0.8 + 0.2 * e : 0.7 + 0.3 * e;
          sp.style.transform = `translateY(${(1 - e) * 26}px) scale(${sc})`;
          const ke = sp.dataset.ke;
          if (ke === 'h') { const kp = ease.out(clamp((t - w.s - 0.05) / 0.28)); sp.style.backgroundSize = (kp * 100) + '% 100%'; sp.style.color = kp > 0.4 ? lastKeyColor : ''; }
        });
        // widget
        if (o.wd) {
          const inP = ease.out(clamp(local / 0.4));
          o.wd.box.style.opacity = clamp(inP * outP * 1.2);
          o.wd.box.style.transform = `translateY(${(1 - inP) * 90}px) scale(${0.96 + 0.04 * inP})`;
          o.wd.api.update(clamp(local / dur), t, local);
        }
      });
    };
    return { frame };
  };

  RK.backgrounds = {
    gradient(layer, cfg, C) {
      const e = RK.h('div', { position: 'absolute', inset: 0 }, layer);
      return t => { e.style.background = `linear-gradient(${160 + Math.sin(t * 0.4) * 18}deg,${C.bg1},${C.bg2})`; };
    },
    ribbon(layer, cfg, C) {
      layer.style.background = C.bg1;
      const r = RK.h('div', { position: 'absolute', left: '-40%', top: '-10%', width: '180%', height: '46%', background: `linear-gradient(100deg,${C.bg2},${C.ribbon1 || C.accent},${C.ribbon2 || C.accent2 || C.accent})`, borderRadius: '50%', opacity: 0.9 }, layer);
      const r2 = RK.h('div', { position: 'absolute', left: '-30%', top: '62%', width: '160%', height: '40%', background: `linear-gradient(80deg,${C.ribbon2 || C.bg2},${C.bg1})`, borderRadius: '50%', opacity: 0.85 }, layer);
      return t => { r.style.transform = `rotate(${-8 + Math.sin(t * 0.5) * 3}deg) translateY(${Math.sin(t * 0.6) * 30}px)`; r2.style.transform = `rotate(${6 + Math.cos(t * 0.4) * 3}deg) translateX(${Math.sin(t * 0.3) * 40}px)`; };
    },
    rim(layer, cfg, C) {
      layer.style.background = C.bg1;
      const a = RK.h('div', { position: 'absolute', left: '-30%', top: '-18%', width: '160%', height: '40%', borderRadius: '50%', background: C.bg1, boxShadow: `0 0 0 4px ${C.accent}55, 0 -10px 120px 20px ${C.accent2 || C.accent}66, inset 0 -30px 80px ${C.accent}33` }, layer);
      const g = RK.h('div', { position: 'absolute', inset: 0, background: `radial-gradient(60% 40% at 50% 12%, ${C.bg2}, transparent 70%)` }, layer);
      return t => { a.style.transform = `translateY(${Math.sin(t * 0.7) * 14}px)`; g.style.opacity = 0.8 + 0.2 * Math.sin(t); };
    },
    dots(layer, cfg, C) {
      layer.style.background = `linear-gradient(180deg,${C.bg1},${C.bg2})`;
      const d = RK.h('div', { position: 'absolute', inset: '-60px', backgroundImage: `radial-gradient(${C.dot || '#00000022'} 3px, transparent 3.5px)`, backgroundSize: '54px 54px' }, layer);
      return t => { d.style.transform = `translate(${(t * 6) % 54}px,${(t * 6) % 54}px)`; };
    },
    grid(layer, cfg, C) {
      layer.style.background = `linear-gradient(180deg,${C.bg1},${C.bg2})`;
      const d = RK.h('div', { position: 'absolute', inset: '-80px', backgroundImage: `linear-gradient(${C.dot || '#ffffff14'} 2px,transparent 2px),linear-gradient(90deg,${C.dot || '#ffffff14'} 2px,transparent 2px)`, backgroundSize: '80px 80px' }, layer);
      const v = RK.h('div', { position: 'absolute', inset: 0, background: `radial-gradient(70% 50% at 50% 40%, transparent, ${C.bg1})` }, layer);
      return t => { d.style.transform = `translate(0,${(t * 14) % 80}px)`; };
    },
    scan(layer, cfg, C) {
      layer.style.background = `linear-gradient(180deg,${C.bg1},${C.bg2})`;
      const s = RK.h('div', { position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg,rgba(0,0,0,.28) 0,rgba(0,0,0,.28) 3px,transparent 3px,transparent 7px)', mixBlendMode: 'multiply' }, layer);
      const band = RK.h('div', { position: 'absolute', left: 0, right: 0, height: '220px', background: 'linear-gradient(transparent,rgba(255,255,255,.07),transparent)' }, layer);
      return t => { band.style.top = ((t * 260) % 2300 - 300) + 'px'; };
    },
    news(layer, cfg, C) {
      layer.style.background = `linear-gradient(180deg,${C.bg1},${C.bg2})`;
      RK.h('div', { position: 'absolute', left: 0, right: 0, top: '1500px', height: '150px', background: C.accent }, layer);
      const tick = RK.h('div', { position: 'absolute', left: 0, top: '1560px', whiteSpace: 'nowrap', fontFamily: RK.FONT_STACK, fontWeight: 900, fontSize: '54px', color: C.keyFg || '#111', textTransform: 'uppercase' }, layer, (cfg.ticker || 'BREAKING • LIVE • UPDATE • ').repeat(12));
      return t => { tick.style.transform = `translateX(${-(t * 180) % 1800}px)`; };
    },
    paper(layer, cfg, C) {
      layer.style.background = `radial-gradient(90% 60% at 50% 35%,${C.bg2},${C.bg1})`;
      const s = RK.h('div', { position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg,rgba(0,0,0,.025) 0,rgba(0,0,0,.025) 2px,transparent 2px,transparent 6px)' }, layer);
      return () => {};
    },
    swiss(layer, cfg, C) {
      layer.style.background = C.bg1;
      const a = RK.h('div', { position: 'absolute', left: 0, top: 0, width: '100%', height: '130px', background: C.accent }, layer);
      const c = RK.h('div', { position: 'absolute', right: '-160px', bottom: '-160px', width: '640px', height: '640px', borderRadius: '50%', background: C.bg2 }, layer);
      return t => { c.style.transform = `scale(${1 + 0.06 * Math.sin(t * 0.9)})`; };
    },
    flat(layer, cfg, C) { layer.style.background = C.bg1; return () => {}; },
  };

  // key-word heuristics: *marked* words, else numbers/$/% and the longest word.
  RK.markKeys = words => {
    if (words.some(w => w.key)) return words;
    const idx = [];
    words.forEach((w, i) => { if (/[\d$%]/.test(w.t)) idx.push(i); });
    if (!idx.length && words.length > 2) { let best = 0; words.forEach((w, i) => { if (w.t.length > words[best].t.length) best = i; }); idx.push(best); }
    idx.slice(0, 2).forEach(i => (words[i].key = true));
    return words;
  };

  // Carousel slides (1080x1350), same style system.
  RK.carousel = async (spec) => {
    const cfg = RK.resolve(spec.style); if (spec.colors) cfg.colors = Object.assign({}, cfg.colors, spec.colors);
    const C = cfg.colors; const root = document.getElementById('root');
    root.style.width = '1080px'; root.style.height = '1350px'; root.dir = spec.rtl ? 'rtl' : 'ltr';
    RK.slides = spec.slides;
    RK.showSlide = i => {
      root.innerHTML = '';
      const s = spec.slides[i];
      const bgl = RK.h('div', { position: 'absolute', inset: 0 }, root);
      (RK.backgrounds[cfg.bg] || RK.backgrounds.gradient)(bgl, cfg, C)(3);
      const f = cfg.font + ',' + RK.FONT_STACK;
      if (s.kind === 'cover') {
        RK.h('div', { position: 'absolute', left: '80px', top: '90px', fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: '34px', letterSpacing: '.18em', color: C.accent, fontWeight: 700 }, root, 'SWIPE →');
        RK.h('div', { position: 'absolute', left: '80px', right: '80px', bottom: '150px', fontFamily: f, fontWeight: 900, fontSize: '110px', lineHeight: 1.04, color: C.fg, letterSpacing: '-0.03em', textTransform: cfg.caption.upper ? 'uppercase' : 'none' }, root, s.text);
      } else if (s.kind === 'cta') {
        RK.h('div', { position: 'absolute', left: '80px', right: '80px', top: '300px', fontFamily: f, fontWeight: 900, fontSize: '92px', lineHeight: 1.08, color: C.fg, letterSpacing: '-0.03em' }, root, s.text);
        RK.h('div', { position: 'absolute', left: '80px', bottom: '110px', padding: '26px 44px', borderRadius: '99px', background: C.accent, color: C.keyFg || C.bg1, fontFamily: f, fontWeight: 800, fontSize: '40px' }, root, s.button || 'Follow for more');
      } else {
        RK.h('div', { position: 'absolute', left: '80px', top: '70px', fontFamily: f, fontWeight: 900, fontSize: '260px', color: C.accent, lineHeight: 1 }, root, String(s.n));
        RK.h('div', { position: 'absolute', left: '80px', right: '80px', top: '420px', fontFamily: f, fontWeight: 800, fontSize: '82px', lineHeight: 1.12, color: C.fg, letterSpacing: '-0.02em' }, root, s.text);
      }
      RK.h('div', { position: 'absolute', right: '70px', bottom: '60px', fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: '30px', color: C.muted || C.fg, opacity: 0.7 }, root, (i + 1) + '/' + spec.slides.length);
      return true;
    };
    return true;
  };
})();
