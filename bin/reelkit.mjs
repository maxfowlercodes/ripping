#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseScript, lint, virality } from '../src/script.mjs';
import { renderReel as renderBasic } from '../src/render.mjs';
import { renderReel2, renderCarouselPng, styleList } from '../src/render2.mjs';
import { detectProvider } from '../src/voice.mjs';
import { publishReel, accountInsights } from '../src/instagram.mjs';
import { createReel, getMeta, saveMeta, listReels, scriptPath, reelDir } from '../src/store.mjs';
import { has, home, findFont } from '../src/util.mjs';
import { startDashboard } from '../src/dashboard.mjs';
import { applySecrets, addAccount, setKey, listAccounts, secretsPath } from '../src/accounts.mjs';
import { browserAvailable, findBrowser, launch } from '../src/browser.mjs';
import { summary, snapshotDue, calibrate } from '../src/analytics.mjs';
import * as swipe from '../src/swipe.mjs';
import { repurpose, branch } from '../src/repurpose.mjs';
import { cutFootage, burnCaptions } from '../src/footage.mjs';
import { makeAvatar, listAvatars } from '../src/heygen.mjs';
import { startWorker, enqueueDue, tick, listJobs } from '../src/jobs.mjs';

applySecrets();
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
 PRODUCE  styles | render <reel> [--style s] [--voice v] [--lang xx] [--music f] [--draft] [--avatar heygen:AVATAR_ID:VOICE_ID] [--basic]
          footage <video> [--out f] [--captions]      (cut silences/fillers, clean audio, burn captions)
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
        let avatarFile; if (flags.avatar) { const [, aid, vid] = String(flags.avatar).split(':'); avatarFile = path.join(reelDir(s), 'avatar.mp4'); if (!fs.existsSync(avatarFile)) { console.log('Generating HeyGen avatar...'); await makeAvatar({ text: sc.beats.join(' '), avatarId: aid, voiceId: vid, out: avatarFile }); } }
        r = await renderReel2({ script: sc, style, voice: flags.voice || 'auto', lang, music: flags.music, out, fps: flags.fps ? +flags.fps : 30, draft: !!flags.draft, avatarFile, workDir: path.join(reelDir(s), 'work') });
      } else { console.log('(motion renderer unavailable, using basic ffmpeg renderer)'); r = await renderBasic({ beats: sc.beats, style: 'saas-dark', voice: flags.voice || 'auto', music: flags.music, out }); }
      Object.assign(m, { status: ['posted', 'scheduled'].includes(m.status) ? m.status : 'rendered', durations: r.durations, seconds: r.seconds, style, lang, rendered: new Date().toISOString() }); saveMeta(s, m);
      console.log(`\n✔ ${out}  (${r.seconds}s, voice: ${r.provider})`); break; }
    case 'footage': {
      if (!pos[0]) throw new Error('usage: footage <video> [--out f] [--captions]'); const out = flags.out || pos[0].replace(/\.[^.]+$/, '') + '.cut.mp4';
      const r = cutFootage({ input: pos[0], out, lang: flags.lang || 'en' }); console.log(`cut ${r.before}s -> ${r.after}s (${r.segments} segments)`);
      if (flags.captions) { if (!r.words) throw new Error('captions need a transcript: pip install faster-whisper'); const o2 = out.replace('.mp4', '.captioned.mp4'); burnCaptions({ input: out, words: r.words, out: o2 }); console.log('✔ ' + o2); } else console.log('✔ ' + out); break; }
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
    case 'worker': { console.log('worker running (Ctrl+C to stop)'); startWorker(); break; }
    case 'dashboard': startDashboard({ port: Number(flags.port) || 4177, lan: !!flags.lan, worker: !flags['no-worker'] }); break;
    default: console.log(help);
  }
} catch (e) { console.error('Error: ' + e.message); process.exit(1); }
