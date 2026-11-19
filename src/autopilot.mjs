// One-click "Make & Post": brand check → references → idea → script → render → caption → post → track.
// Durable (runs/<id>.json), resumable after a crash/restart, pauses at gates that need you (references, review before posting).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { home, ensureDir, readJson, writeJson, run as sh, isWin, isMac } from './util.mjs';
import { getBrand, missingBrand } from './brand.mjs';
import { addInbox, resolveItem, getItem } from './inbox.mjs';
import { askClaude } from './claude.mjs';
import { schemas, SYSTEM, scriptPrompt, lintFixPrompt, captionPrompt } from './prompts.mjs';
import { listIdeas, setIdea, generateIdeas, referenceCount } from './ideas.mjs';
import { listSwipe, addFromText } from './swipe.mjs';
import { parseScript, lint, virality } from './script.mjs';
import { createReel, getMeta, saveMeta, scriptPath, reelDir } from './store.mjs';
import { renderReel2 } from './render2.mjs';
import { prepareReelPost, sharePost } from './computer.mjs';
import { publishReel } from './instagram.mjs';
import { makeAvatar } from './heygen.mjs';
import { rankStyles, validStyle } from './stylecatalog.mjs';
import { runResearch, getResearch } from './research.mjs';

export const STEPS = [['brand', 'Brand profile'], ['research', 'Deep research'], ['refs', 'References'], ['idea', 'Choose idea'], ['script', 'Write script'], ['render', 'Render video'], ['caption', 'Caption'], ['post', 'Post'], ['track', 'Track results']];
const dir = () => ensureDir(path.join(home(), 'runs'));
const rf = id => path.join(dir(), id + '.json');
export const getRun = id => readJson(rf(id), null);
export const listRuns = () => fs.readdirSync(dir()).filter(f => f.endsWith('.json')).map(f => readJson(path.join(dir(), f), null)).filter(Boolean).sort((a, b) => b.created.localeCompare(a.created));
const save = r => { r.updated = Date.now(); writeJson(rf(r.id), r); };

export function startRun(opts = {}) {
  const b = getBrand(); const id = crypto.randomBytes(4).toString('hex');
  const r = { id, status: 'queued', created: new Date().toISOString(), opts: { post: b.posting.mode, ...opts }, steps: STEPS.map(([sid, name]) => ({ id: sid, name, status: 'pending' })), ctx: {}, log: [] };
  if (opts.preset) { r.ctx = { slug: opts.preset.slug, caption: opts.preset.caption, idea: { hook: opts.preset.title } }; const cut = STEPS.findIndex(x => x[0] === 'post'); r.steps.forEach((st, i) => { if (i < cut) { st.status = 'done'; st.detail = st.id === 'render' ? 'existing video' : ''; } }); delete r.opts.preset; }
  save(r); return r;
}

class Wait extends Error { constructor(gate) { super('waiting'); this.gate = gate; } }

/** Called when the user answers an inbox item that a run is waiting on. */
export function answerGate(runId, answer) {
  const r = getRun(runId); if (!r || r.status !== 'waiting') return r;
  if (r.gate?.inboxId) resolveItem(r.gate.inboxId, answer);
  r.ctx.answers = { ...(r.ctx.answers || {}), [r.gate.type]: answer }; r.status = 'queued'; r.gate = null; save(r); return r;
}

const setStep = (r, id, patch) => { const s = r.steps.find(x => x.id === id); Object.assign(s, patch); save(r); return s; };
const logR = (r, m) => { r.log = [...r.log.slice(-60), `${new Date().toISOString().slice(11, 19)} ${m}`]; save(r); };

async function stepBrand(r) { const miss = missingBrand(); if (miss.length) throw new Wait({ type: 'brand', message: 'Tell me about your product first: ' + miss.join(', '), inbox: { type: 'need-brand', title: 'Set up your brand', body: 'Missing: ' + miss.join(', ') } }); return 'ok'; }

