// First-run setup helpers: what's installed, one-click installers (fixed whitelist, no user input in commands),
// Claude sign-in status, Instagram login detection, and a terminal opener for interactive sign-in.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { run, has, pyCan, probe, PYTHON, isWin, isMac, findFont, home, readJson, writeJson } from './util.mjs';
import { resolveClaude } from './claudebin.mjs';
import { refreshProbes } from './probes.mjs';
import { findBrowser, loadPlaywright, rootDir } from './browser.mjs';
import { whisperAvailable } from './transcribe.mjs';
import { kokoroAvailable, piperAvailable, piperModelFor, installKokoro, installPiperVoice } from './voice.mjs';
import { getSettings } from './claude.mjs';
import { CDP_PORT } from './computer.mjs';

const PY = PYTHON;

export function claudeStatus() {
  if (probe.on) return probe.map.get('claude:status') || { installed: false, loggedIn: false, pending: true };
  const rc = resolveClaude(getSettings().claudeBin); if (!rc.found) return { installed: false, loggedIn: false };
  const r = run(rc.cmd, [...rc.pre, 'auth', 'status']); try { const j = JSON.parse(r.out); return { installed: true, loggedIn: !!j.loggedIn, method: j.authMethod }; } catch { return { installed: true, loggedIn: false, unknown: true }; }
}

