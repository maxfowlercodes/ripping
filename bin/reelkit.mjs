#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseScript, lint, virality } from '../src/script.mjs';
import { renderReel as renderBasic } from '../src/render.mjs';
import { renderReel2, renderCarouselPng, styleList } from '../src/render2.mjs';
import { detectProvider } from '../src/voice.mjs';
import { publishReel, accountInsights } from '../src/instagram.mjs';
import { createReel, getMeta, saveMeta, listReels, scriptPath, reelDir } from '../src/store.mjs';
import { has, home, findFont, ensureMediaTools } from '../src/util.mjs';
import { startDashboard } from '../src/dashboard.mjs';
import { applySecrets, addAccount, setKey, listAccounts, secretsPath } from '../src/accounts.mjs';
import { browserAvailable, findBrowser, launch } from '../src/browser.mjs';
import { summary, snapshotDue, calibrate } from '../src/analytics.mjs';
import * as swipe from '../src/swipe.mjs';
import { repurpose, branch } from '../src/repurpose.mjs';
import { cutFootage, FILLER_LEVELS } from '../src/footage.mjs';
import { makeAvatar, listAvatars } from '../src/heygen.mjs';
import { startWorker, enqueueDue, tick, listJobs } from '../src/jobs.mjs';
import { getBrand, saveBrand, missingBrand } from '../src/brand.mjs';
import { getSettings, saveSettings, usageToday, TASKS, modelFor, askClaude, claudeAvailable, CODE_ONLY } from '../src/claude.mjs';
import { listInbox, resolveItem, addInbox } from '../src/inbox.mjs';
import { startRun, executeRun, answerGate, listRuns, getRun, cancelRun } from '../src/autopilot.mjs';
import { generateIdeas, listIdeas } from '../src/ideas.mjs';
import { dailyTick } from '../src/daily.mjs';
import { ensureBrowser, researchReels } from '../src/computer.mjs';
import { captionFootage } from '../src/footagecap.mjs';
import { installPiperVoice, piperAvailable, PIPER_VOICES } from '../src/voice.mjs';
import { whisperAvailable } from '../src/transcribe.mjs';

applySecrets(); ensureMediaTools();
const [cmd, ...rest] = process.argv.slice(2);
const flags = {}; const pos = [];
for (let i = 0; i < rest.length; i++) { if (rest[i].startsWith('--')) { const k = rest[i].slice(2); const v = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true; flags[k] = v; } else pos.push(rest[i]); }
const need = s => { if (!s || !getMeta(s)) { console.error(`No such reel "${s}". Run: reelkit list`); process.exit(1); } return s; };
const load = s => parseScript(fs.readFileSync(scriptPath(need(s)), 'utf8'));

const help = `reelkit: free local short-form video studio (swipe > script > produce > post > analyze > repurpose)

 SETUP    doctor | key elevenlabs|heygen <key> | account add <name> --user-id ID --token T | account list
 SWIPE    swipe add --url U --creator C --views N --baseline N --caption "..." | swipe import <csv|json>
          swipe discover <user,user> --niche N | swipe list [--saved] | swipe save <id> | swipe skip <id>
 SCRIPT   new "<title>" [--file f] | list | lint <reel> | score <reel> | branch <reel> "<title>" --lines file
 PRODUCE  styles | render <reel> [--style s] [--voice v] [--lang xx] [--music f] [--draft] [--avatar founder|robot|blob|heygen:ID:VOICE] [--basic]
          footage <video> [--level light|standard|aggressive] [--style volt] [--dry]   (filler/stutter/pause cutter + audio clean + captions)
          voices [install <lang>]
 AI       brand [set k v] | mode [eco|balanced|quality] | route <task> <model> | usage | claude | ideas [--generate] | refs [add "url | views | baseline | caption"]
          autopilot [--post review|auto|none] [--at ISO]  (one-click Make & Post) | autopilot status|answer|resume | inbox | daily | research --handles a,b | browser
 POST     queue <reel> --at ISO [--caption "..."] [--account A] [--trial] | post <reel> | post --due
 ANALYZE  analyze | rank | calibrate
 REPURPOSE repurpose <reel> [--style s] | hooks <reel> [--add "hook"]
 RUN      dashboard [--port N] [--lan] | worker`;