async function stepResearch(r) {
  const cur = getResearch(); if (r.opts.skipResearch || cur?.finished) return cur?.finished ? 'done earlier (reelkit deep-research --refresh to redo)' : 'skipped';
  const res = await runResearch({ log: m => logR(r, m), onProgress: ({ label }) => { const s = r.steps.find(x => x.id === 'research'); s.detail = label; save(r); } });
  return `${Object.values(res.stages).filter(x => x.status === 'done').length} stages, report in research.md`;
}

async function stepRefs(r) {
  const b = getBrand(); const have = referenceCount(); const a = r.ctx.answers?.refs;
  if (a?.text) addFromText(a.text, b.niche || 'general');
  if (referenceCount() >= b.daily.minReferences || a?.skip || r.opts.skipRefs) return `${referenceCount()} references`;
  if (!b.daily.requireReferences) return `${referenceCount()} references saved. Using your research instead; add references any time for better ideas`;
  throw new Wait({ type: 'refs', message: `I have ${have} reference reels, I'd like ${b.daily.minReferences}+. Paste some (url | views | baseline) or skip.`, inbox: { type: 'ask-references', title: 'Any reference reels today?', body: 'Paste links of reels that did well in your niche (url | views | account size). Or skip.' } });
}

async function stepIdea(r) {
  if (r.ctx.idea) return r.ctx.idea.hook;
  let idea = r.opts.idea || null;
  if (!idea) { idea = listIdeas('approved')[0] || listIdeas('new')[0]; }
  if (!idea) { logR(r, 'generating ideas'); const fresh = await generateIdeas({ n: 5, log: m => logR(r, m) }); idea = fresh[0]; }
  if (!idea) throw new Error('No idea available');
  if (idea.id) setIdea(idea.id, { status: 'used' });
  r.ctx.idea = { hook: idea.hook, payoff: idea.payoff, borrows: idea.borrows }; save(r); return idea.hook;
}

async function stepScript(r) {
  if (r.ctx.slug) return r.ctx.slug;
  const b = getBrand(); const refs = listSwipe({ status: 'saved' }); const lang = b.production.lang || 'en';
  const auto = (b.production.style || 'auto') === 'auto'; const shortlist = auto ? rankStyles({ brand: b }).slice(0, 6) : null;
  const w = await askClaude({ task: 'script_write', prompt: scriptPrompt({ brand: b, idea: r.ctx.idea, refs, lang, styles: shortlist }), system: SYSTEM, schema: schemas.script, log: m => logR(r, m) });
  let { title, lines } = w.output; let sc, l, attempt = 0;
  const style = auto ? (shortlist.some(x => x.name === w.output.style) || validStyle(w.output.style) ? w.output.style : shortlist[0].name) : b.production.style; r.ctx.style = style;
  for (;; attempt++) {
    sc = parseScript(`# ${title}\n${lines.join('\n')}`); l = lint(sc);
    if (l.score >= 85 || attempt >= 2) break;
    const issues = l.checks.filter(c => !c.pass).map(c => c.msg); logR(r, `lint ${l.score}: fixing (${issues.length} issues)`);
    const f = await askClaude({ task: 'lint_fix', prompt: lintFixPrompt({ lines, issues }), system: SYSTEM, schema: schemas.script, log: m => logR(r, m) }); lines = f.output.lines; title = f.output.title || title;
  }
  const slug = createReel(title, `# ${title}\n[style: ${style}]\n${lines.join('\n')}\n`); const m = getMeta(slug); Object.assign(m, { lang, lint: l.score, idea: r.ctx.idea, runId: r.id }); saveMeta(slug, m);
  r.ctx.slug = slug; r.ctx.lint = l.score; save(r); return `${slug} (lint ${l.score}, style ${style}, ${w.model}${w.cached ? ', cached' : ''})`;
}

