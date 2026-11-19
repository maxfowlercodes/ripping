// Local speech-to-text with word timestamps (faster-whisper). Audio is decoded by ffmpeg, so no PyAV dependency.
import fs from 'node:fs';
import path from 'node:path';
import { run, has, isWin, pyCan } from './util.mjs';

const PY = () => process.env.REELKIT_PYTHON || (isWin ? 'python' : 'python3');
const SCRIPT = `
import sys, json, subprocess
try:
    import numpy as np
    from faster_whisper import WhisperModel
except Exception as e:
    print(json.dumps({"error": "faster-whisper not installed: " + str(e)})); sys.exit(0)
src, lang, model, prompt = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
raw = subprocess.run(["ffmpeg","-v","error","-i",src,"-f","f32le","-ac","1","-ar","16000","-"],capture_output=True).stdout
a = np.frombuffer(raw, dtype=np.float32)
m = WhisperModel(model, compute_type="int8")
kw = dict(word_timestamps=True, vad_filter=False, condition_on_previous_text=False)
if lang != "auto": kw["language"] = lang
if prompt: kw["initial_prompt"] = prompt
seg, info = m.transcribe(a, **kw)
words = [{"t": w.word.strip(), "s": round(w.start,3), "e": round(w.end,3), "p": round(getattr(w,"probability",1.0),3)} for s in seg for w in (s.words or [])]
print(json.dumps({"words": words, "language": info.language, "duration": info.duration}))
`;
// A verbatim-style prompt makes Whisper keep "um/uh" instead of silently dropping them.
export const VERBATIM_PROMPT = "Umm, uh, so, like, you know, I mean, uh... basically, um, actually. Hmm, er, well, yeah.";

export function whisperAvailable() { return pyCan('faster_whisper'); }

/** Returns {words:[{t,s,e,p}], language, duration} or {error}. Model: tiny.en | base | small | medium | large-v3 (downloaded on first use). */
export function transcribe(file, { lang = 'en', model, verbatim = true } = {}) {
  const m = model || process.env.REELKIT_WHISPER || (lang === 'en' ? 'base.en' : 'small');
  const r = run(PY(), ['-c', SCRIPT, file, lang, m, verbatim ? VERBATIM_PROMPT : ''], { maxBuffer: 1 << 28 });
  const line = (r.out || '').trim().split('\n').pop();
  try { return JSON.parse(line); } catch { return { error: 'transcription failed: ' + (r.err || r.out).slice(-300) }; }
}

const norm = s => s.toLowerCase().replace(/[^\p{L}\p{N}%$]+/gu, '');
/** Align known script tokens to recognized words (greedy, order preserving). Returns [{s,e}] per token or null if poor match. */
export function alignTokens(tokens, words) {
  if (!words?.length) return null;
  const nw = words.map(w => norm(w.t)); const out = []; let j = 0, hit = 0;
  for (const tok of tokens) {
    const nt = norm(tok); let found = -1;
    for (let k = j; k < Math.min(nw.length, j + 4); k++) if (nw[k] === nt || (nt.length > 3 && nw[k].startsWith(nt.slice(0, 3)))) { found = k; break; }
    if (found >= 0) { out.push({ s: words[found].s, e: words[found].e }); j = found + 1; hit++; } else out.push(null);
  }
  if (hit / tokens.length < 0.6) return null;
  // fill gaps by interpolation
  for (let i = 0; i < out.length; i++) if (!out[i]) {
    let a = i - 1; while (a >= 0 && !out[a]) a--; let b = i + 1; while (b < out.length && !out[b]) b++;
    const t0 = a >= 0 ? out[a].e : (out[b]?.s ?? 0) - 0.2, t1 = b < out.length ? out[b].s : t0 + 0.3, n = (b < out.length ? b : out.length) - (a + 1);
    const idx = i - (a + 1); out[i] = { s: t0 + ((t1 - t0) * idx) / n, e: t0 + ((t1 - t0) * (idx + 1)) / n };
  }
  return out;
}
