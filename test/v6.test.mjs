import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
process.env.REELKIT_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'rk-v6-'));
process.env.REELKIT_CLAUDE_DRYRUN = '1';
const slow = path.join(process.env.REELKIT_HOME, 'slowpy.sh'); fs.writeFileSync(slow, '#!/bin/sh\nsleep 4\nexit 0\n', { mode: 0o755 });
const { resolveWith } = await import('../src/claudebin.mjs');
const { startDashboard } = await import('../src/dashboard.mjs');
const { listJobs, enqueue, getJob } = await import('../src/jobs.mjs');

// ---- Windows resolution of the npm shim (simulated file system)
const fake = files => ({ existsSync: p => files.has(p) || [...files.keys()].some(k => k.startsWith(p + '\\')), readdirSync: (dir) => { const out = new Map(); for (const k of files.keys()) if (k.startsWith(dir + '\\')) { const rest = k.slice(dir.length + 1).split('\\'); out.set(rest[0], rest.length === 1); } return [...out].map(([name, isFile]) => ({ name, isFile: () => isFile, isDirectory: () => !isFile })); } });
test('Windows: claude.cmd shim resolves to the real binary inside the npm package', () => {
  const npm = 'C:\\Users\\me\\AppData\\Roaming\\npm'; const pkg = npm + '\\node_modules\\@anthropic-ai\\claude-code';
  const f = fake(new Map([[npm + '\\claude.cmd', 1], [pkg + '\\bin\\claude.exe', 1], [pkg + '\\package.json', 1]]));
  const r = resolveWith({ platform: 'win32', env: { APPDATA: 'C:\\Users\\me\\AppData\\Roaming', USERPROFILE: 'C:\\Users\\me' }, whereList: [npm + '\\claude', npm + '\\claude.cmd'], fsx: f });
  assert.equal(r.found, true); assert.equal(r.cmd, pkg + '\\bin\\claude.exe'); assert.deepEqual(r.pre, []);
  const g = fake(new Map([[npm + '\\claude.cmd', 1], [pkg + '\\cli.js', 1]]));
  const r2 = resolveWith({ platform: 'win32', env: { APPDATA: 'C:\\Users\\me\\AppData\\Roaming' }, whereList: [npm + '\\claude.cmd'], fsx: g, nodePath: 'C:\\node.exe' });
  assert.equal(r2.found, true); assert.equal(r2.cmd, 'C:\\node.exe'); assert.deepEqual(r2.pre, [pkg + '\\cli.js']);
  const h = fake(new Map([['C:\\Users\\me\\.local\\bin\\claude.exe', 1]])); const r3 = resolveWith({ platform: 'win32', env: { USERPROFILE: 'C:\\Users\\me' }, whereList: [], fsx: h }); assert.equal(r3.found, true); assert.equal(r3.cmd, 'C:\\Users\\me\\.local\\bin\\claude.exe');
  assert.equal(resolveWith({ platform: 'win32', env: {}, whereList: [], fsx: fake(new Map()) }).found, false);
});
test('Unix resolves to plain claude; a configured absolute path wins', () => {
  assert.equal(resolveWith({ platform: 'linux', whereList: ['/usr/bin/claude'] }).cmd, 'claude'); assert.equal(resolveWith({ platform: 'linux', configured: process.execPath }).cmd, process.execPath);
});

