// Pexels photos for reels (free API key, https://www.pexels.com/api/). Used only when a script beat asks for {photo: keywords}.
// Pexels licence: free to use, no attribution required, do not resell unmodified. Downloads are cached per search.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const pexelsAvailable = () => !!process.env.PEXELS_API_KEY;
const STOP = new Set('a an the of in on at with for and or to is are person people man woman'.split(' '));
const stem = w => w.toLowerCase().replace(/(ing|ed|es|s)$/, '');
const words = t => String(t).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2 && !STOP.has(w)).map(stem);
/** Only accept a photo whose own description (Pexels alt text) contains nearly every word we asked for. Better no photo than a loosely related one. */
export function matchesQuery(query, alt, need = 0.8) { const q = [...new Set(words(query))]; if (!q.length) return false; const a = new Set(words(alt || '')); return q.filter(w => a.has(w)).length / q.length >= need; }
export async function fetchPhoto(query, dir) {
  const key = process.env.PEXELS_API_KEY; if (!key) throw new Error('no Pexels key saved');
  const q = String(query || '').trim().replace(/[^\p{L}\p{N} ,-]/gu, '').slice(0, 80); if (!q) throw new Error('empty search');
  const file = path.join(dir, 'photo_' + crypto.createHash('sha1').update(q.toLowerCase()).digest('hex').slice(0, 12) + '.jpg'); if (fs.existsSync(file)) return { file, query: q, cached: true };
  const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&orientation=portrait&size=large&per_page=30`, { headers: { Authorization: key }, signal: AbortSignal.timeout(15000) });
  if (r.status === 401 || r.status === 403) throw new Error('Pexels rejected the key'); if (r.status === 429) throw new Error('Pexels rate limit reached, try later'); if (!r.ok) throw new Error('Pexels error ' + r.status);
  const j = await r.json(); const p = (j.photos || []).find(x => matchesQuery(q, x.alt)); const url = p?.src?.large2x || p?.src?.large; if (!url) throw new Error('no photo matched closely enough');
  const img = await fetch(url, { signal: AbortSignal.timeout(30000) }); if (!img.ok) throw new Error('photo download failed');
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, Buffer.from(await img.arrayBuffer())); fs.writeFileSync(file + '.json', JSON.stringify({ query: q, photographer: p.photographer, page: p.url, id: p.id }));
  return { file, query: q, photographer: p.photographer };
}