async function stepRender(r) {
  const slug = r.ctx.slug; const out = path.join(reelDir(slug), 'reel.mp4'); if (r.ctx.rendered && fs.existsSync(out)) return 'rendered';
  const b = getBrand(); const sc = parseScript(fs.readFileSync(scriptPath(slug), 'utf8')); const P = b.production; let avatarFile, avatar = P.avatar && P.avatar !== 'none' ? P.avatar : undefined;
  if (avatar && avatar.startsWith('heygen')) { const [, aid, vid] = avatar.split(':'); avatarFile = path.join(reelDir(slug), 'avatar.mp4'); if (!fs.existsSync(avatarFile)) { logR(r, 'HeyGen avatar...'); await makeAvatar({ text: sc.beats.join(' '), avatarId: aid, voiceId: vid, out: avatarFile }); } }
  const res = await renderReel2({ script: sc, style: sc.style || (P.style === 'auto' ? rankStyles({ brand: b })[0].name : P.style), voice: P.voice, voiceId: P.voiceId || undefined, sfx: P.sfx !== false, lang: P.lang, music: P.music || undefined, out, avatar, avatarFile, brandColors: P.brandColors || undefined, workDir: path.join(reelDir(slug), 'work'), onLog: m => logR(r, m.trim()), onProgress: ({ stage, done, total }) => { const s = r.steps.find(x => x.id === 'render'); s.detail = `${stage} ${done}/${total}`; save(r); } });
  const m = getMeta(slug); const v = virality(sc, res.durations); Object.assign(m, { status: 'rendered', durations: res.durations, seconds: res.seconds, style: res.style || sc.style || (P.style === 'auto' ? rankStyles({ brand: b })[0].name : P.style), qa: res.qa || undefined, virality: { score: v.score, estSkipRate: v.estSkipRate }, rendered: new Date().toISOString() }); saveMeta(slug, m);
  r.ctx.rendered = true; r.ctx.virality = v.score; save(r); return `${res.seconds}s, virality ${v.score}${res.qa ? `, layout ${res.qa.clashes ? res.qa.clashes + ' clash(es) left in ' + res.style : 'clean (' + res.qa.checked + ' checks)'}` : ''}`;
}

async function stepCaption(r) {
  if (r.ctx.caption) return 'ok'; const b = getBrand(); const sc = parseScript(fs.readFileSync(scriptPath(r.ctx.slug), 'utf8'));
  const c = await askClaude({ task: 'caption_hashtags', prompt: captionPrompt({ brand: b, lines: sc.beats }), system: SYSTEM, schema: schemas.caption, log: m => logR(r, m) });
  r.ctx.caption = `${c.output.caption}\n\n${(c.output.hashtags || []).slice(0, 3).join(' ')}`.trim(); const m = getMeta(r.ctx.slug); m.caption = r.ctx.caption; saveMeta(r.ctx.slug, m); save(r); return c.model;
}

async function stepPost(r) {
  const b = getBrand(); const slug = r.ctx.slug; const file = path.resolve(reelDir(slug), 'reel.mp4'); const mode = r.opts.post || b.posting.mode; const method = r.opts.method || b.posting.method;
  if (mode === 'none') return 'not posting (render only)';
  if (r.opts.at && new Date(r.opts.at) > new Date()) throw new Wait({ type: 'time', until: r.opts.at, message: 'Scheduled for ' + r.opts.at });
  const markPosted = (extra = {}) => { const m = getMeta(slug); Object.assign(m, { status: 'posted', postedAt: new Date().toISOString(), postedVia: method, account: b.posting.account || m.account, ...extra }); saveMeta(slug, m); };
  const review = (title, body) => { throw new Wait({ type: 'review', message: title, inbox: { type: 'review-post', title, body, payload: { slug, caption: r.ctx.caption, method } } }); };
  if (method === 'manual') { copyClipboard(r.ctx.caption); addInbox({ type: 'info', title: 'Reel ready to post', body: `Caption copied. File: ${file}` }); return 'manual: caption copied, file ready'; }
  if (method === 'api') {
    if (mode === 'review' && !r.ctx.answers?.review) review('Publish this reel to Instagram?', r.ctx.caption);
    if (r.ctx.answers?.review?.action === 'cancel') return 'cancelled';
    const id = await publishReel({ account: b.posting.account || undefined, file, caption: r.ctx.caption, trial: b.posting.trial, log: m => logR(r, m) }); markPosted({ igMediaId: id }); return 'posted via API'; }
  // computer use
  if (!r.ctx.prepared) { logR(r, 'Claude is preparing the post in your browser...'); const p = await prepareReelPost({ file, caption: r.ctx.caption, trial: b.posting.trial, log: m => logR(r, m) });
    if (p.status === 'login_required') { addInbox({ type: 'need-login', title: 'Log in to Instagram', body: 'Open the Reelkit browser window, log in, then press Resume.', payload: { runId: r.id } }); throw new Wait({ type: 'login', message: 'Log in to Instagram in the Reelkit browser window, then resume.' }); }
    r.ctx.prepared = true; save(r); }
  if (mode === 'review' && !r.ctx.answers?.review) review('Ready to share: check the browser window', r.ctx.caption);
  const a = r.ctx.answers?.review?.action;
  if (a === 'cancel') return 'cancelled (nothing shared)'; if (a === 'manual-done') { markPosted(); return 'you shared it manually'; }
  logR(r, 'Claude is clicking Share...'); const s = await sharePost({ log: m => logR(r, m) });
  if (s.status !== 'posted') throw new Error('Share not confirmed: ' + (s.note || s.status)); markPosted({ permalink: s.url }); return s.url ? 'posted ' + s.url : 'posted';
}
async function stepTrack(r) { return 'snapshots are taken at 1h, day 1, 3, 7, 14, 30 while Reelkit is running'; }
const FN = { brand: stepBrand, research: stepResearch, refs: stepRefs, idea: stepIdea, script: stepScript, render: stepRender, caption: stepCaption, post: stepPost, track: stepTrack };

