import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
process.env.REELKIT_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'rk-v5-'));
process.env.REELKIT_CLAUDE_DRYRUN = '1';
process.env.REELKIT_CDP_PORT = '9555'; process.env.REELKIT_PROFILE = path.join(process.env.REELKIT_HOME, 'prof'); process.env.REELKIT_IG_URL = 'http://localhost:8766';
const { INSTALLERS, runInstaller, systemCheck, getOnboarding, setOnboarding, claudeStatus } = await import('../src/setup.mjs');
const { startDashboard } = await import('../src/dashboard.mjs');

test('installers are a fixed whitelist of fixed commands', async () => {
  for (const [id, inst] of Object.entries(INSTALLERS)) { assert.ok(inst.label, id); for (const s of inst.steps) { assert.ok(s.fn || (typeof s.cmd === 'string' && Array.isArray(s.args)), id); for (const a of s.args || []) assert.equal(typeof a, 'string'); } }
  await assert.rejects(() => runInstaller('rm -rf /'), /unknown installer/); await assert.rejects(() => runInstaller('__proto__'), /unknown installer/);
});
test('system check rows are well formed and required items are flagged with a fix', async () => {
  const rows = await systemCheck(); const ids = rows.map(r => r.id); for (const id of ['node', 'media', 'browser', 'python', 'claude', 'claude-login', 'whisper', 'voice', 'ig']) assert.ok(ids.includes(id), id);
  for (const r of rows) { assert.equal(typeof r.ok, 'boolean'); assert.ok(r.label && r.detail); if (!r.ok) assert.ok(['install', 'terminal', 'open', 'manual'].includes(r.fix.kind), r.id); }
  assert.equal(rows.find(r => r.id === 'node').ok, true);
});
test('claude status never throws even if the CLI is missing', () => { const s = claudeStatus(); assert.equal(typeof s.installed, 'boolean'); assert.equal(typeof s.loggedIn, 'boolean'); });
test('onboarding progress persists and merges', () => {
  assert.deepEqual(getOnboarding(), { step: 0, done: false }); setOnboarding({ step: 4 }); assert.equal(getOnboarding().step, 4); setOnboarding({ done: true }); assert.deepEqual([getOnboarding().step, getOnboarding().done], [4, true]);
  setOnboarding({ step: 0, done: false });
});
test('dashboard setup API: whitelist enforced, autofill input validated, state carries onboarding', async () => {
  const srv = startDashboard({ port: 0 + 4299, worker: false }); await new Promise(r => setTimeout(r, 400));
  const call = (p, body) => new Promise((res, rej) => { const d = body ? JSON.stringify(body) : null; const q = http.request({ host: '127.0.0.1', port: 4299, path: p, method: body ? 'POST' : 'GET', headers: d ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(d) } : {} }, r => { let b = ''; r.on('data', x => (b += x)); r.on('end', () => res({ code: r.statusCode, json: (() => { try { return JSON.parse(b); } catch { return null; } })() })); }); q.on('error', rej); q.end(d); });
  try {
    assert.equal((await call('/api/setup/install', { id: 'rm -rf /' })).code, 400); assert.equal((await call('/api/setup/install', { id: 'whisper' })).code, 200);
    assert.equal((await call('/api/setup/autofill', { url: 'file:///etc/passwd' })).code, 400); assert.equal((await call('/api/setup/autofill', { url: 'javascript:alert(1)' })).code, 400);
    const ob = await call('/api/onboarding', { step: 3 }); assert.equal(ob.json.step, 3); const st = await call('/api/state'); assert.equal(st.json.onboarding.step, 3); assert.equal(st.json.mode, 'eco');
    const chk = await call('/api/setup/check'); assert.ok(chk.json.rows.length >= 9);
    const html = await new Promise(r => http.get({ host: '127.0.0.1', port: 4299, path: '/' }, x => { let b = ''; x.on('data', d => (b += d)); x.on('end', () => r(b)); })); assert.ok(html.includes('/ui.js') && html.includes('/onboarding.js'));
    assert.equal((await call('/ui.js')).code, 200);
  } finally { srv.close(); }
});
test('Instagram login detection reads the session cookie from the Reelkit browser (real headless Chrome)', async t => {
  const { findBrowser, loadPlaywright } = await import('../src/browser.mjs'); if (!findBrowser() || !loadPlaywright()) return t.skip('no browser');
  const site = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>mock</title>'); }).listen(8766);
  const comp = await import('../src/computer.mjs'); const setup = await import('../src/setup.mjs');
  try {
    assert.deepEqual(await setup.igStatus(), { browser: false, loggedIn: false });
    await comp.ensureBrowser('http://localhost:8766/'); const before = await setup.igStatus(); assert.equal(before.browser, true); assert.equal(before.loggedIn, false);
    const pw = loadPlaywright(); const b = await pw.chromium.connectOverCDP('http://127.0.0.1:9555'); await b.contexts()[0].addCookies([{ name: 'sessionid', value: 'abc123', url: 'http://localhost:8766/' }]); await b.close();
    assert.equal((await setup.igStatus()).loggedIn, true);
  } finally { spawnSync('pkill', ['-f', 'remote-debugging-port=9555']); site.close(); }
});
