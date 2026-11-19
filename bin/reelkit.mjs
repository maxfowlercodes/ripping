#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseScript, lint, virality } from '../src/script.mjs';
import { renderReel, renderCarousel, themes } from '../src/render.mjs';
import { detectProvider } from '../src/voice.mjs';
import { publishReel, insights } from '../src/instagram.mjs';
import { createReel, getMeta, saveMeta, listReels, scriptPath, reelDir } from '../src/store.mjs';
import { has, home, run, findFont } from '../src/util.mjs';
import { startDashboard } from '../src/dashboard.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const flags = {}; const pos = [];
for (let i = 0; i < rest.length; i++) { if (rest[i].startsWith('--')) { const k = rest[i].slice(2); const v = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true; flags[k] = v; } else pos.push(rest[i]); }

const need = s => { if (!s || !getMeta(s)) { console.error(`No such reel "${s}". Run: reelkit list`); process.exit(1); } return s; };
const load = s => parseScript(fs.readFileSync(scriptPath(need(s)), 'utf8'));

const help = `reelkit — free local short-form video pipeline
  doctor                       check ffmpeg, fonts, voices, Instagram creds
  new "<title>" [--file f]     create a reel (opens script.txt template or imports a file)
  list                         list reels
  lint <reel>                  hook / pacing / CTA checks + score
  score <reel>                 retention estimate + fixes (virality brain, heuristic)
  render <reel> [--style s] [--voice auto|elevenlabs|edge|sapi|say|espeak|silent] [--music file]
  styles                       list styles
  carousel <reel> [--style s]  export 1080x1350 slides
  queue <reel> --at <ISO> [--caption "..."] [--trial]
  post <reel> | --due          publish now / publish everything that is due (run from a scheduler)
  analyze                      pull Instagram insights into day-1/3/7 curves
  dashboard [--port 4177]      local web app (calendar, analytics, scripts) — phone friendly on your LAN`;

const TEMPLATE = `# Title here
// One line = one beat/scene. First line = hook (<=8 words). Last line = one action.
// [style: saas-dark]
Stop posting reels nobody watches.
Most founders open with "hey guys".
That costs you 60% of viewers in 2 seconds.
Open with the result instead.
Show the number, then the how.
One idea per line, one visual per idea.
End with a single action.
Comment "REEL" and I'll send the template.
`;

try {
  switch (cmd) {
    case 'doctor': {
      const ok = (b, t) => console.log(`${b ? '✔' : '✘'} ${t}`);
      ok(has('ffmpeg') && has('ffprobe'), 'ffmpeg + ffprobe (required)'); ok(!!findFont(), 'a bold font found');
      console.log(`  voice provider that will be used: ${detectProvider('auto')}`);
      ok(!!process.env.IG_ACCESS_TOKEN && !!process.env.IG_USER_ID, 'Instagram credentials (optional, for post/analyze)');
      ok(has('claude'), 'Claude Code CLI (optional, for the skill)'); console.log('  data dir: ' + home()); break; }
    case 'new': {
      const title = pos[0] || 'Untitled'; const text = flags.file ? fs.readFileSync(flags.file, 'utf8') : TEMPLATE.replace('Title here', title);
      const s = createReel(title, text); console.log(`Created ${s}\nEdit: ${scriptPath(s)}`); break; }
    case 'list': for (const r of listReels()) console.log(`${r.slug.padEnd(32)} ${String(r.status).padEnd(9)} ${r.scheduledAt || ''}`); break;
    case 'lint': { const r = lint(load(pos[0])); for (const c of r.checks) console.log(`${c.pass ? '✔' : '✘'} ${c.msg}`); console.log(`\nScore ${r.score}/100  (~${r.speakSeconds.toFixed(0)}s spoken)`); break; }
    case 'score': { const m = getMeta(need(pos[0])); const v = virality(load(pos[0]), m.durations); console.log(JSON.stringify(v, null, 2)); m.virality = { score: v.score, estSkipRate: v.estSkipRate, avgWatchSeconds: v.avgWatchSeconds }; saveMeta(pos[0], m); break; }
    case 'styles': console.log(Object.keys(themes()).join('\n')); break;
    case 'render': {
      const s = need(pos[0]); const sc = load(s); const style = flags.style || sc.style || 'saas-dark';
      const out = path.join(reelDir(s), 'reel.mp4');
      const r = await renderReel({ beats: sc.beats, style, voice: flags.voice || 'auto', music: flags.music, out });
      const m = getMeta(s); Object.assign(m, { status: m.status === 'posted' ? 'posted' : 'rendered', durations: r.durations, seconds: r.seconds, style, rendered: new Date().toISOString() }); saveMeta(s, m);
      console.log(`\n✔ ${out}  (${r.seconds}s, voice: ${r.provider})`); break; }
    case 'carousel': { const s = need(pos[0]); const f = renderCarousel({ beats: load(s).beats, style: flags.style || 'saas-dark', outDir: path.join(reelDir(s), 'carousel') }); console.log(f.join('\n')); break; }
    case 'queue': { const s = need(pos[0]); const m = getMeta(s); if (!flags.at) throw new Error('--at <ISO date/time> required'); Object.assign(m, { status: 'scheduled', scheduledAt: new Date(flags.at).toISOString(), caption: flags.caption || m.caption || m.title, trial: !!flags.trial }); saveMeta(s, m); console.log(`Scheduled ${s} for ${m.scheduledAt}`); break; }
    case 'post': {
      const targets = flags.due ? listReels().filter(r => r.status === 'scheduled' && new Date(r.scheduledAt) <= new Date()).map(r => r.slug) : [need(pos[0])];
      if (!targets.length) console.log('Nothing due.');
      for (const s of targets) { const m = getMeta(s); console.log('Publishing ' + s); m.igMediaId = await publishReel({ file: path.join(reelDir(s), 'reel.mp4'), caption: m.caption || m.title, trial: m.trial }); m.status = 'posted'; m.postedAt = new Date().toISOString(); saveMeta(s, m); console.log('✔ posted ' + m.igMediaId); }
      break; }
    case 'analyze': {
      for (const r of listReels().filter(r => r.igMediaId)) { const m = getMeta(r.slug); const snap = { t: new Date().toISOString(), ...(await insights(r.igMediaId)) }; m.snapshots.push(snap); saveMeta(r.slug, m);
        const age = (Date.now() - new Date(m.postedAt)) / 864e5; console.log(`${r.slug} day~${age.toFixed(1)} views=${snap.views} likes=${snap.likes} saves=${snap.saved}`); }
      break; }
    case 'dashboard': startDashboard(Number(flags.port) || 4177); break;
    default: console.log(help);
  }
} catch (e) { console.error('Error: ' + e.message); process.exit(1); }