export function copyClipboard(text) { try { if (isWin) sh('clip', [], { input: text }); else if (isMac) sh('pbcopy', [], { input: text }); else sh('xclip', ['-selection', 'clipboard'], { input: text }); } catch {} }

const activeRuns = new Set(); // runs executing in THIS process (guards against the worker loop starting the same run twice)
export async function executeRun(id) {
  if (activeRuns.has(id)) return getRun(id);
  const r = getRun(id); if (!r || ['done', 'failed', 'cancelled'].includes(r.status)) return r; activeRuns.add(id); r.status = 'running'; save(r);
  try {
    for (const s of r.steps) {
      if (s.status === 'done' || s.status === 'skipped') continue;
      setStep(r, s.id, { status: 'running', started: new Date().toISOString() });
      try { const detail = await FN[s.id](r); setStep(r, s.id, { status: 'done', detail: String(detail ?? ''), finished: new Date().toISOString() }); }
      catch (e) {
        if (e instanceof Wait) {
          const g = e.gate; r.status = 'waiting'; r.gate = { type: g.type, message: g.message, until: g.until }; if (g.inbox) { const it = addInbox({ ...g.inbox, payload: { ...(g.inbox.payload || {}), runId: r.id } }); r.gate.inboxId = it.id; }
          setStep(r, s.id, { status: 'waiting', detail: g.message }); return r;
        }
        throw e;
      }
    }
    r.status = 'done'; r.finished = new Date().toISOString(); save(r);
  } catch (e) { r.status = 'failed'; r.error = e.message; const s = r.steps.find(x => x.status === 'running'); if (s) { s.status = 'failed'; s.detail = e.message; } save(r); addInbox({ type: 'error', title: 'Make & Post failed', body: e.message, payload: { runId: r.id } }); } finally { activeRuns.delete(id); }
  return getRun(id);
}
/** Called by the worker: continue queued/crashed runs and release time-gated ones. */
export async function pumpRuns() {
  if (activeRuns.size) return false; // one run at a time per process
  for (const r of listRuns().reverse()) {
    if (r.status === 'waiting' && r.gate?.type === 'time' && new Date(r.gate.until) <= new Date()) { r.status = 'queued'; r.gate = null; save(r); }
    if (r.status === 'queued' || r.status === 'running') { await executeRun(r.id); return true; }
  }
  return false;
}
export function cancelRun(id) { const r = getRun(id); if (r && !['done', 'failed'].includes(r.status)) { r.status = 'cancelled'; if (r.gate?.inboxId) resolveItem(r.gate.inboxId, { cancelled: true }, 'dismissed'); save(r); } return r; }
