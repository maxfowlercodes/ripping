// Posts library: every reel in one of five honest states, so a half-finished or broken post is never hidden.
//   draft      rendered, never sent to Instagram
//   review     Claude has filled in the post in the browser and is waiting for your OK (nothing shared yet)
//   attention  a post attempt stopped halfway (error, cancelled, app closed) - shows why and offers retry
//   scheduled  will go out at a set time
//   posted     confirmed shared
import fs from 'node:fs';
import path from 'node:path';
import { listReels, getMeta, reelDir } from './store.mjs';
import { listRuns, startRun } from './autopilot.mjs';
import { listJobs } from './jobs.mjs';

const STALE_MS = 10 * 60 * 1000;
export function postLibrary() {
  const runs = listRuns(); const jobs = listJobs(60); const out = [];
  for (const m of listReels()) {
    const hasVideo = fs.existsSync(path.join(reelDir(m.slug), 'reel.mp4'));
    const myRuns = runs.filter(r => r.ctx?.slug === m.slug);
    const live = myRuns.find(r => ['queued', 'running', 'waiting'].includes(r.status));
    const postStep = r => r.steps.find(s => s.id === 'post');
    const base = { slug: m.slug, title: m.title, caption: m.caption || '', hasVideo, created: m.created, seconds: m.seconds, trial: !!m.trial };
    if (m.status === 'posted') { out.push({ ...base, state: 'posted', at: m.postedAt, permalink: m.permalink || '', via: m.postedVia || (m.igMediaId ? 'api' : ''), views: m.snapshots?.at?.(-1)?.views ?? null }); continue; }
    if (live && live.status === 'waiting' && live.gate?.type === 'review') { out.push({ ...base, state: 'review', runId: live.id, inboxId: live.gate.inboxId, at: live.updated, detail: 'Filled in on Instagram, waiting for your OK. Nothing has been shared.' }); continue; }
    if (live && postStep(live)?.status !== 'pending') { out.push({ ...base, state: 'attention', runId: live.id, at: live.updated, detail: live.status === 'waiting' ? (live.gate?.message || 'Waiting for you') : 'Posting is in progress...', live: true }); continue; }
    if (live) { out.push({ ...base, state: 'draft', runId: live.id, at: live.updated, detail: 'Still being made...', live: true }); continue; }
    const broken = myRuns.find(r => ['failed', 'cancelled'].includes(r.status) && postStep(r)?.status !== 'pending');
    const failedJob = jobs.find(j => j.type === 'post' && j.payload?.slug === m.slug && ['failed', 'cancelled'].includes(j.status));
    if (m.status !== 'scheduled' && (broken || failedJob)) {
      const why = broken ? (broken.error || postStep(broken)?.detail || 'Stopped before sharing') : (failedJob.error || 'Post cancelled');
      out.push({ ...base, state: 'attention', runId: broken?.id, at: broken?.updated || failedJob.finished, detail: why + '. Nothing was posted unless it appears under Posted.', prepared: !!broken?.ctx?.prepared }); continue;
    }
    if (m.status === 'scheduled') { out.push({ ...base, state: 'scheduled', at: m.scheduledAt }); continue; }
    out.push({ ...base, state: 'draft', at: m.rendered || m.created });
  }
  const order = { review: 0, attention: 1, scheduled: 2, draft: 3, posted: 4 };
  return out.sort((a, b) => order[a.state] - order[b.state] || String(b.at || '').localeCompare(String(a.at || '')));
}

/** Post an existing reel through the same guarded Make & Post pipeline (steps before Post are marked done). */
export function startPostRun(slug, mode = 'review') {
  const m = getMeta(slug); if (!m) throw new Error('Unknown reel'); if (m.status === 'posted') throw new Error('This reel is already posted');
  if (!fs.existsSync(path.join(reelDir(slug), 'reel.mp4'))) throw new Error('This reel has no video yet. Render it in Produce first.');
  const live = listRuns().find(r => ['queued', 'running', 'waiting'].includes(r.status)); if (live) throw new Error('Another run is already in progress. Cancel it or let it finish.');
  return startRun({ post: mode, skipRefs: true, skipResearch: true, preset: { slug, caption: m.caption || m.title, title: m.title } });
}