// Tiny durable job queue + worker. Renders are resumable because renderReel2 caches each scene.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { home, ensureDir, readJson, writeJson } from './util.mjs';
import { getMeta, saveMeta, scriptPath, reelDir } from './store.mjs';
import { parseScript } from './script.mjs';
import { renderReel2 } from './render2.mjs';
import { snapshotDue, snapshotDueWeb } from './analytics.mjs';
import { getBrand } from './brand.mjs';
import { cutFootage } from './footage.mjs';
import { captionFootage } from './footagecap.mjs';
import { publishReel } from './instagram.mjs';
import { listReels } from './store.mjs';
import { pumpRuns, listRuns } from './autopilot.mjs';
import { inJob, isCancelled } from './jobctx.mjs';
import { dailyTick } from './daily.mjs';

const dir = () => ensureDir(path.join(home(), 'jobs'));
const jf = id => path.join(dir(), id + '.json');
export function listJobs(limit = 200) { // newest first; only the newest `limit` files are parsed, so polling stays cheap as history grows
  const d = dir(); const files = fs.readdirSync(d).filter(f => f.endsWith('.json')).map(f => { try { return { f, m: fs.statSync(path.join(d, f)).mtimeMs }; } catch { return null; } }).filter(Boolean).sort((a, b) => b.m - a.m);
  for (const old of files.slice(400)) { try { fs.rmSync(path.join(d, old.f)); } catch {} }
  return files.slice(0, limit).map(x => readJson(path.join(d, x.f), null)).filter(Boolean).sort((a, b) => b.created.localeCompare(a.created));
}
export const getJob = id => (/^[a-f0-9]{8}$/.test(String(id)) ? readJson(path.join(dir(), id + '.json'), null) : null);
export function enqueue(type, payload) { const id = crypto.randomBytes(4).toString('hex'); const j = { id, type, payload, status: 'queued', progress: 0, stage: '', log: [], created: new Date().toISOString() }; writeJson(jf(id), j); return j; }
const upd = (j, p) => { Object.assign(j, p); writeJson(jf(j.id), j); };

