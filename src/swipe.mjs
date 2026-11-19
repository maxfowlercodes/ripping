// Swipe feed: collect winning reels in your niche, rank by "outlier multiplier", save the best.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { home, readJson, writeJson } from './util.mjs';
import { discoverCreator } from './instagram.mjs';

const file = () => path.join(home(), 'swipe.json');
const load = () => readJson(file(), { items: [] });
const save = d => writeJson(file(), d);
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
export const fmtViews = n => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n));

export function listSwipe(filter = {}) {
  let items = load().items;
  if (filter.status) items = items.filter(i => i.status === filter.status);
  if (filter.niche) items = items.filter(i => i.niche === filter.niche);
  return items.sort((a, b) => b.multiplier - a.multiplier);
}
export function addItem(it) {
  const d = load(); const id = it.id || crypto.createHash('sha1').update(it.url || it.caption || String(Math.random())).digest('hex').slice(0, 10);
  const base = it.baseline || it.followers || it.creatorMedian || 0;
  const rec = { id, url: it.url || '', creator: it.creator || '', caption: it.caption || '', views: Number(it.views) || 0, likes: Number(it.likes) || 0, comments: Number(it.comments) || 0,
    followers: Number(it.followers) || 0, thumb: it.thumb || '', niche: it.niche || 'general', note: it.note || '', source: it.source || 'manual', status: 'new', added: new Date().toISOString() };
  rec.multiplier = base ? +(rec.views / base).toFixed(1) : 0;
  const i = d.items.findIndex(x => x.id === id); if (i >= 0) { rec.status = d.items[i].status; d.items[i] = rec; } else d.items.push(rec);
  save(d); return rec;
}
export function decide(id, status) { const d = load(); const it = d.items.find(x => x.id === id); if (!it) throw new Error('no such item'); it.status = status; save(d); return it; }

export function importFile(f, niche) {
  const raw = fs.readFileSync(f, 'utf8'); let rows;
  if (f.endsWith('.json')) rows = JSON.parse(raw);
  else { const [h, ...ls] = raw.trim().split(/\r?\n/); const cols = h.split(',').map(s => s.trim().toLowerCase()); rows = ls.map(l => Object.fromEntries(l.match(/("[^"]*"|[^,]*)(,|$)/g).filter(Boolean).map((v, i) => [cols[i], v.replace(/,$/, '').trim().replace(/^"|"$/g, '')]))); }
  return rows.map(r => addItem({ ...r, niche: r.niche || niche, source: 'import' })).length;
}

/** Official Business Discovery. Needs a connected Instagram professional account; targets must be Business/Creator accounts. */
export async function discover(account, usernames, niche = 'general') {
  let n = 0;
  for (const u of usernames) {
    const bd = await discoverCreator(account, u.replace(/^@/, ''));
    const media = (bd.media?.data || []).filter(m => m.media_product_type === 'REELS' || m.media_type === 'VIDEO');
    const metric = m => m.view_count ?? (m.like_count || 0) * 20; // fall back to a likes-based estimate when views are hidden
    const med = median(media.map(metric));
    for (const m of media) {
      const views = metric(m);
      addItem({ id: m.id, url: m.permalink, creator: bd.username, caption: m.caption || '', views, likes: m.like_count, comments: m.comments_count, followers: bd.followers_count, creatorMedian: med || bd.followers_count, thumb: m.thumbnail_url || '', niche, source: 'discovery' }); n++;
    }
  }
  return n;
}

/** Paste-friendly intake: one reel per line:  url | views | baseline(optional) | caption (optional). Blank lines ignored. */
export function addFromText(text, niche = 'general') {
  let n = 0;
  for (const raw of String(text).split(/\r?\n/)) {
    const l = raw.trim(); if (!l) continue;
    const parts = l.split('|').map(x => x.trim()); const url = parts[0].match(/https?:\/\/\S+/)?.[0] || '';
    const num = x => { const m = String(x || '').toLowerCase().replace(/,/g, '').match(/([\d.]+)\s*([km])?/); return m ? Math.round(parseFloat(m[1]) * (m[2] === 'm' ? 1e6 : m[2] === 'k' ? 1e3 : 1)) : 0; };
    const creator = url.match(/instagram\.com\/([\w.]+)\//)?.[1] || '';
    const rec = addItem({ url, creator: creator === 'reel' || creator === 'p' ? '' : creator, views: num(parts[1]), baseline: num(parts[2]), caption: parts.slice(3).join(' | ') || (url ? '' : l), niche, source: 'paste' });
    decide(rec.id, 'saved'); n++;
  }
  return n;
}
