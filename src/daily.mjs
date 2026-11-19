// The daily routine: ask for references and today's focus, show yesterday's numbers, propose ideas, optionally auto-run.
import path from 'node:path';
import { home, readJson, writeJson } from './util.mjs';
import { getBrand, missingBrand } from './brand.mjs';
import { addInbox, listInbox } from './inbox.mjs';
import { summary } from './analytics.mjs';
import { generateIdeas, listIdeas, referenceCount } from './ideas.mjs';
import { getSettings, usageToday } from './claude.mjs';
import { startRun, listRuns } from './autopilot.mjs';

const sf = () => path.join(home(), 'state.json');
const state = () => readJson(sf(), {});
const setState = p => writeJson(sf(), { ...state(), ...p });
const today = () => new Date().toISOString().slice(0, 10);
const minutes = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); };

export async function dailyTick(now = new Date(), log = () => {}) {
  const b = getBrand(); if (!b.daily.enabled) return null; const st = state();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  // 1. create today's check-in
  if (st.lastDaily !== today() && nowMin >= minutes(b.daily.time)) {
    setState({ lastDaily: today() });
    const s = summary(); const need = missingBrand(b); const refs = referenceCount(); const lines = [];
    if (need.length) lines.push('First, finish your brand profile (' + need.join(', ') + ').');
    lines.push(s.reels.length ? `Yesterday-to-date: ${s.totalViews.toLocaleString()} total views, rank ${s.rank.name}. Best reel: "${s.reels[0].title}" (${s.reels[0].views.toLocaleString()}).` : 'No posted reels yet.');
    lines.push(`References saved: ${refs}${refs < b.daily.minReferences ? ` (want ${b.daily.minReferences}+). Drop 1-3 new ones today.` : '. Add any new ones you spotted.'}`);
    const it = addInbox({ type: 'checkin', title: 'Daily check-in', body: lines.join('\n'), payload: { date: today() }, dedupeKey: 'checkin-' + today() });
    // 2. propose ideas (skip when the queue already has enough, or when brand is incomplete)
    if (!need.length && listIdeas('new').length < 3) { try { const fresh = await generateIdeas({ n: 5, log }); if (fresh.length) addInbox({ type: 'approve-ideas', title: `${fresh.length} ideas for today`, body: fresh.map(i => '• ' + i.hook).join('\n'), payload: { ids: fresh.map(i => i.id) } }); } catch (e) { log('ideas failed: ' + e.message); } }
    if (b.daily.autopilot) setState({ autopilotAt: new Date(now.getTime() + b.daily.graceMinutes * 60000).toISOString(), autopilotFor: it.id });
    return it;
  }
  // 3. autopilot after the grace period if the check-in is still open and nothing is running
  const st2 = state();
  if (b.daily.autopilot && st2.autopilotAt && new Date(st2.autopilotAt) <= now) {
    setState({ autopilotAt: null });
    const busy = listRuns().some(r => ['queued', 'running', 'waiting'].includes(r.status));
    if (!busy && !missingBrand(b).length) { const r = startRun({ auto: true }); log('daily autopilot run ' + r.id); return r; }
  }
  return null;
}
