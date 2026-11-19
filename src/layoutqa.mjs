// Layout QA. The video is drawn as web pages that are pure functions of time, so "does anything clash" can be measured exactly
// instead of guessed from pixels: jump to a moment, find every visible piece of text, and test for overlap or spilling off screen.
// Checks run every 2 seconds (5 per 10s of video) and 0.5s into each beat (past the transition), at no model cost.
const COLLECT = () => {
  const root = document.getElementById('root'); const vw = window.innerWidth, vh = window.innerHeight; const items = [];
  const hidden = el => { let o = 1; for (let n = el; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return true; o *= +cs.opacity; if (n.dataset && n.dataset.qaIgnore != null) return true; } return o < 0.35; };
  const walk = el => {
    for (const c of el.children) walk(c);
    const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim().length); if (!own.length) return;
    if (hidden(el)) return;
    const rg = document.createRange(); let L = 1e9, T = 1e9, R = -1e9, B = -1e9;
    for (const n of own) { rg.selectNodeContents(n); for (const r of rg.getClientRects()) { if (r.width < 1 || r.height < 1) continue; L = Math.min(L, r.left); T = Math.min(T, r.top); R = Math.max(R, r.right); B = Math.max(B, r.bottom); } }
    if (L > R) return; const txt = own.map(n => n.textContent.trim()).join(' '); if (txt.length < 3 || /[\n]/.test(txt)) return; items.push({ text: own.map(n => n.textContent.trim()).join(' ').slice(0, 40), l: L, t: T, r: R, b: B, el });
  };
  walk(root);
  const issues = [];
  for (const a of items) {
    const w = a.r - a.l, h = a.b - a.t; const tol = Math.max(6, vw * 0.006);
    if (w > 20 && w <= vw * 1.05 && (a.l < -tol || a.r > vw + tol || a.t < -tol || a.b > vh + tol)) issues.push({ kind: 'offscreen', text: a.text });
  }
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j]; if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ix = Math.min(a.r, b.r) - Math.max(a.l, b.l), iy = Math.min(a.b, b.b) - Math.max(a.t, b.t); if (ix <= 0 || iy <= 0) continue;
    const small = Math.min((a.r - a.l) * (a.b - a.t), (b.r - b.l) * (b.b - b.t)); if (small < 60) continue;
    if ((ix * iy) / small > 0.2) issues.push({ kind: 'overlap', text: a.text + '  vs  ' + b.text });
  }
  return issues;
};

export function sampleTimes(beats, total) {
  const ts = new Set(); for (let t = 1; t < total; t += 2) ts.add(+t.toFixed(2));
  for (const b of beats) ts.add(+Math.min(total - 0.05, b.start + 0.5).toFixed(2));
  return [...ts].sort((a, b) => a - b);
}

/** @returns {{checked:number, issues:{t:number,kind:string,text:string}[], shots:string[]}} */
export async function checkLayout(page, beats, total, { shotDir, writeShot, max = 40 } = {}) {
  const issues = []; const shots = []; const times = sampleTimes(beats, total).slice(0, max);
  for (const t of times) {
    await page.evaluate(x => RK.seek(x), t); const found = await page.evaluate(COLLECT);
    if (found.length) { for (const f of found) issues.push({ t, ...f }); if (writeShot && shots.length < 6) { try { shots.push(await writeShot(t)); } catch {} } }
  }
  return { checked: times.length, issues, shots };
}