const TEMPLATE = t => `# ${t}
// One line = one beat. First line = hook (<=8 words). Last line = one action.
// Add visuals at the end of a line, e.g. {counter: 628 | teams onboarded | +64%}  {bars: A=10>40, B=5>20 | title | %}
// Mark key words with *asterisks*.
// [style: aurora-dark]
Stop posting *reels* nobody watches.
Most founders open with "hey guys".
That costs you 60% of viewers in 2 seconds. {chart: down}
Open with the result instead.
Show the number, then the how. {counter: 628 | teams onboarded | +64%}
One idea per line, one visual per idea.
Comment *REEL* and I'll send the template.
`;

try {
  switch (cmd) {
    case 'doctor': {
      const ok = (b, t, fix) => console.log(`${b ? '✔' : '✘'} ${t}${!b && fix ? '   -> ' + fix : ''}`);
      ok(has('ffmpeg') && has('ffprobe'), 'ffmpeg + ffprobe (required)', 'winget install Gyan.FFmpeg');
      ok(!!findFont(), 'bold font', 'set REELKIT_FONT');
      ok(browserAvailable() && !!findBrowser(), `Chrome/Edge + playwright-core (motion renderer)${findBrowser() ? ': ' + findBrowser() : ''}`, 'npm install   (needs Chrome or Edge installed)');
      console.log(`  voice provider: ${detectProvider('auto')}`);
      ok(piperAvailable(), 'Piper offline voices (free, recommended)', 'pip install piper-tts ; reelkit voices install en'); ok(whisperAvailable(), 'faster-whisper (filler-word cutting, exact caption sync)', 'pip install faster-whisper');
      ok(listAccounts().length > 0, `Instagram accounts: ${listAccounts().map(a => a.name).join(', ') || 'none'}`, 'reelkit account add ... (docs/INSTAGRAM.md)');
      ok(!!process.env.HEYGEN_API_KEY, 'HeyGen key (optional)'); ok(has('claude'), 'Claude Code CLI (optional AI brain)', 'npm i -g @anthropic-ai/claude-code');
      console.log('  data dir: ' + home() + '\n  secrets : ' + secretsPath()); break; }
    case 'key': { const map = { elevenlabs: 'elevenlabs', heygen: 'heygen', 'elevenlabs-voice': 'elevenlabsVoice' }; if (!map[pos[0]] || !pos[1]) throw new Error('usage: key elevenlabs|heygen <key>'); setKey(map[pos[0]], pos[1]); console.log('Saved to ' + secretsPath()); break; }
    case 'account': {
      if (pos[0] === 'add') { if (!pos[1] || !flags['user-id'] || !flags.token) throw new Error('usage: account add <name> --user-id ID --token TOKEN'); addAccount(pos[1], String(flags['user-id']), String(flags.token)); console.log('Saved to ' + secretsPath()); }
      else console.log(listAccounts().map(a => `${a.name}  ${a.igUserId}`).join('\n') || 'none'); break; }
    case 'new': { const title = pos[0] || 'Untitled'; const s = createReel(title, flags.file ? fs.readFileSync(flags.file, 'utf8') : TEMPLATE(title)); console.log(`Created ${s}\nEdit: ${scriptPath(s)}`); break; }
    case 'list': for (const r of listReels()) console.log(`${r.slug.padEnd(34)} ${String(r.status).padEnd(9)} ${r.scheduledAt || ''}`); break;
    case 'lint': { const r = lint(load(pos[0])); for (const c of r.checks) console.log(`${c.pass ? '✔' : '✘'} ${c.msg}`); console.log(`\nScore ${r.score}/100  (~${r.speakSeconds.toFixed(0)}s spoken)`); break; }
    case 'score': { const m = getMeta(need(pos[0])); const v = virality(load(pos[0]), m.durations); console.log(JSON.stringify(v, null, 2)); m.virality = { score: v.score, estSkipRate: v.estSkipRate, avgWatchSeconds: v.avgWatchSeconds }; saveMeta(pos[0], m); break; }
    case 'styles': { try { for (const s of await styleList()) console.log(s.name.padEnd(20) + s.desc); } catch (e) { console.log('(browser unavailable) ' + e.message); } break; }
    case 'branch': { const s = branch(need(pos[0]), pos[1] || 'Branch', fs.readFileSync(flags.lines, 'utf8').split(/\r?\n/).filter(Boolean)); console.log('Created ' + s); break; }
    case 'render': {
      const s = need(pos[0]); const sc = load(s); const m = getMeta(s); const style = flags.style || m.style || sc.style || 'aurora-dark'; const lang = flags.lang || m.lang || 'en';
      const out = path.join(reelDir(s), flags.draft ? 'draft.mp4' : 'reel.mp4'); let r;
      if (!flags.basic && browserAvailable()) {
        let avatarFile; const av = flags.avatar && !String(flags.avatar).startsWith('heygen') ? String(flags.avatar) : undefined; if (flags.avatar && String(flags.avatar).startsWith('heygen')) { const [, aid, vid] = String(flags.avatar).split(':'); avatarFile = path.join(reelDir(s), 'avatar.mp4'); if (!fs.existsSync(avatarFile)) { console.log('Generating HeyGen avatar...'); await makeAvatar({ text: sc.beats.join(' '), avatarId: aid, voiceId: vid, out: avatarFile }); } }
        r = await renderReel2({ script: sc, style, voice: flags.voice || 'auto', lang, music: flags.music, out, fps: flags.fps ? +flags.fps : 30, draft: !!flags.draft, avatarFile, workDir: path.join(reelDir(s), 'work'), avatar: av });
      } else { console.log('(motion renderer unavailable, using basic ffmpeg renderer)'); r = await renderBasic({ beats: sc.beats, style: 'saas-dark', voice: flags.voice || 'auto', music: flags.music, out }); }
      Object.assign(m, { status: ['posted', 'scheduled'].includes(m.status) ? m.status : 'rendered', durations: r.durations, seconds: r.seconds, style, lang, rendered: new Date().toISOString() }); saveMeta(s, m);
      console.log(`\n✔ ${out}  (${r.seconds}s, voice: ${r.provider})`); break; }
    case 'footage': {
      if (!pos[0]) throw new Error('usage: footage <video> [--level light|standard|aggressive] [--style volt] [--no-captions] [--dry] [--model base.en]');
      const out = flags.out || pos[0].replace(/\.[^.]+$/, '') + '.cut.mp4'; const lang = flags.lang || 'en';
      const p = cutFootage({ input: pos[0], out, level: flags.level || 'standard', lang, model: flags.model, punch: !flags['no-punch'], dryRun: !!flags.dry });
      console.log(`${p.removed}/${p.total} words cut · ${p.duration}s -> ${p.after}s · ${p.segments} segments`);
      console.log(p.words.map(w => (w.cut ? `[${w.t}]` : w.t)).join(' '));
      if (flags.dry) break;
      if (flags['no-captions']) { console.log('✔ ' + out); break; }
      const o2 = out.replace(/\.mp4$/, '.captioned.mp4'); await captionFootage({ video: out, words: p.captionWords, style: flags.style || 'volt', out: o2, lang, y: flags.y ? +flags.y : 1060 }); console.log('✔ ' + o2); break; }
    case 'voices': {
      if (pos[0] === 'install') { const m = await installPiperVoice(pos[1] || 'en'); console.log('installed ' + m + (piperAvailable() ? '' : '\nnow: pip install piper-tts')); }
      else console.log(`piper: ${piperAvailable() ? 'installed' : 'missing (pip install piper-tts)'}   whisper: ${whisperAvailable() ? 'installed' : 'missing (pip install faster-whisper)'}\nlanguages: ${Object.keys(PIPER_VOICES).join(' ')}`); break; }
    case 'brand': {
      if (pos[0] === 'set') { const [k, ...v] = pos.slice(1); const val = v.join(' '); const patch = {}; if (['product', 'audience', 'problem', 'tone', 'cta', 'niche'].includes(k)) patch[k] = val; else if (k === 'competitors') patch.competitors = val.split(',').map(x => x.trim()).filter(Boolean); else if (k === 'proof') patch.proof = val.split(';').map(x => { const [claim, number] = x.split('='); return { claim: claim.trim(), number: (number || '').trim() }; }); else if (k === 'style' || k === 'avatar' || k === 'voice' || k === 'lang') patch.production = { [k]: val }; else if (k === 'method' || k === 'mode' || k === 'username' || k === 'account') patch.posting = { [k]: val }; else if (k === 'daily') patch.daily = { time: val }; else if (k === 'autopilot') patch.daily = { autopilot: val === 'on' }; else throw new Error('unknown key ' + k); saveBrand(patch); }
      console.log(JSON.stringify(getBrand(), null, 2)); const m = missingBrand(); if (m.length) console.log('\nMissing: ' + m.join(', ')); break; }
    case 'mode': { if (pos[0]) saveSettings({ mode: pos[0] }); const st = getSettings(); console.log('mode: ' + st.mode); for (const t of Object.keys(TASKS)) console.log('  ' + t.padEnd(20) + modelFor(t, st).padEnd(8) + TASKS[t].desc); console.log('\nNever sent to a model (code does it): ' + CODE_ONLY.join(', ')); break; }
    case 'route': { if (!pos[0] || !pos[1]) throw new Error('usage: route <task> haiku|sonnet|opus|auto'); const st = getSettings(); const r = { ...st.routing }; if (pos[1] === 'auto') delete r[pos[0]]; else r[pos[0]] = pos[1]; saveSettings({ routing: r }); console.log(pos[0] + ' -> ' + modelFor(pos[0])); break; }
    case 'usage': { const u = usageToday(); const b = getSettings().budget; console.log(`today: ${u.calls} model calls (${u.cacheHits} cache hits, free) · ${u.output} output tokens · budget ${b.dailyCalls} calls`); for (const [k, v] of Object.entries(u.by)) console.log(`  ${k.padEnd(7)} ${v.calls} calls  in ${v.input}  out ${v.output}`); break; }
    case 'claude': { if (!claudeAvailable()) throw new Error('claude CLI not found'); const r = await askClaude({ task: 'caption_hashtags', prompt: 'Reply JSON {"caption":"ok","hashtags":["#a"]}', schema: { type: 'object', properties: { caption: { type: 'string' }, hashtags: { type: 'array', items: { type: 'string' } } }, required: ['caption', 'hashtags'] }, force: true }); console.log(`✔ Claude works (${r.model}, ${r.usage.output} output tokens)`); break; }
    case 'ideas': { if (flags.generate) { const f = await generateIdeas({ n: 5, log: console.log }); console.log('added ' + f.length); } for (const i of listIdeas()) console.log(`${i.status.padEnd(9)} ${i.id}  ${i.hook}  - ${i.payoff}`); break; }
    case 'refs': { if (pos[0] === 'add') { const n = swipe.addFromText(pos.slice(1).join(' ') || fs.readFileSync(flags.file, 'utf8'), flags.niche); console.log('saved ' + n); } else for (const i of swipe.listSwipe({ status: 'saved' })) console.log(`${String(i.multiplier).padStart(5)}x ${i.creator.padEnd(14)} ${i.caption.slice(0, 80)}`); break; }
    case 'research': { const r = await researchReels({ handles: (flags.handles || getBrand().competitors.join(',')).split(',').filter(Boolean), hashtags: String(flags.tags || '').split(',').filter(Boolean), log: console.log }); const by = {}; r.forEach(x => (by[x.creator] = by[x.creator] || []).push(x.views)); for (const x of r) { const med = by[x.creator].sort((a, b) => a - b)[Math.floor(by[x.creator].length / 2)]; swipe.addItem({ url: x.url, creator: x.creator, views: x.views, likes: x.likes, comments: x.comments, caption: x.caption, followers: x.followers, baseline: x.followers || med, niche: getBrand().niche || 'general', source: 'research' }); } console.log(`added ${r.length} reels to Swipe`); break; }
    case 'browser': { const r = await ensureBrowser(); console.log(r.launched ? 'Reelkit browser opened. Log in to Instagram there once; the login is kept in its profile.' : 'Reelkit browser already running.'); break; }
    case 'inbox': { if (pos[0] === 'done' && pos[1]) { resolveItem(pos[1], {}); } for (const i of listInbox('open')) console.log(`${i.id}  [${i.type}] ${i.title}\n     ${i.body.replace(/\n/g, '\n     ')}`); break; }
    case 'autopilot': case 'run': {
      if (pos[0] === 'status') { for (const r of listRuns().slice(0, 5)) console.log(`${r.id} ${r.status.padEnd(9)} ${r.steps.map(s => ({ done: '✔', running: '…', waiting: '⏸', failed: '✘', pending: '·', skipped: '-' }[s.status])).join('')} ${r.gate?.message || r.error || ''}`); break; }
      if (pos[0] === 'answer') { const r = answerGate(pos[1], flags.text ? { text: flags.text } : { action: flags.action || 'share', skip: !!flags.skip }); console.log(r?.status); }
      let r = pos[0] === 'resume' ? getRun(pos[1]) : startRun({ post: flags.post, method: flags.method, at: flags.at ? new Date(flags.at).toISOString() : undefined, skipRefs: !!flags['skip-refs'] });
      console.log('run ' + r.id); r = await executeRun(r.id); for (const s of r.steps) console.log(`  ${s.status.padEnd(8)} ${s.name.padEnd(16)} ${s.detail || ''}`); if (r.status === 'waiting') console.log('\n⏸ ' + r.gate.message + `\n  answer: reelkit autopilot answer ${r.id} --action share|cancel|manual-done   (or --text "refs..." / --skip), then: reelkit autopilot resume ${r.id}`); if (r.error) console.log('Error: ' + r.error); break; }
    case 'daily': { const it = await dailyTick(new Date(Date.now() + 864e5 * 0), console.log); console.log(it ? 'created ' + (it.title || it.id) : 'nothing due (already done today or before the daily time)'); break; }
    case 'carousel': case 'repurpose': { const r = await repurpose(need(pos[0]), { style: flags.style }); console.log(r.files.join('\n') + '\nBrief for Claude: ' + r.brief); break; }
    case 'hooks': { const m = getMeta(need(pos[0])); if (flags.add) { m.hooks = [...(m.hooks || []), String(flags.add)]; saveMeta(pos[0], m); } console.log((m.hooks || []).map((h, i) => `${i + 1}. ${h}`).join('\n') || 'none'); break; }
    case 'swipe': {
      const sub = pos[0];
      if (sub === 'add') console.log(swipe.addItem({ url: flags.url, creator: flags.creator, views: flags.views, baseline: flags.baseline, followers: flags.followers, caption: flags.caption, niche: flags.niche, note: flags.note }));
      else if (sub === 'import') console.log('imported ' + swipe.importFile(pos[1], flags.niche));
      else if (sub === 'discover') console.log('added ' + (await swipe.discover(flags.account, String(pos[1] || '').split(',').filter(Boolean), flags.niche)));
      else if (sub === 'save' || sub === 'skip') console.log(swipe.decide(pos[1], sub === 'save' ? 'saved' : 'skipped'));
      else for (const i of swipe.listSwipe({ status: flags.saved ? 'saved' : flags.all ? undefined : 'new' })) console.log(`${String(i.multiplier).padStart(5)}x  ${swipe.fmtViews(i.views).padStart(6)}  ${i.id}  @${i.creator}  ${i.caption.slice(0, 70)}`);
      break; }
    case 'queue': { const s = need(pos[0]); const m = getMeta(s); if (!flags.at) throw new Error('--at <ISO date/time> required'); Object.assign(m, { status: 'scheduled', scheduledAt: new Date(flags.at).toISOString(), caption: flags.caption || m.caption || m.title, account: flags.account || m.account, trial: !!flags.trial }); saveMeta(s, m); console.log(`Scheduled ${s} for ${m.scheduledAt}`); break; }
    case 'post': {
      const targets = flags.due ? listReels().filter(r => r.status === 'scheduled' && new Date(r.scheduledAt) <= new Date()).map(r => r.slug) : [need(pos[0])];
      if (!targets.length) console.log('Nothing due.');
      for (const s of targets) { const m = getMeta(s); console.log('Publishing ' + s); m.igMediaId = await publishReel({ account: m.account, file: path.join(reelDir(s), 'reel.mp4'), caption: m.caption || m.title, trial: m.trial }); m.status = 'posted'; m.postedAt = new Date().toISOString(); saveMeta(s, m); console.log('✔ posted ' + m.igMediaId); } break; }
    case 'analyze': { const n = await snapshotDue(console.log); const s = summary(); console.log(`${n} snapshots. total views ${s.totalViews}, rank ${s.rank.name}`); for (const r of s.reels) console.log(`${r.winner ? '★ ' : '  '}${r.title.padEnd(36)} ${String(r.views).padStart(8)} views  D1:${r.d1 ?? '-'} D3:${r.d3 ?? '-'} D7:${r.d7 ?? '-'}`); try { if (listAccounts().length) console.log(await accountInsights(flags.account)); } catch (e) { console.log('account insights: ' + e.message); } break; }
    case 'rank': { const r = summary().rank; console.log(`${r.name}  (${r.total} views)${r.next ? `  next: ${r.next.name} at ${r.next.at}` : ''}`); break; }
    case 'calibrate': console.log(JSON.stringify(calibrate(), null, 2)); break;
    case 'worker': { if (!flags.child) console.log('worker running (Ctrl+C to stop): renders, scheduled posts, daily check-ins, analytics'); startWorker(); setInterval(() => {}, 1 << 30); break; }
    case 'dashboard': startDashboard({ port: Number(flags.port) || 4177, lan: !!flags.lan, worker: !flags['no-worker'], open: !!flags.open }); break;
    default: console.log(help);
  }
} catch (e) { console.error('Error: ' + e.message); process.exit(1); }
