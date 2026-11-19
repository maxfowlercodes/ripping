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
