import fs from 'node:fs';
import path from 'node:path';
import { home, ensureDir, readJson, writeJson, slug } from './util.mjs';

export const reelsDir = () => ensureDir(path.join(home(), 'reels'));
export const reelDir = s => path.join(reelsDir(), s);
export const metaPath = s => path.join(reelDir(s), 'meta.json');
export const scriptPath = s => path.join(reelDir(s), 'script.txt');
export const getMeta = s => readJson(metaPath(s), null);
export const saveMeta = (s, m) => writeJson(metaPath(s), m);
export const listReels = () => fs.readdirSync(reelsDir()).filter(d => fs.existsSync(metaPath(d))).map(d => ({ slug: d, ...getMeta(d) }));
export function createReel(title, text) {
  let s = slug(title), n = 2; while (fs.existsSync(reelDir(s))) s = slug(title) + '-' + n++;
  ensureDir(reelDir(s)); fs.writeFileSync(scriptPath(s), text);
  saveMeta(s, { title, created: new Date().toISOString(), status: 'draft', snapshots: [] }); return s;
}
export const analyticsPath = () => path.join(home(), 'analytics.json');
