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
test('browser control: bundled server preferred; npx fallback goes through cmd /c on Windows', () => {
  const l = mcpConfig('win32', '/x/node_modules/@playwright/mcp/cli.js').mcpServers.playwright; assert.equal(l.command, 'node'); assert.equal(l.args[0], '/x/node_modules/@playwright/mcp/cli.js'); assert.ok(l.args.includes('--cdp-endpoint'));
  const w = mcpConfig('win32', null).mcpServers.playwright; assert.equal(w.command, 'cmd'); assert.deepEqual(w.args.slice(0, 3), ['/c', 'npx', '-y']);
  const u = mcpConfig('linux', null).mcpServers.playwright; assert.equal(u.command, 'npx'); assert.equal(u.args[0], '-y');
  assert.ok(mcpConfig().mcpServers.playwright.command === 'node', 'this repo bundles @playwright/mcp');
});
test('find-references prompt: keywords, search URL, recency, read-only limits', () => {
  assert.match(searchUrl('cv tips & more'), /explore\/search\/keyword\/\?q=cv%20tips%20%26%20more$/);
  const p = findPrompt({ keywords: ['cv tips', 'job interview'], max: 8 }); for (const x of ['"cv tips"', '"job interview"', 'last 30 days', 'ONCE', 'follower count', 'Do not like, follow, save, comment or message', '90 page actions', 'Open up to 8 reels']) assert.ok(p.includes(x), x);
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

const { describeTool, buildArgs, DENY_BROWSER } = await import('../src/claude.mjs'); const { ALLOWED } = await import('../src/computer.mjs');
test('browser tasks: explicit safe tool allowlist, code execution denied, progress streamed', () => {
  assert.ok(ALLOWED.length >= 8 && ALLOWED.every(t => t.startsWith('mcp__playwright__browser_'))); for (const bad of ['run_code', 'evaluate', 'network', 'console']) assert.ok(!ALLOWED.some(t => t.includes(bad)), bad);
  assert.ok(DENY_BROWSER.includes('mcp__playwright__browser_run_code_unsafe') && DENY_BROWSER.includes('mcp__playwright__browser_evaluate'));
  const a = buildArgs({ task: 'computer_research', prompt: 'x', model: 'haiku', mcpConfig: { mcpServers: {} }, allowedTools: ALLOWED, stream: true });
  assert.deepEqual(a.slice(a.indexOf('--output-format'), a.indexOf('--output-format') + 3), ['--output-format', 'stream-json', '--verbose']); assert.ok(a.includes('--disallowedTools') && a.includes('mcp__playwright__browser_run_code_unsafe'));
  const t = buildArgs({ task: 'caption_hashtags', prompt: 'x', model: 'haiku' }); assert.equal(t[t.indexOf('--output-format') + 1], 'json');
});
test('progress lines are readable', () => {
  assert.equal(describeTool('mcp__playwright__browser_navigate', { url: 'https://www.instagram.com/explore/search/keyword/?q=cv%20tips' }), 'Opening www.instagram.com/explore/search/keyword/?q=cv%20tips'); assert.equal(describeTool('mcp__playwright__browser_snapshot'), 'Reading the page');
  assert.equal(describeTool('mcp__playwright__browser_click', { element: 'Reels tab' }), 'Clicking Reels tab'); assert.match(describeTool('WebSearch', { query: 'cv tips' }), /Searching the web: cv tips/);
});

const { laneOf, queueInfo } = await import('../src/jobs.mjs');
test('job lanes: research never blocks browser work; a queued job reports what it is waiting for', async () => {
  assert.notEqual(laneOf('research'), laneOf('find-refs')); assert.equal(laneOf('find-refs'), laneOf('browser-test')); assert.equal(laneOf('install'), 'install');
  const fsx = await import('node:fs'); const jdir = path.join(process.env.REELKIT_HOME, 'jobs'); fsx.mkdirSync(jdir, { recursive: true });
  const mk = (id, type, status, created) => fsx.writeFileSync(path.join(jdir, id + '.json'), JSON.stringify({ id, type, status, created, log: [], payload: {}, stage: 'Working' }));
  mk('aaaaaaa1', 'find-refs', 'running', '2026-01-01T00:00:00Z'); mk('aaaaaaa2', 'browser-test', 'queued', '2026-01-01T00:01:00Z'); mk('aaaaaaa3', 'research', 'running', '2026-01-01T00:00:30Z');
  const q = queueInfo(getJob('aaaaaaa2')); assert.equal(q.ahead, 1); assert.equal(q.waitingOn.type, 'find-refs'); assert.equal(queueInfo(getJob('aaaaaaa1')), null);
  const lone = (() => { mk('aaaaaaa4', 'install', 'queued', '2026-01-01T00:02:00Z'); return queueInfo(getJob('aaaaaaa4')); })(); assert.equal(lone.ahead, 0); assert.equal(lone.waitingOn, null);
});

const { storageReport, cleanStorage, freeBytes, assertDisk } = await import('../src/storage.mjs');
test('storage: reports sizes, cleans only regenerable caches, never videos or the login profile', async () => {
  const fsx = await import('node:fs'); const h = process.env.REELKIT_HOME; const w = path.join(h, 'reels', 'r1', 'work'); fsx.mkdirSync(w, { recursive: true }); fsx.writeFileSync(path.join(w, 'seg.mp4'), Buffer.alloc(200000));
  fsx.writeFileSync(path.join(h, 'reels', 'r1', 'reel.mp4'), Buffer.alloc(150000)); fsx.mkdirSync(path.join(h, 'browser-profile', 'Default', 'Cache'), { recursive: true }); fsx.writeFileSync(path.join(h, 'browser-profile', 'Default', 'Cache', 'c1'), Buffer.alloc(120000)); fsx.writeFileSync(path.join(h, 'browser-profile', 'Default', 'Cookies'), Buffer.alloc(5000));
  const r = await storageReport(); const by = Object.fromEntries(r.items.map(i => [i.id, i])); assert.ok(by.work.bytes >= 200000 && by.work.clean); assert.ok(by.videos.bytes >= 150000 && !by.videos.clean); assert.ok(by.profile.bytes >= 125000 && !by.profile.clean); assert.ok(typeof r.free === 'number' && r.free > 0);
  const out = await cleanStorage(['work', 'videos', 'profile', 'browsercache']); assert.deepEqual(out.cleaned.sort(), ['browsercache', 'work']); assert.ok(out.freed >= 300000);
  assert.ok(!fsx.existsSync(w) && fsx.existsSync(path.join(h, 'reels', 'r1', 'reel.mp4')) && fsx.existsSync(path.join(h, 'browser-profile', 'Default', 'Cookies')) && !fsx.existsSync(path.join(h, 'browser-profile', 'Default', 'Cache')), 'only caches removed; login cookies and videos kept');
  assert.throws(() => assertDisk(1e18), /Low disk space/); assert.doesNotThrow(() => assertDisk(1000));
});

const { normalizeFound } = await import('../src/swipe.mjs');
test('found reels are never silently dropped: missing views fall back to a marked likes estimate', () => {
  const r = normalizeFound([
    { url: 'https://www.instagram.com/reel/a/', creator: '@coach', views: 412000, likes: 18000, comments: 640, caption: 'hook', followers: 58000 },
    { url: 'https://www.instagram.com/reel/b/', creator: 'hr', views: 0, likes: 4100, comments: 12, caption: 'second', followers: 0 },
    { url: 'https://www.instagram.com/reel/c/', creator: 'x', views: 0, likes: 0, comments: 0, caption: 'third' },
    { url: 'https://www.instagram.com/reel/a/', creator: '@coach', views: 1 }, { url: 'not a url', creator: 'bad' }, { creator: 'nourl' },
  ]);
  assert.equal(r.items.length, 3); assert.equal(r.skipped, 3); assert.equal(r.estimated, 1);
  const [a, b, c] = r.items; assert.equal(a.views, 412000); assert.equal(a.creator, 'coach'); assert.equal(a.est, false); assert.equal(b.views, 82000); assert.equal(b.est, true); assert.equal(b.baseline, 412000, 'baseline falls back to the median of real views'); assert.equal(c.views, 0);
  assert.deepEqual(normalizeFound([]).items, []); assert.deepEqual(normalizeFound(null).items, []);
});

const { applyFound } = await import('../src/swipe.mjs');
test('"found nothing" is reported with Claude\'s explanation, never as success; real finds are saved', () => {
  assert.throws(() => applyFound({ reels: [], note: 'I saw the Instagram login page, so I could not search.' }), e => /no reels it could use/.test(e.message) && /login page/.test(e.message) && e.result.added === 0);
  assert.throws(() => applyFound({ reels: [{ creator: 'x' }] }), /no reels it could use/); assert.throws(() => applyFound(undefined), /no reels it could use/);
  const ok = applyFound({ reels: [{ url: 'https://www.instagram.com/reel/q1/', creator: 'a', views: 900000, likes: 40000, caption: 'c', followers: 50000 }, { url: 'https://www.instagram.com/reel/q2/', creator: 'b', views: 0, likes: 2000, caption: 'd' }], note: 'ok' }, { niche: 'jobs', autoSave: 1 });
  assert.equal(ok.added, 2); assert.equal(ok.saved, 1); assert.equal(ok.estimated, 1);
});

test('library: reels land in honest states and post-run presets skip finished steps', async () => {
  const { postLibrary, startPostRun } = await import('../src/library.mjs'); const { createReel, getMeta, saveMeta, reelDir } = await import('../src/store.mjs'); const fs = await import('node:fs'); const path = await import('node:path');
  const slug = createReel('Library test reel', '1. hook\n2. body'); fs.mkdirSync(reelDir(slug), { recursive: true }); fs.writeFileSync(path.join(reelDir(slug), 'reel.mp4'), 'x');
  assert.equal(postLibrary().find(i => i.slug === slug).state, 'draft');
  const r = startPostRun(slug, 'review'); assert.equal(r.ctx.slug, slug); assert.equal(r.steps.find(s => s.id === 'render').status, 'done'); assert.equal(r.steps.find(s => s.id === 'post').status, 'pending');
  assert.throws(() => startPostRun(slug), /already in progress/);
  const { cancelRun } = await import('../src/autopilot.mjs'); cancelRun(r.id);
  const m = getMeta(slug); m.status = 'posted'; m.postedAt = new Date().toISOString(); saveMeta(slug, m); assert.equal(postLibrary().find(i => i.slug === slug).state, 'posted');
  assert.throws(() => startPostRun(slug), /already posted/);
});

test('layout QA samples every 2s plus each beat, and no presenter by default', async () => {
  const { sampleTimes } = await import('../src/layoutqa.mjs'); const t = sampleTimes([{ start: 0 }, { start: 4.4 }], 10);
  assert.ok([1, 3, 5, 7, 9].every(x => t.includes(x)) && t.includes(0.5) && t.includes(4.9));
  const { getBrand, saveBrand } = await import('../src/brand.mjs'); assert.notEqual(getBrand().production.avatar, 'founder');
  saveBrand({ production: { avatar: 'founder' } }); assert.equal(getBrand().production.avatar, 'founder'); // an explicit choice after migration sticks
});

test('claude token validates, igStatus remembers a login while the browser is closed', async () => {
  const { setClaudeToken, getClaudeToken } = await import('../src/claude.mjs'); assert.throws(() => setClaudeToken('nope'), /sk-ant/);
  setClaudeToken('sk-ant-oat01-' + 'a'.repeat(30)); assert.ok(getClaudeToken().startsWith('sk-ant-')); setClaudeToken(null); assert.equal(getClaudeToken(), null);
  const { writeJson, home } = await import('../src/util.mjs'); const path = await import('node:path'); writeJson(path.join(home(), 'ig-link.json'), { expires: Math.floor(Date.now() / 1000) + 86400 * 90, at: Date.now() });
  const { igStatus } = await import('../src/setup.mjs'); const s = await igStatus(); assert.equal(s.browser, false); assert.equal(s.loggedIn, true); assert.equal(s.remembered, true);
});

test('composer flow works on an animated fake Instagram page (open, attach, next, caption, share)', async () => {
  const { loadPlaywright, findBrowser } = await import('../src/browser.mjs'); const pw = loadPlaywright(); if (!pw || !findBrowser()) return;
  const { openPage, prepareDeterministic, shareDeterministic } = await import('../src/igflow.mjs'); const path = await import('node:path'); const { pathToFileURL, fileURLToPath } = await import('node:url'); const fs = await import('node:fs'); const os = await import('node:os');
  const port = 9400 + Math.floor(Math.random() * 400); const b = await pw.chromium.launch({ executablePath: findBrowser(), args: ['--no-sandbox', `--remote-debugging-port=${port}`] });
  try {
    const p = await b.newPage(); await p.goto(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fake-instagram.html')).href);
    const vid = path.join(os.tmpdir(), 'rk-fake.mp4'); fs.writeFileSync(vid, 'x');
    const pg = await openPage(port, { urlMatch: /fake-instagram/ });
    const r = await prepareDeterministic(pg, { file: vid, caption: 'Hello caption\nsecond line', trial: false }); assert.equal(r.status, 'ready');
    assert.match(await pg.ev(`document.querySelector('[aria-label^="Write a caption"]').innerText`), /Hello caption/);
    assert.equal((await shareDeterministic(pg)).status, 'posted'); pg.close();
  } finally { await b.close(); }
});
