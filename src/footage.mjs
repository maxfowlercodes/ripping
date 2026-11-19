// Your own footage -> tight talking-head cut: filler words, repeats and dead air removed, audio cleaned, captions in a style.
import fs from 'node:fs';
import path from 'node:path';
import { run, probeDuration, ensureDir } from './util.mjs';
import { transcribe } from './transcribe.mjs';

export const FILLER_LEVELS = {
  light:      { words: ['um', 'umm', 'uh', 'uhh', 'er', 'erm', 'ah', 'hmm', 'mm', 'mhm', 'eh', 'oh'], phrases: [], repeats: false },
  standard:   { words: ['um', 'umm', 'uh', 'uhh', 'er', 'erm', 'ah', 'hmm', 'mm', 'mhm', 'eh', 'oh'], phrases: ['you know', 'i mean', 'kind of', 'sort of'], repeats: true, likeFiller: true },
  aggressive: { words: ['um', 'umm', 'uh', 'uhh', 'er', 'erm', 'ah', 'hmm', 'mm', 'mhm', 'eh', 'oh', 'basically', 'literally', 'actually', 'honestly', 'right'], phrases: ['you know', 'i mean', 'kind of', 'sort of', 'so yeah', 'you see'], repeats: true, likeFiller: true },
};
const clean = s => s.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, '');

/** Mark each word as keep/cut with a reason. words: [{t,s,e}] */
export function classify(words, level = 'standard') {
  const L = FILLER_LEVELS[level] || FILLER_LEVELS.standard; const out = words.map(w => ({ ...w, cut: false, why: '' }));
  const T = out.map(w => clean(w.t));
  for (let i = 0; i < out.length; i++) {
    if (L.words.includes(T[i])) { out[i].cut = true; out[i].why = 'filler'; continue; }
    // multi-word phrases
    for (const ph of L.phrases) { const p = ph.split(' '); if (p.every((x, k) => T[i + k] === x)) { for (let k = 0; k < p.length; k++) { out[i + k].cut = true; out[i + k].why = 'phrase'; } } }
    // "like" as filler: followed/preceded by a pause or comma, not "I like X"
    if (L.likeFiller && T[i] === 'like' && (/[,]$/.test(out[i].t) || (out[i + 1] && out[i + 1].s - out[i].e > 0.25) || (out[i - 1] && out[i].s - out[i - 1].e > 0.25))) { out[i].cut = true; out[i].why = 'like'; }
    // stutter / repeated word ("the the", "I I"): cut the earlier copy
    }
  // stutters ("the the", "I I"): cut the earlier copy unless the next word is already being cut (e.g. a filler phrase)
  if (L.repeats) for (let i = 0; i + 1 < out.length; i++) if (T[i] && T[i] === T[i + 1] && T[i].length <= 6 && !out[i].cut && !out[i + 1].cut && out[i + 1].s - out[i].e < 0.5) { out[i].cut = true; out[i].why = 'repeat'; }
  return out;
}

/** Turn classified words into keep ranges on the source timeline, compressing long pauses. */
export function planCuts(words, duration, { maxGap = 0.22, pad = 0.05, lead = 0.08, tail = 0.25 } = {}) {
  const kept = words.filter(w => !w.cut); if (!kept.length) return [];
  const ranges = []; let cur = null;
  for (const w of kept) {
    const s = Math.max(0, w.s - pad), e = Math.min(duration, w.e + pad);
    if (!cur) cur = [Math.max(0, w.s - lead), e];
    else {
      // was anything cut between cur end and this word, or is the gap long?
      const between = words.some(x => x.cut && x.s >= cur[1] - pad - 0.001 && x.e <= w.s + 0.001);
      if (!between && s - cur[1] <= maxGap) cur[1] = e; else { ranges.push(cur); cur = [s, e]; }
    }
  }
  ranges.push([cur[0], Math.min(duration, cur[1] + tail)]);
  // merge overlaps
  const m = []; for (const r of ranges) { const l = m[m.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else m.push([r[0], r[1]]); }
  return m.filter(r => r[1] - r[0] > 0.12);
}

/** Map word times onto the cut timeline; returns kept words only. */
export function remap(words, keep) {
  const out = []; let off = 0;
  for (const [s, e] of keep) { for (const w of words) if (!w.cut && w.s >= s - 0.06 && w.e <= e + 0.06) out.push({ ...w, s: Math.max(0, w.s - s) + off, e: Math.max(0, w.e - s) + off }); off += e - s; }
  return out;
}

export function buildCut({ input, out, keep, punch = true, clean = true, w = 1080, h = 1920, log = () => {} }) {
  let fc = '';
  keep.forEach(([s, e], i) => {
    const z = punch && i % 2 === 1 ? ',scale=iw*1.1:ih*1.1,crop=iw/1.1:ih/1.1' : '';
    fc += `[0:v]trim=${s.toFixed(3)}:${e.toFixed(3)},setpts=PTS-STARTPTS${z}[v${i}];` +
          `[0:a]atrim=${s.toFixed(3)}:${e.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st=${Math.max(0, e - s - 0.012).toFixed(3)}:d=0.012[a${i}];`;
  });
  fc += keep.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${keep.length}:v=1:a=1[vc][ac];`;
  fc += `[vc]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,format=yuv420p[v];`;
  fc += clean ? `[ac]highpass=f=80,afftdn=nf=-28,acompressor=threshold=-18dB:ratio=3:attack=5:release=80,loudnorm=I=-16:TP=-1.5:LRA=11[a]` : `[ac]anull[a]`;
  ensureDir(path.dirname(out));
  const r = run('ffmpeg', ['-y', '-i', input, '-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]);
  if (!r.ok) throw new Error('cut failed: ' + r.err.slice(-500));
  return out;
}

/** Full pipeline. Returns plan (for the UI) and, unless dryRun, the cut file. */
export function cutFootage({ input, out, level = 'standard', lang = 'en', model, maxGap, punch = true, dryRun = false, words: given, overrides = {}, log = console.log }) {
  const duration = probeDuration(input); if (!duration) throw new Error('cannot read ' + input);
  let tr = given ? { words: given } : transcribe(input, { lang, model }); if (tr.error) throw new Error(tr.error);
  const words = classify(tr.words, level);
  words.forEach((w, i) => { if (overrides[i] != null) { w.cut = !!overrides[i]; w.why = w.cut ? 'manual' : ''; } });
  const keep = planCuts(words, duration, { maxGap });
  if (!keep.length) throw new Error('nothing left after cutting');
  const after = keep.reduce((a, [s, e]) => a + e - s, 0);
  const plan = { duration: +duration.toFixed(2), after: +after.toFixed(2), removed: words.filter(w => w.cut).length, total: words.length, segments: keep.length, words, keep, language: tr.language };
  if (dryRun) return plan;
  log(`${plan.removed}/${plan.total} words cut, ${plan.duration}s -> ${plan.after}s`);
  buildCut({ input, out, keep, punch, log });
  plan.out = out; plan.captionWords = remap(words, keep);
  return plan;
}