// ---- the lag regression: slow environment probes must never block other requests
const call = (port, p, body) => new Promise((res, rej) => { const t0 = Date.now(); const d = body ? JSON.stringify(body) : null; const q = http.request({ host: '127.0.0.1', port, path: p, method: body ? 'POST' : 'GET', headers: d ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(d) } : {} }, r => { let b = ''; r.on('data', x => (b += x)); r.on('end', () => res({ code: r.statusCode, ms: Date.now() - t0, json: (() => { try { return JSON.parse(b); } catch { return null; } })() })); }); q.on('error', rej); q.end(d); });
test('slow python/claude probes do not block /api/state or navigation requests', async () => {
  process.env.REELKIT_PYTHON = slow; const srv = startDashboard({ port: 4311, worker: false }); await new Promise(r => setTimeout(r, 300));
  try {
    const check = call(4311, '/api/setup/check'); await new Promise(r => setTimeout(r, 150)); // check is now waiting on 4-second probes
    const t = []; for (let i = 0; i < 5; i++) t.push(await call(4311, '/api/state')); const ob = await call(4311, '/api/onboarding', { step: 2 }); const sc = await call(4311, '/api/guide');
    for (const r of [...t, ob, sc]) assert.ok(r.ms < 600, `request took ${r.ms} ms while probes were running`); assert.equal(ob.json.step, 2);
    const c = await check; assert.equal(c.code, 200); assert.ok(c.ms >= 3500 && c.json.rows.length >= 9, 'the check itself waits for the probes');
    const again = await call(4311, '/api/setup/check'); assert.ok(again.ms < 800, `second check should reuse fresh results (${again.ms} ms)`);
  } finally { srv.close(); delete process.env.REELKIT_PYTHON; }
});
test('job polling endpoint is cheap, validated, and history is bounded', async () => {
  const j = enqueue('install', { id: 'npm' }); assert.equal(getJob(j.id).id, j.id); assert.equal(getJob('../../etc'), null); assert.equal(getJob('zzzzzzzz'), null);
  for (let i = 0; i < 30; i++) enqueue('analyze', {}); assert.ok(listJobs(12).length === 12 && listJobs(5).length === 5);
  const srv = startDashboard({ port: 4312, worker: false }); await new Promise(r => setTimeout(r, 300));
  try { const r = await call(4312, '/api/job/' + j.id); assert.equal(r.code, 200); assert.equal(r.json.type, 'install'); assert.equal((await call(4312, '/api/job/abcdefgh')).code, 404); } finally { srv.close(); }
});

import { spawnSync, spawn } from 'node:child_process';
const cli = (args, env = {}) => new Promise(res => { const p = spawn(process.execPath, [path.join(import.meta.dirname, '..', 'bin', 'reelkit.mjs'), ...args], { env: { ...process.env, REELKIT_NO_WINDOW: '1', ...env } }); let out = '', err = ''; p.stdout.on('data', d => (out += d)); p.stderr.on('data', d => (err += d)); const to = setTimeout(() => p.kill(), 9000); p.on('close', code => { clearTimeout(to); res({ status: code, stdout: out, stderr: err }); }); });
test('starting Reelkit twice reuses the running instance instead of failing silently', async () => {
  const srv = startDashboard({ port: 4313, worker: false }); await new Promise(r => setTimeout(r, 400));
  try {
    const hz = await call(4313, '/healthz'); assert.equal(hz.json.app, 'reelkit');
    const t0 = Date.now(); const r = await cli(['dashboard', '--port', '4313', '--open']); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /already running/); assert.ok(Date.now() - t0 < 5000);
    const o = await cli(['open', '--port', '4313']); assert.equal(o.status, 0, o.stderr); assert.match(o.stdout, /Opened Reelkit/);
    const none = await cli(['open', '--port', '4399']); assert.notEqual(none.status, 0); assert.match(none.stderr, /not running/);
  } finally { srv.close(); }
});
test('a port taken by another program gives a clear message, not silence', async () => {
  const blocker = http.createServer((q, r) => r.end('x')).listen(4314); await new Promise(r => setTimeout(r, 200));
  try { const r = await cli(['dashboard', '--port', '4314', '--no-worker']); assert.notEqual(r.status, 0); assert.match(r.stderr, /already in use by another program/); } finally { blocker.close(); }
});

import { reelkitRunning } from '../src/dashboard.mjs';
test('an older Reelkit without /healthz is still recognised as Reelkit (so it can be reused or replaced)', async () => {
  const old = http.createServer((q, r) => { if (q.url === '/healthz') { r.writeHead(404); return r.end('nope'); } r.writeHead(200, { 'content-type': 'text/html' }); r.end('<html><head><title>Reelkit</title></head></html>'); }).listen(4315);
  const other = http.createServer((q, r) => { r.writeHead(200); r.end('<title>Something else</title>'); }).listen(4316); await new Promise(r => setTimeout(r, 200));
  try { assert.equal(await reelkitRunning(4315), true); assert.equal(await reelkitRunning(4316), false); assert.equal(await reelkitRunning(4399), false); } finally { old.close(); other.close(); }
});
test('reelkit stop shuts the app and its worker down, and no worker is left behind', async () => {
  const app = spawn(process.execPath, [path.join(import.meta.dirname, '..', 'bin', 'reelkit.mjs'), 'dashboard', '--port', '4317'], { env: { ...process.env, REELKIT_NO_WINDOW: '1' } }); let exited = false; app.on('close', () => (exited = true));
  for (let i = 0; i < 30 && !(await reelkitRunning(4317)); i++) await new Promise(r => setTimeout(r, 200));
  assert.equal(await reelkitRunning(4317), true);
  const s = await cli(['stop', '--port', '4317']); assert.match(s.stdout, /stopped/i);
  for (let i = 0; i < 30 && !exited; i++) await new Promise(r => setTimeout(r, 200)); assert.equal(exited, true, 'dashboard process ended');
  assert.equal(await reelkitRunning(4317), false); assert.match((await cli(['stop', '--port', '4317'])).stdout, /not running/);
  await new Promise(r => setTimeout(r, 800)); const left = spawnSync('pgrep', ['-f', 'reelkit.mjs worker --child'], { encoding: 'utf8' }); assert.equal(left.stdout.trim(), '', 'no orphan worker');
});