export async function runJob(j) { return inJob(j.id, () => runJobInner(j)); }
async function runJobInner(j) {
  const log = s => { const m = String(s).match(/^claude (haiku|sonnet|opus) · (\w+)/); if (m) { j.model = m[1]; j.llmTask = m[2]; j.attempts = (j.attempts || 0) + 1; } j.log = [...j.log.slice(-40), s]; const cur = readJson(jf(j.id), null); if (cur?.cancel) j.cancel = true; writeJson(jf(j.id), j); };
  upd(j, { status: 'running', started: new Date().toISOString() });
  try {
    if (j.type === 'render') {
      const { slug, style, voice, lang, draft, music, avatarFile } = j.payload;
      const sc = parseScript(fs.readFileSync(scriptPath(slug), 'utf8')); const m = getMeta(slug);
      const st = style || m.style || sc.style || 'aurora-dark';
      const out = path.join(reelDir(slug), draft ? 'draft.mp4' : 'reel.mp4');
      const r = await renderReel2({ script: sc, style: st, voice: voice || 'auto', lang: lang || m.lang || 'en', music: music || m.music, out, draft: !!draft, avatarFile, workDir: path.join(reelDir(slug), 'work'), onLog: log,
        onProgress: ({ stage, done, total }) => { j.stage = stage; j.progress = +(((stage === 'voice' ? 0 : 0.2) + (done / total) * (stage === 'voice' ? 0.2 : 0.8)).toFixed(2)); writeJson(jf(j.id), j); } });
      const m2 = getMeta(slug); Object.assign(m2, { durations: r.durations, seconds: r.seconds, style: st, lang: lang || m2.lang || 'en', rendered: new Date().toISOString() }); if (!draft && m2.status !== 'posted' && m2.status !== 'scheduled') m2.status = 'rendered'; saveMeta(slug, m2);
    } else if (j.type === 'browser-test') {
      const { checkInstagram } = await import('./computer.mjs'); const { setBrowserTest } = await import('./setup.mjs'); const r = await checkInstagram({ log }); setBrowserTest({ at: new Date().toISOString(), ...r });
      if (r.loggedIn && r.username) { const { saveBrand } = await import('./brand.mjs'); const u = r.username.replace(/^@/, ''); if (/^[\w.]{1,30}$/.test(u)) saveBrand({ posting: { username: u } }); }
    } else if (j.type === 'find-refs') {
      const { findReels } = await import('./computer.mjs'); const sw = await import('./swipe.mjs'); const out = await findReels({ keywords: j.payload.keywords, max: j.payload.max, log });
      let res; try { res = sw.applyFound(out, { niche: j.payload.niche || 'general', autoSave: j.payload.autoSave || 0 }); } catch (e) { if (e.result) j.result = e.result; throw e; }
      j.result = res; log(`Added ${res.added} reels` + (res.saved ? `, saved the top ${res.saved}` : '') + (res.estimated ? ` (${res.estimated} had no visible view count, so views are estimated from likes)` : ''));
    } else if (j.type === 'install') {
      const { runInstaller, INSTALLERS } = await import('./setup.mjs'); j.stage = INSTALLERS[j.payload.id]?.label || 'Installing'; writeJson(jf(j.id), j); await runInstaller(j.payload.id, log);
    } else if (j.type === 'autofill') {
      const { autofillBrand } = await import('./research.mjs'); const { setAutofill } = await import('./setup.mjs'); const data = await autofillBrand(j.payload.url, { log }); setAutofill({ at: new Date().toISOString(), url: j.payload.url, data });
    } else if (j.type === 'research') {
      const { runResearch } = await import('./research.mjs'); await runResearch({ force: !!j.payload.force, log, onProgress: ({ label, stage }) => { j.stage = label; j.progress = { site: 0.1, audience: 0.35, competitors: 0.6, strategy: 0.85 }[stage] || 0.1; writeJson(jf(j.id), j); } });
    } else if (j.type === 'footage-analyze') {
      const { file, level, lang, model, planFile } = j.payload; log('transcribing (first run downloads the model)...');
      const plan = cutFootage({ input: file, level, lang, model, dryRun: true }); writeJson(planFile, plan); log(`${plan.removed}/${plan.total} words flagged`);
    } else if (j.type === 'footage-render') {
      const { file, level, lang, model, style, captions, overrides, out, planFile } = j.payload; const cut = out.replace(/\.mp4$/, '.cut.mp4');
      const given = readJson(planFile, null)?.words?.map(w => ({ t: w.t, s: w.s, e: w.e }));
      const p = cutFootage({ input: file, out: cut, level, lang, model, overrides, words: given, log });
      if (captions) { log('captioning...'); await captionFootage({ video: cut, words: p.captionWords, style: style || 'volt', out, lang }); } else fs.copyFileSync(cut, out);
      log(`done: ${p.duration}s -> ${p.after}s`);
    } else if (j.type === 'post') {
      const m = getMeta(j.payload.slug); const id = await publishReel({ account: m.account, file: path.join(reelDir(j.payload.slug), 'reel.mp4'), caption: m.caption || m.title, trial: m.trial, log });
      Object.assign(m, { igMediaId: id, status: 'posted', postedAt: new Date().toISOString() }); saveMeta(j.payload.slug, m);
    } else if (j.type === 'analyze') { const n = await snapshotDue(log).catch(() => 0); log(`${n} snapshots`); const u = getBrand().posting.username; if (u) { const w = await snapshotDueWeb({ username: u, log }); log(`${w} web snapshots`); } }
    upd(j, { status: 'done', progress: 1, finished: new Date().toISOString() });
  } catch (e) { if (isCancelled() || e.message === 'Cancelled') { log('Cancelled'); upd(j, { status: 'cancelled', error: '' }); } else { log('ERROR ' + e.message); upd(j, { status: 'failed', error: e.message }); } }
}

