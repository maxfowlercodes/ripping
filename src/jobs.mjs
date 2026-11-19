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
import { pumpRuns } from './autopilot.mjs';
import { dailyTick } from './daily.mjs';

const dir = () => ensureDir(path.join(home(), 'jobs'));
const jf = id => path.join(dir(), id + '.json');
export const listJobs = () => fs.readdirSync(dir()).filter(f => f.endsWith('.json')).map(f => readJson(path.join(dir(), f), null)).filter(Boolean).sort((a, b) => b.created.localeCompare(a.created));
export function enqueue(type, payload) { const id = crypto.randomBytes(4).toString('hex'); const j = { id, type, payload, status: 'queued', progress: 0, stage: '', log: [], created: new Date().toISOString() }; writeJson(jf(id), j); return j; }
const upd = (j, p) => { Object.assign(j, p); writeJson(jf(j.id), j); };

export async function runJob(j) {
  const log = s => { j.log = [...j.log.slice(-40), s]; writeJson(jf(j.id), j); };
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
  } catch (e) { log('ERROR ' + e.message); upd(j, { status: 'failed', error: e.message }); }
}

let busy = false;
export async function tick() {
  if (busy) return; busy = true;
  try {
    // resume anything left "running" by a crash, then queued
    const next = listJobs().reverse().find(j => j.status === 'running' || j.status === 'queued');
    if (next) await runJob(next);
  } finally { busy = false; }
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
  const t = setInterval(async () => { enqueueDue(); await tick(); await pumpRuns().catch(() => {}); if (!dailyBusy) { dailyBusy = true; dailyTick().catch(() => {}).finally(() => (dailyBusy = false)); } if (Date.now() - lastA > analyzeEveryMs) { lastA = Date.now(); if (process.env.IG_ACCESS_TOKEN || listReels().some(r => r.igMediaId)) enqueue('analyze', {}); } }, intervalMs);
  return () => clearInterval(t);
}