const { mcpConfig, findPrompt, searchUrl } = await import('../src/computer.mjs');
test('Windows launches the browser-control server through cmd /c npx; other platforms use npx directly', () => {
  const w = mcpConfig('win32').mcpServers.playwright; assert.equal(w.command, 'cmd'); assert.deepEqual(w.args.slice(0, 3), ['/c', 'npx', '-y']); assert.ok(w.args.some(a => a.startsWith('--cdp-endpoint')) || w.args.includes('--cdp-endpoint'));
  const l = mcpConfig('linux').mcpServers.playwright; assert.equal(l.command, 'npx'); assert.equal(l.args[0], '-y');
});
test('find-references prompt: keywords, search URL, recency, read-only limits', () => {
  assert.match(searchUrl('cv tips & more'), /explore\/search\/keyword\/\?q=cv%20tips%20%26%20more$/);
  const p = findPrompt({ keywords: ['cv tips', 'job interview'], max: 8 }); for (const x of ['"cv tips"', '"job interview"', 'last 30 days', 'ONCE', 'follower count', 'Do not like, follow, save, comment or message', '40 page actions', 'Open up to 8 reels']) assert.ok(p.includes(x), x);
});
test('refs/find and browser/test endpoints validate input and enqueue jobs', async () => {
  const srv = startDashboard({ port: 4318, worker: false }); await new Promise(r => setTimeout(r, 300));
  try {
    assert.equal((await call(4318, '/api/refs/find', { keywords: '' })).code, 400); assert.equal((await call(4318, '/api/refs/find', { keywords: '<>,;;;{}' })).code, 400);
    const r = await call(4318, '/api/refs/find', { keywords: ['cv tips', 'a;b', 'c', 'd', 'e', 'f', 'g'], max: 999, autoSave: 99 }); assert.equal(r.code, 200); const j = r.json;
    assert.equal(j.type, 'find-refs'); assert.equal(j.payload.keywords.length, 5); assert.ok(j.payload.keywords.every(k => !/[;<>]/.test(k))); assert.equal(j.payload.max, 15); assert.equal(j.payload.autoSave, 8);
    const b = await call(4318, '/api/browser/test', {}); assert.equal(b.json.type, 'browser-test'); assert.equal((await call(4318, '/api/browser/test')).code, 200);
  } finally { srv.close(); }
});
test('login detection does not change the page colour scheme (no light/dark flicker)', async t => {
  const { findBrowser } = await import('../src/browser.mjs'); const exe = findBrowser(); if (!exe) return t.skip('no browser');
  const port = 9603; process.env.REELKIT_CDP_PORT = String(port); const site = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>x</title>'); }).listen(8772);
  const chrome = spawn(exe, ['--headless=new', '--no-sandbox', `--remote-debugging-port=${port}`, '--force-dark-mode', '--enable-features=WebContentsForceDark', `--user-data-dir=${path.join(process.env.REELKIT_HOME, 'flick')}`, 'http://localhost:8772/'], { stdio: 'ignore' });
  try {
    for (let i = 0; i < 30; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { await new Promise(r => setTimeout(r, 200)); } }
    const scheme = async () => { const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const pg = list.find(x => x.type === 'page'); const ws = new WebSocket(pg.webSocketDebuggerUrl); return new Promise(res => { ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: "matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'", returnByValue: true } })); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id === 1) { ws.close(); res(m.result.result.value); } }; }); };
    const { browserCookies } = await import('../src/setup.mjs'); assert.equal(await scheme(), 'dark'); const seen = new Set();
    for (let i = 0; i < 8; i++) { const c = await browserCookies(port); assert.ok(Array.isArray(c)); seen.add(await scheme()); }
    assert.deepEqual([...seen], ['dark'], 'colour scheme stayed dark during repeated login checks');
  } finally { chrome.kill(); site.close(); delete process.env.REELKIT_CDP_PORT; }
});
