// Your own footage: remove silences (+ filler words if whisper is installed), clean audio, burn word-synced captions.
import fs from 'node:fs';
import path from 'node:path';
import { run, has, probeDuration, ensureDir, tmp } from './util.mjs';

export function detectSilences(file, db = -35, min = 0.45) {
  const r = run('ffmpeg', ['-i', file, '-af', `silencedetect=noise=${db}dB:d=${min}`, '-f', 'null', '-']);
  const out = []; let s = null;
  for (const l of r.err.split('\n')) { let m; if ((m = l.match(/silence_start: ([\d.]+)/))) s = +m[1]; if ((m = l.match(/silence_end: ([\d.]+)/)) && s != null) { out.push([s, +m[1]]); s = null; } }
  return out;
}

/** Optional transcript with word timestamps via faster-whisper (pip install faster-whisper). Returns [{t,s,e}] or null. */
export function transcribe(file, lang = 'en') {
  const py = `import sys,json\ntry:\n from faster_whisper import WhisperModel\nexcept Exception:\n print('[]'); sys.exit(0)\nm=WhisperModel('small',compute_type='int8')\nseg,_=m.transcribe(sys.argv[1],word_timestamps=True,language=sys.argv[2])\nprint(json.dumps([{'t':w.word.strip(),'s':w.start,'e':w.end} for s in seg for w in s.words]))`;
  const r = run(process.platform === 'win32' ? 'python' : 'python3', ['-c', py, file, lang]);
  try { const w = JSON.parse(r.out.trim().split('\n').pop()); return w.length ? w : null; } catch { return null; }
}
const FILLERS = new Set(['um', 'uh', 'umm', 'uhh', 'er', 'erm', 'ah', 'hmm', 'like,', 'you know']);

/** Build keep-segments from duration minus cut ranges. */
export function keepSegments(duration, cuts, pad = 0.08, minKeep = 0.25) {
  const m = []; for (const [s, e] of [...cuts].sort((a, b) => a[0] - b[0])) { const last = m[m.length - 1]; if (last && s <= last[1]) last[1] = Math.max(last[1], e); else m.push([s, e]); }
  const keep = []; let cur = 0;
  for (const [s, e] of m) { const a = Math.max(cur, 0), b = Math.min(duration, s + pad); if (b - a >= minKeep) keep.push([a, b]); cur = Math.max(cur, e - pad); }
  if (duration - cur >= minKeep) keep.push([cur, duration]);
  return keep;
}

export function cutFootage({ input, out, silenceDb = -35, minSilence = 0.45, removeFillers = true, lang = 'en', log = console.log }) {
  const dur = probeDuration(input); const cuts = detectSilences(input, silenceDb, minSilence);
  log(`silences: ${cuts.length}`);
  let words = null;
  if (removeFillers) { words = transcribe(input, lang); if (words) { for (const w of words) if (FILLERS.has(w.t.toLowerCase().replace(/[.,!?]/g, ''))) cuts.push([w.s, w.e]); log(`transcript: ${words.length} words`); } else log('no transcript (faster-whisper not installed): silence cuts only'); }
  const keep = keepSegments(dur, cuts); if (!keep.length) throw new Error('nothing left after cutting');
  let fc = ''; keep.forEach(([s, e], i) => { fc += `[0:v]trim=${s}:${e},setpts=PTS-STARTPTS[v${i}];[0:a]atrim=${s}:${e},asetpts=PTS-STARTPTS[a${i}];`; });
  fc += keep.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${keep.length}:v=1:a=1[v][a0];[a0]highpass=f=80,afftdn=nf=-25,loudnorm=I=-16:TP=-1.5[a]`;
  ensureDir(path.dirname(out));
  const r = run('ffmpeg', ['-y', '-i', input, '-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', out]);
  if (!r.ok) throw new Error('cut failed: ' + r.err.slice(-400));
  // remap word timings onto the cut timeline
  let mapped = null;
  if (words) { mapped = []; let off = 0; for (const [s, e] of keep) { for (const w of words) if (w.s >= s - 0.01 && w.e <= e + 0.01 && !FILLERS.has(w.t.toLowerCase().replace(/[.,!?]/g, ''))) mapped.push({ t: w.t, s: w.s - s + off, e: w.e - s + off }); off += e - s; } }
  return { out, before: +dur.toFixed(1), after: +probeDuration(out).toFixed(1), segments: keep.length, words: mapped };
}

const ass = s => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = (s % 60).toFixed(2).padStart(5, '0'); return `${h}:${String(m).padStart(2, '0')}:${x}`; };
export function burnCaptions({ input, words, out, color = '&H0000F0FF', font = 'Arial', size = 78 }) {
  const lines = ['[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1080', 'PlayResY: 1920', '', '[V4+ Styles]',
    'Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding',
    `Style: Default,${font},${size},&H00FFFFFF,${color},&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,5,2,2,80,80,520,1`, '', '[Events]', 'Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text'];
  for (let i = 0; i < words.length; i += 3) { const g = words.slice(i, i + 3); const s = g[0].s, e = g[g.length - 1].e + 0.05;
    const text = g.map(w => `{\\kf${Math.max(1, Math.round((w.e - w.s) * 100))}}${w.t}`).join(' '); lines.push(`Dialogue: 0,${ass(s)},${ass(e)},Default,,0,0,0,,{\\fad(60,40)}${text}`); }
  const f = path.join(tmp(), 'caps.ass'); fs.writeFileSync(f, lines.join('\n'));
  const esc = f.replace(/\\/g, '/').replace(/:/g, '\\:');
  const r = run('ffmpeg', ['-y', '-i', input, '-vf', `ass='${esc}'`, '-c:a', 'copy', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', out]);
  if (!r.ok) throw new Error('caption burn failed: ' + r.err.slice(-300));
  return out;
}