const portOpen = port => new Promise(res => { const s = net.connect(port, '127.0.0.1'); s.on('connect', () => { s.destroy(); res(true); }); s.on('error', () => res(false)); setTimeout(() => { s.destroy(); res(false); }, 700); });
/** Is the dedicated Reelkit browser running, and is it logged in to Instagram? (session cookie present; no page content is read) */
export async function igStatus(host = (process.env.REELKIT_IG_URL || 'https://www.instagram.com')) {
  if (!(await portOpen(CDP_PORT))) return { browser: false, loggedIn: false };
  const pw = loadPlaywright(); if (!pw) return { browser: true, loggedIn: false, error: 'playwright-core missing' };
  try {
    const b = await pw.chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`); const cookies = await b.contexts()[0].cookies(host); await b.close();
    return { browser: true, loggedIn: cookies.some(c => c.name === 'sessionid' && c.value) };
  } catch (e) { return { browser: true, loggedIn: false, error: e.message.split('\n')[0] }; }
}

/** Rows for the wizard. fix.kind: install (one click) | terminal | open (launch browser) | manual (text only) */
export async function systemCheck() {
  if (probe.on) await refreshProbes({ maxAgeMs: 2500 }); // async + single-flight: never blocks other requests
  const cs = claudeStatus(); const ig = await igStatus(); const nodeOk = Number(process.versions.node.split('.')[0]) >= 18;
  const pyv = probe.on ? probe.map.get('py:version') || '' : (() => { const r = run(PY(), ['--version']); return r.ok ? (r.out || r.err).trim() : ''; })(); const py = { ok: !!pyv, out: pyv, err: '' };
  const mediaOk = has('ffmpeg') && has('ffprobe'); const browserOk = !!findBrowser() && !!loadPlaywright();
  const row = (id, label, ok, detail, fix, optional = false) => ({ id, label, ok, detail, fix, optional });
  return [
    row('node', 'Node.js', nodeOk, nodeOk ? 'v' + process.versions.node : 'Version 18 or newer is needed', nodeOk ? null : { kind: 'manual', note: 'Install from nodejs.org (or: winget install OpenJS.NodeJS.LTS), then reopen Reelkit.' }),
    row('media', 'Video tools (ffmpeg)', mediaOk, mediaOk ? 'Ready' : 'Not found', mediaOk ? null : { kind: 'install', id: 'npm', label: 'Install' }),
    row('browser', 'Browser for rendering', browserOk, browserOk ? path.basename(findBrowser() || '') : (findBrowser() ? 'Renderer package missing' : 'Chrome or Edge not found'), browserOk ? null : findBrowser() ? { kind: 'install', id: 'npm', label: 'Install' } : { kind: 'manual', note: 'Install Google Chrome or Microsoft Edge.' }),
    row('python', 'Python', py.ok, py.ok ? py.out.trim() || py.err.trim() : 'Not found', py.ok ? null : { kind: 'manual', note: 'Install from python.org (tick "Add to PATH"), or: winget install Python.Python.3.12' }),
    row('claude', 'Claude Code', cs.installed, cs.installed ? 'Installed' : cs.pending ? 'Checking…' : 'Not found', cs.installed ? null : { kind: 'install', id: 'claude', label: 'Install' }),
    row('claude-login', 'Signed in to Claude', cs.loggedIn, cs.loggedIn ? 'Signed in' : cs.installed ? 'Not signed in' : 'Install Claude Code first', cs.loggedIn || !cs.installed ? null : { kind: 'terminal', label: 'Sign in' }),
    row('whisper', 'Speech recognition (captions, footage cutter)', whisperAvailable(), whisperAvailable() ? 'Ready' : 'Not installed', whisperAvailable() ? null : { kind: 'install', id: 'whisper', label: 'Install' }),
    row('voice', 'Free voice (Kokoro)', kokoroAvailable(), kokoroAvailable() ? 'Ready' : 'Not installed (about 350 MB)', kokoroAvailable() ? null : { kind: 'install', id: 'kokoro', label: 'Install' }),
    row('ig', 'Instagram login', ig.loggedIn, ig.loggedIn ? 'Logged in' : ig.browser ? 'Browser open, not logged in yet' : 'Not set up', ig.loggedIn ? null : { kind: 'open', label: ig.browser ? 'Check again' : 'Open browser' }),
    row('cloudflared', 'Public link for the chat (cloudflared)', has('cloudflared'), has('cloudflared') ? 'Ready' : 'Optional', has('cloudflared') ? null : isWin || isMac ? { kind: 'install', id: 'cloudflared', label: 'Install' } : { kind: 'manual', note: 'See developers.cloudflare.com for your platform.' }, true),
  ];
}

// ---- installers: fixed command lists only
const NPM = isWin ? 'npm.cmd' : 'npm';
export const INSTALLERS = {
  npm: { label: 'Installing video and browser components', steps: [{ cmd: NPM, args: ['install', '--no-audit', '--no-fund'], cwd: rootDir }] },
  claude: { label: 'Installing Claude Code', steps: [{ cmd: NPM, args: ['install', '-g', '@anthropic-ai/claude-code'] }] },
  whisper: { label: 'Installing speech recognition', steps: [{ cmd: PY(), args: ['-m', 'pip', 'install', '--upgrade', 'faster-whisper'] }] },
  kokoro: { label: 'Installing the Kokoro voice', steps: [{ cmd: PY(), args: ['-m', 'pip', 'install', '--upgrade', 'kokoro-onnx', 'soundfile'] }, { fn: 'kokoro' }] },
  piper: { label: 'Installing the Piper voice', steps: [{ cmd: PY(), args: ['-m', 'pip', 'install', '--upgrade', 'piper-tts'] }, { fn: 'piper' }] },
  edge: { label: 'Installing Edge voices', steps: [{ cmd: PY(), args: ['-m', 'pip', 'install', '--upgrade', 'edge-tts'] }] },
  autostart: { label: 'Setting up start at sign-in', steps: [{ cmd: 'powershell', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(rootDir, 'scripts', 'create-shortcut.ps1'), '-AtLogin'] }] },
  cloudflared: { label: 'Installing cloudflared', steps: [isWin ? { cmd: 'winget', args: ['install', '--id', 'Cloudflare.cloudflared', '-e', '--accept-source-agreements', '--accept-package-agreements'] } : { cmd: 'brew', args: ['install', 'cloudflared'] }] },
};

function runStep(step, log) {
  return new Promise((resolve, reject) => {
    const p = spawn(step.cmd, step.args, { cwd: step.cwd, shell: isWin, stdio: ['ignore', 'pipe', 'pipe'] });
    const feed = d => String(d).split(/\r?\n/).filter(Boolean).slice(-3).forEach(l => log(l.slice(0, 160)));
    p.stdout.on('data', feed); p.stderr.on('data', feed);
    p.on('error', e => reject(new Error(e.code === 'ENOENT' ? `${step.cmd} was not found` : e.message)));
    p.on('close', c => (c === 0 ? resolve() : reject(new Error(`${step.cmd} exited with code ${c}`))));
  });
}
export async function runInstaller(id, log = () => {}) {
  if (typeof id !== 'string' || !Object.hasOwn(INSTALLERS, id)) throw new Error('unknown installer'); const inst = INSTALLERS[id];
  for (const s of inst.steps) {
    if (s.fn === 'kokoro') await installKokoro(log); else if (s.fn === 'piper') await installPiperVoice('en', log); else await runStep(s, log);
  }
}

/** Open a terminal running `claude` so the user can sign in (fixed command). */
export function openClaudeLogin() {
  const rc = resolveClaude(getSettings().claudeBin); const cmd = rc.found ? [rc.cmd, ...rc.pre] : ['claude']; const line = cmd.map(x => (/\s/.test(x) ? `"${x}"` : x)).join(' ') + ' auth login';
  if (isWin) spawn('cmd.exe', ['/c', 'start', 'Claude sign-in', 'cmd', '/k', line], { detached: true, stdio: 'ignore', windowsVerbatimArguments: false }).unref();
  else if (isMac) spawn('osascript', ['-e', `tell application "Terminal" to do script "${line.replace(/"/g, '\\"')}"`, '-e', 'tell application "Terminal" to activate'], { detached: true, stdio: 'ignore' }).unref();
  else for (const t of [['x-terminal-emulator', ['-e', line]], ['gnome-terminal', ['--', 'sh', '-c', line]], ['konsole', ['-e', line]]]) if (has(t[0])) { spawn(t[0], t[1], { detached: true, stdio: 'ignore' }).unref(); return true; }
  return true;
}

// ---- onboarding progress (solo user: one set of answers, resumable)
const stateFile = () => path.join(home(), 'state.json');
export const getOnboarding = () => readJson(stateFile(), {}).onboarding || { step: 0, done: false };
export const setOnboarding = patch => { const s = readJson(stateFile(), {}); s.onboarding = { ...(s.onboarding || { step: 0, done: false }), ...patch }; writeJson(stateFile(), s); return s.onboarding; };
export const getAutofill = () => readJson(stateFile(), {}).autofill || null;
export const setAutofill = v => { const s = readJson(stateFile(), {}); s.autofill = v; writeJson(stateFile(), s); };
