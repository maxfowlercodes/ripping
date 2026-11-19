// Find the Claude Code CLI reliably on Windows, where npm installs a .cmd shim that Node cannot spawn directly.
import fs from 'node:fs';
import path from 'node:path';
import { run, runAsync, isWin, probe } from './util.mjs';

/** Pure resolver (testable). whereList = paths printed by `where claude` (or []). fsx = {existsSync, readdirSync}. */
export function resolveWith({ platform = process.platform, env = process.env, configured, whereList = [], fsx = fs, nodePath = process.execPath } = {}) {
  const P = platform === 'win32' ? path.win32 : path;
  if (configured && configured !== 'claude' && fsx.existsSync(configured)) return { cmd: configured, pre: [], found: true, via: 'configured' };
  if (platform !== 'win32') return { cmd: 'claude', pre: [], found: whereList.length > 0 || null, via: 'path' };
  const find = (dir, name, depth) => { // shallow search for a file inside an npm package
    if (depth < 0) return null; let ents = []; try { ents = fsx.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
    for (const e of ents) if (e.isFile?.() && e.name.toLowerCase() === name) return P.join(dir, e.name);
    for (const e of ents) if (e.isDirectory?.()) { const r = find(P.join(dir, e.name), name, depth - 1); if (r) return r; }
    return null;
  };
  const cands = [...whereList, env.USERPROFILE && P.join(env.USERPROFILE, '.local', 'bin', 'claude.exe'), env.APPDATA && P.join(env.APPDATA, 'npm', 'claude.cmd'), env.APPDATA && P.join(env.APPDATA, 'npm', 'claude')].filter(Boolean);
  for (const c of cands) {
    const lc = c.toLowerCase();
    if (lc.endsWith('.exe') && fsx.existsSync(c)) return { cmd: c, pre: [], found: true, via: 'exe' };
    if (/\.(cmd|ps1)$/.test(lc) || !P.extname(lc)) { // npm shim: run the real binary or cli.js it points to
      const pkg = P.join(P.dirname(c), 'node_modules', '@anthropic-ai', 'claude-code');
      if (!fsx.existsSync(pkg)) continue;
      const exe = find(pkg, 'claude.exe', 4); if (exe) return { cmd: exe, pre: [], found: true, via: 'npm-exe' };
      const cli = P.join(pkg, 'cli.js'); if (fsx.existsSync(cli)) return { cmd: nodePath, pre: [cli], found: true, via: 'npm-cli' };
    }
  }
  return { cmd: 'claude', pre: [], found: false, via: 'none' };
}

const memo = { t: 0, v: null, key: '' };
export function resolveClaude(configured) {
  if (probe.on) return probe.map.get('claude:resolved') || { cmd: 'claude', pre: [], found: false, via: 'pending' };
  const key = String(configured || ''); if (memo.v && memo.key === key && Date.now() - memo.t < 60000) return memo.v;
  const where = isWin ? run('where', ['claude']) : run('which', ['claude']); const list = where.ok ? where.out.split(/\r?\n/).map(x => x.trim()).filter(Boolean) : [];
  const v = resolveWith({ configured, whereList: list }); if (!isWin && v.found === null) v.found = list.length > 0; Object.assign(memo, { t: Date.now(), v, key }); return v;
}
export async function resolveClaudeAsync(configured) {
  const w = await runAsync(isWin ? 'where' : 'which', ['claude']); const list = w.ok ? w.out.split(/\r?\n/).map(x => x.trim()).filter(Boolean) : [];
  const v = resolveWith({ configured, whereList: list }); if (!isWin) v.found = list.length > 0; return v;
}
