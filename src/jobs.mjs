// Tiny durable job queue + worker. Renders are resumable because renderReel2 caches each scene.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { home, ensureDir, readJson, writeJson } from './util.mjs';
import { getMeta, saveMeta, scriptPath, reelDir } from './store.mjs';
import { parseScript } from './script.mjs';
import { renderReel2 } from './render2.mjs';
import { snapshotDue } from './analytics.mjs';
import { publishReel } from './instagram.mjs';
import { listReels } from './store.mjs';

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
    } else if (j.type === 'post') {
      const m = getMeta(j.payload.slug); const id = await publishReel({ account: m.account, file: path.join(reelDir(j.payload.slug), 'reel.mp4'), caption: m.caption || m.title, trial: m.trial, log });
      Object.assign(m, { igMediaId: id, status: 'posted', postedAt: new Date().toISOString() }); saveMeta(j.payload.slug, m);
    } else if (j.type === 'analyze') { const n = await snapshotDue(log); log(`${n} snapshots`); }
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
  const t = setInterval(async () => { enqueueDue(); await tick(); if (Date.now() - lastA > analyzeEveryMs) { lastA = Date.now(); if (process.env.IG_ACCESS_TOKEN || listReels().some(r => r.igMediaId)) enqueue('analyze', {}); } }, intervalMs);
  return () => clearInterval(t);
}