// Lanes: different kinds of work run side by side (research never blocks a browser task); within a lane jobs run one at a time.
export const LANE = { render: 'render', 'footage-analyze': 'render', 'footage-render': 'render', install: 'install', 'browser-test': 'browser', 'find-refs': 'browser', post: 'browser', analyze: 'browser', research: 'llm', autofill: 'llm' };
export const laneOf = type => LANE[type] || 'misc';
const activeLane = new Map(); // lane -> job id running in THIS process
export function tick() {
  const open = listJobs().reverse().filter(j => ['queued', 'running'].includes(j.status) && !j.cancel); // oldest first; "running" ones not active here were left by a crash
  for (const j of open) { const lane = laneOf(j.type); if (activeLane.has(lane)) continue; activeLane.set(lane, j.id); runJob(j).catch(() => {}).finally(() => activeLane.delete(lane)); }
}
/** For the UI: what a queued job is waiting for. */
export function queueInfo(j) {
  if (!j || j.status !== 'queued') return null; const lane = laneOf(j.type); const all = listJobs().filter(x => laneOf(x.type) === lane && ['queued', 'running'].includes(x.status) && x.created < j.created);
  const running = all.find(x => x.status === 'running'); return { ahead: all.length, waitingOn: running ? { type: running.type, stage: running.stage || '' } : null };
}
/** Enqueue posts that are due. */
export function enqueueDue() {
  const have = new Set(listJobs().filter(j => j.type === 'post' && ['queued', 'running'].includes(j.status)).map(j => j.payload.slug)); let n = 0;
  for (const r of listReels().filter(r => r.status === 'scheduled' && new Date(r.scheduledAt) <= new Date())) if (!have.has(r.slug)) { enqueue('post', { slug: r.slug }); n++; }
  return n;
}
export function startWorker({ intervalMs = 3000, analyzeEveryMs = 3600e3 } = {}) {
  let lastA = 0;
  let dailyBusy = false;
  const t = setInterval(() => { enqueueDue(); tick(); pumpRuns().catch(() => {}); if (!dailyBusy) { dailyBusy = true; dailyTick().catch(() => {}).finally(() => (dailyBusy = false)); } if (Date.now() - lastA > analyzeEveryMs) { lastA = Date.now(); if (process.env.IG_ACCESS_TOKEN || listReels().some(r => r.igMediaId)) enqueue('analyze', {}); } }, intervalMs);
  return () => clearInterval(t);
}

export function cancelJob(id) {
  const j = getJob(id); if (!j || ['done', 'failed', 'cancelled'].includes(j.status)) return j;
  if (j.status === 'queued') { upd(j, { status: 'cancelled', cancel: true }); return getJob(id); }
  upd(j, { cancel: true }); return getJob(id); // running: the worker notices within a second and stops Claude
}
const TITLES = { 'find-refs': 'Finding references on Instagram', 'browser-test': 'Testing browser control', research: 'Deep research', autofill: 'Reading your website', install: 'Installing', render: 'Rendering', 'footage-analyze': 'Transcribing footage', 'footage-render': 'Cutting footage', post: 'Posting', analyze: 'Reading insights' };
/** Everything running or recently finished, for the global Running tasks box. */
export function activeTasks() {
  const now = Date.now(); const out = [];
  for (const j of listJobs(30)) {
    const finished = ['done', 'failed', 'cancelled'].includes(j.status); const age = j.finished ? now - Date.parse(j.finished) : 0;
    if (finished && !(age < 9000 || (j.status === 'failed' && now - Date.parse(j.finished || j.created) < 120000))) continue; if (finished && !j.finished && now - Date.parse(j.created) > 120000) continue;
    out.push({ id: j.id, kind: 'job', title: j.type === 'install' && j.stage ? j.stage : TITLES[j.type] || j.type, status: j.status, line: j.status === 'queued' ? '' : (j.log || []).slice(-1)[0] || j.stage || '', lines: (j.log || []).slice(-6), progress: j.progress || 0, model: j.model || null, attempts: j.attempts || 0, started: j.started || j.created, queue: queueInfo(j), error: j.error || '', cancellable: ['queued', 'running'].includes(j.status) && !j.cancel, cancelling: !!j.cancel && j.status === 'running' });
  }
  for (const r of listRuns().slice(0, 3)) if (['queued', 'running', 'waiting'].includes(r.status)) { const step = r.steps.find(s => ['running', 'waiting'].includes(s.status)) || r.steps.find(s => s.status === 'pending'); out.push({ id: r.id, kind: 'run', title: 'Make & Post', status: r.status === 'waiting' ? 'waiting' : 'running', line: step ? `${step.name}${step.detail ? ': ' + step.detail : ''}` : '', lines: (r.log || []).slice(-6), progress: r.steps.filter(s => s.status === 'done').length / r.steps.length, model: null, started: r.created, error: '', cancellable: true, waiting: r.gate?.message || '' }); }
  return out;
}
