// What Reelkit stores, how big it is, and a safe cleaner. Only regenerable caches are ever deleted automatically.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { home } from './util.mjs';
import { voicesDir } from './voice.mjs';

export function freeBytes(dir = home()) { try { const s = fs.statfsSync(dir); return Number(s.bavail) * Number(s.bsize); } catch { return null; } }
export const gb = n => (n == null ? '?' : (n / 1e9).toFixed(1) + ' GB');
export function assertDisk(minBytes = 1.5e9, dir = home()) { const f = freeBytes(dir); if (f != null && f < minBytes) throw new Error(`Low disk space: only ${gb(f)} free. Reelkit needs at least ${gb(minBytes)} to render. Free some space (Settings, Storage, Clean up) and try again.`); }

async function size(p, limit = 300000) { // total bytes under p (files only, symlinks skipped, bounded)
  let total = 0, count = 0; const stack = [p];
  while (stack.length && count < limit) { const d = stack.pop(); let ents; try { ents = await fs.promises.readdir(d, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) { const f = path.join(d, e.name); if (e.isSymbolicLink()) continue; if (e.isDirectory()) stack.push(f); else { try { total += (await fs.promises.stat(f)).size; } catch {} count++; } }
    await new Promise(r => setImmediate(r)); }
  return total;
}
const exists = p => { try { return fs.existsSync(p); } catch { return false; } };
const reelDirs = () => { const d = path.join(home(), 'reels'); return exists(d) ? fs.readdirSync(d).map(x => path.join(d, x)).filter(x => { try { return fs.statSync(x).isDirectory(); } catch { return false; } }) : []; };
const tmpReelkit = () => { try { return fs.readdirSync(os.tmpdir()).filter(n => /^reelkit-/.test(n)).map(n => path.join(os.tmpdir(), n)); } catch { return []; } };
const browserCaches = () => ['Cache', 'Code Cache', 'GPUCache', 'GrShaderCache', 'ShaderCache', 'DawnCache'].flatMap(n => [path.join(home(), 'browser-profile', 'Default', n), path.join(home(), 'browser-profile', n)]).filter(exists);

/** Each item: {id, label, note, paths[], clean: bool} */
export function storageItems() {
  const h = home(); const dot = path.join(os.homedir(), '.reelkit');
  return [
    { id: 'work', label: 'Render caches', note: 'Intermediate video scenes. Rebuilt automatically when needed.', paths: reelDirs().map(d => path.join(d, 'work')).filter(exists), clean: true },
    { id: 'tmp', label: 'Temporary files', note: 'Leftovers from interrupted tasks.', paths: tmpReelkit(), clean: true },
    { id: 'browsercache', label: 'Reelkit browser cache', note: 'Pages and videos the browser cached. Your Instagram login is kept.', paths: browserCaches(), clean: true },
    { id: 'previews', label: 'Voice previews', note: 'Short sample clips.', paths: [path.join(h, 'voice-previews')].filter(exists), clean: true },
    { id: 'llm', label: 'Saved Claude answers', note: 'Cached replies that make repeats free.', paths: [path.join(h, 'llm-cache')].filter(exists), clean: true },
    { id: 'history', label: 'Job and run history', note: 'Logs of past tasks.', paths: [path.join(h, 'jobs'), path.join(h, 'runs')].filter(exists), clean: true },
    { id: 'logs', label: 'Launcher logs', note: 'Start-up logs.', paths: ['launcher.log', 'server.out.log', 'server.err.log'].map(f => path.join(dot, f)).filter(exists), clean: true },
    { id: 'videos', label: 'Your reels', note: 'The finished videos and scripts. Never cleaned automatically.', paths: reelDirs().flatMap(d => { try { return fs.readdirSync(d).filter(f => f !== 'work').map(f => path.join(d, f)); } catch { return []; } }), clean: false },
    { id: 'footage', label: 'Your footage', note: 'Videos you uploaded and their cut versions. Delete what you no longer need from the folder.', paths: [path.join(h, 'footage')].filter(exists), clean: false },
    { id: 'profile', label: 'Reelkit browser profile', note: 'Holds your Instagram login. Do not delete.', paths: [path.join(h, 'browser-profile')].filter(exists), clean: false },
    { id: 'models', label: 'Voice and speech models', note: 'Downloaded once. Re-downloaded if removed.', paths: [voicesDir(), path.join(os.homedir(), '.cache', 'huggingface')].filter(exists), clean: false },
  ];
}
export async function storageReport() {
  const items = []; for (const it of storageItems()) { let bytes = 0; for (const p of it.paths) { try { const st = fs.statSync(p); bytes += st.isDirectory() ? await size(p) : st.size; } catch {} } items.push({ id: it.id, label: it.label, note: it.note, clean: it.clean, bytes, files: it.paths.length }); }
  return { free: freeBytes(), items, total: items.reduce((a, b) => a + b.bytes, 0) };
}
export async function cleanStorage(ids = []) {
  let freed = 0; const done = [];
  for (const it of storageItems()) { if (!it.clean || !ids.includes(it.id)) continue;
    for (const p of it.paths) { let b = 0; try { const st = fs.statSync(p); b = st.isDirectory() ? await size(p) : st.size; } catch {}
      try { if (it.id === 'history') { // keep the last 3 days so running work is not disturbed
          for (const f of fs.readdirSync(p)) { const fp = path.join(p, f); if (Date.now() - fs.statSync(fp).mtimeMs > 3 * 864e5) { const s2 = fs.statSync(fp).size; fs.rmSync(fp, { force: true, recursive: true }); freed += s2; } } continue; }
        fs.rmSync(p, { recursive: true, force: true }); freed += b; } catch { /* in use: skip */ } }
    done.push(it.id); }
  return { freed, cleaned: done, free: freeBytes() };
}
