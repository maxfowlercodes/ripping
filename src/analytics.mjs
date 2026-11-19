import { listReels, getMeta, saveMeta, scriptPath } from './store.mjs';
import { mediaInsights } from './instagram.mjs';
import { readInsights } from './computer.mjs';
import { parseScript, lint } from './script.mjs';
import fs from 'node:fs';

export const MILESTONES = [0.04, 1, 3, 7, 14, 30]; // days after posting
export const RANKS = [['Rookie', 0], ['Rising', 1e3], ['Regular', 1e4], ['Creator', 5e4], ['Climber', 1e5], ['Pro', 5e5], ['Star', 1e6], ['Headliner', 5e6], ['Legend', 2.5e7], ['Mogul', 5e7], ['Icon', 1e8]];
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
export const ageDays = m => (Date.now() - new Date(m.postedAt)) / 864e5;

export function latest(m) { return m.snapshots?.[m.snapshots.length - 1] || null; }
/** Views at day d (closest snapshot taken at or before d + 0.6 days). */
export function viewsAtDay(m, d) {
  if (!m.postedAt) return null; const p = new Date(m.postedAt); let best = null;
  for (const s of m.snapshots || []) { const a = (new Date(s.t) - p) / 864e5; if (a <= d + 0.6 && (!best || a > best.a)) best = { a, v: s.views }; }
  return best ? best.v : null;
}
export function rankFor(totalViews) { let r = 0; RANKS.forEach(([_, t], i) => { if (totalViews >= t) r = i; }); const next = RANKS[r + 1]; return { name: RANKS[r][0], index: r, total: totalViews, next: next ? { name: next[0], at: next[1] } : null }; }

export function summary() {
  const posted = listReels().filter(r => r.postedAt && (r.igMediaId || (r.snapshots || []).length));
  const rows = posted.map(r => { const s = latest(r); return { slug: r.slug, title: r.title, postedAt: r.postedAt, account: r.account, views: s?.views || 0, likes: s?.likes || 0, saves: s?.saved || 0, shares: s?.shares || 0, comments: s?.comments || 0, d1: viewsAtDay(r, 1), d3: viewsAtDay(r, 3), d7: viewsAtDay(r, 7), curve: (r.snapshots || []).map(x => ({ age: +((new Date(x.t) - new Date(r.postedAt)) / 864e5).toFixed(2), views: x.views })) }; });
  const med = median(rows.map(r => r.views));
  rows.forEach(r => { r.vsMedian = med ? +(r.views / med).toFixed(1) : null; r.winner = rows.length >= 3 ? r.views >= med * 1.5 && r.views === Math.max(...rows.map(x => x.views)) || r.vsMedian >= 2 : rows.length > 0 && r.views === Math.max(...rows.map(x => x.views)); });
  const total = rows.reduce((a, r) => a + r.views, 0);
  return { reels: rows.sort((a, b) => b.views - a.views), medianViews: med, totalViews: total, rank: rankFor(total) };
}

/** Take any snapshot that is due (call periodically). */
export async function snapshotDue(log = () => {}) {
  let n = 0;
  for (const r of listReels().filter(r => r.igMediaId && r.postedAt)) {
    const m = getMeta(r.slug); const age = ageDays(m); const taken = (m.snapshots || []).map(s => (new Date(s.t) - new Date(m.postedAt)) / 864e5);
    const due = MILESTONES.filter(d => age >= d && !taken.some(a => Math.abs(a - d) < Math.max(0.5, d * 0.3) && a >= d - 0.05)).length;
    if (!due && taken.length) continue;
    try { const ins = await mediaInsights(m.account, m.igMediaId); m.snapshots = [...(m.snapshots || []), { t: new Date().toISOString(), ...ins }]; saveMeta(r.slug, m); n++; log(`snapshot ${r.slug}: ${ins.views} views`); } catch (e) { log(`snapshot failed ${r.slug}: ${e.message}`); }
  }
  return n;
}

const spearman = (x, y) => { const rk = a => { const o = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = []; o.forEach(([_, i], k) => (r[i] = k)); return r; }; const a = rk(x), b = rk(y), n = x.length; const d2 = a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0); return 1 - (6 * d2) / (n * (n * n - 1)); };
/** Calibrate the heuristic against YOUR results: which checks actually predict views for your account. */
export function calibrate() {
  const rows = listReels().filter(r => r.igMediaId && latest(r)).map(r => { const l = lint(parseScript(fs.readFileSync(scriptPath(r.slug), 'utf8'))); return { l, views: latest(r).views }; });
  if (rows.length < 8) return { ready: false, have: rows.length, need: 8, note: 'Post at least 8 reels through reelkit, then run calibrate again.' };
  const views = rows.map(r => r.views);
  const overall = spearman(rows.map(r => r.l.score), views);
  const per = rows[0].l.checks.map(c => { const id = c.id; const x = rows.map(r => (r.l.checks.find(k => k.id === id).pass ? 1 : 0)); return { id, rho: new Set(x).size > 1 ? +spearman(x, views).toFixed(2) : null }; });
  return { ready: true, n: rows.length, overallRho: +overall.toFixed(2), perCheck: per, note: 'rho near +1 means passing that check goes with more views for you. Small samples are noisy.' };
}

/** Snapshots for reels posted via the browser (no API): one Claude computer-use call for ALL due reels. */
export async function snapshotDueWeb({ username, log = () => {} }) {
  const due = listReels().filter(r => r.postedVia === 'computer' && r.postedAt).filter(r => {
    const m = getMeta(r.slug); const age = ageDays(m); const taken = (m.snapshots || []).map(s => (new Date(s.t) - new Date(m.postedAt)) / 864e5);
    return MILESTONES.some(d => age >= d && !taken.some(a => a >= d - 0.05 && a < d + Math.max(0.5, d * 0.3)));
  });
  if (!due.length) return 0;
  const rows = await readInsights({ username, posts: due.map(r => ({ caption: (getMeta(r.slug).caption || r.title), postedAt: r.postedAt })), log });
  let n = 0;
  for (const r of due) { const cap = (getMeta(r.slug).caption || r.title).slice(0, 40).toLowerCase(); const hit = rows.find(x => cap.startsWith(String(x.match).slice(0, 30).toLowerCase()) || String(x.match).toLowerCase().startsWith(cap.slice(0, 30)));
    if (!hit) continue; const m = getMeta(r.slug); m.snapshots = [...(m.snapshots || []), { t: new Date().toISOString(), views: hit.views, likes: hit.likes, comments: hit.comments, shares: hit.shares, saved: hit.saves, source: 'web' }]; saveMeta(r.slug, m); n++; }
  return n;
}
