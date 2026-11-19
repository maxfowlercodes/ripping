import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const isWin = process.platform === 'win32';
export const isMac = process.platform === 'darwin';

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, ...opts });
  return { ok: r.status === 0, code: r.status, out: r.stdout || '', err: r.stderr || '', missing: r.error?.code === 'ENOENT' };
}

export function has(cmd) {
  return !run(isWin ? 'where' : 'which', [cmd]).missing && run(isWin ? 'where' : 'which', [cmd]).ok;
}

export function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); return d; }

export function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
export function writeJson(p, v) { ensureDir(path.dirname(p)); fs.writeFileSync(p, JSON.stringify(v, null, 2)); }

/** Workspace root: REELKIT_HOME or ./reelkit-data */
export function home() {
  return ensureDir(process.env.REELKIT_HOME || path.join(process.cwd(), 'reelkit-data'));
}
export function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'untitled'; }

export function probeDuration(file) {
  const r = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  return r.ok ? parseFloat(r.out) : NaN;
}

export function findFont(bold = true) {
  const cands = isWin
    ? ['C:/Windows/Fonts/arialbd.ttf', 'C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/arial.ttf']
    : isMac
    ? ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/Library/Fonts/Arial Bold.ttf', '/System/Library/Fonts/Helvetica.ttc']
    : ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf', '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf'];
  if (process.env.REELKIT_FONT) cands.unshift(process.env.REELKIT_FONT);
  return cands.find(f => fs.existsSync(f));
}
export const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'reelkit-'));
