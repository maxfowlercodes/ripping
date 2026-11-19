import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { run, has, pyCan, PYTHON as PYBIN, isWin, isMac, probeDuration, ensureDir } from './util.mjs';

export const EDGE_VOICES = { en: 'en-US-AndrewNeural', es: 'es-ES-AlvaroNeural', fr: 'fr-FR-HenriNeural', it: 'it-IT-DiegoNeural', pt: 'pt-BR-AntonioNeural', de: 'de-DE-ConradNeural', ja: 'ja-JP-KeitaNeural', ko: 'ko-KR-InJoonNeural', zh: 'zh-CN-YunxiNeural', hi: 'hi-IN-MadhurNeural', ru: 'ru-RU-DmitryNeural', uk: 'uk-UA-OstapNeural', he: 'he-IL-AvriNeural', ar: 'ar-SA-HamedNeural', el: 'el-GR-NestorasNeural', tr: 'tr-TR-AhmetNeural', nl: 'nl-NL-MaartenNeural', pl: 'pl-PL-MarekNeural' };
// Piper: free, offline neural TTS (pip install piper-tts). Voices are downloaded once from Hugging Face (rhasspy/piper-voices).
export const PIPER_VOICES = { en: 'en/en_US/lessac/medium/en_US-lessac-medium', 'en-gb': 'en/en_GB/alan/medium/en_GB-alan-medium', es: 'es/es_ES/davefx/medium/es_ES-davefx-medium', fr: 'fr/fr_FR/siwis/medium/fr_FR-siwis-medium', de: 'de/de_DE/thorsten/medium/de_DE-thorsten-medium', it: 'it/it_IT/riccardo/x_low/it_IT-riccardo-x_low', pt: 'pt/pt_BR/faber/medium/pt_BR-faber-medium', ru: 'ru/ru_RU/dmitri/medium/ru_RU-dmitri-medium', uk: 'uk/uk_UA/ukrainian_tts/medium/uk_UA-ukrainian_tts-medium', hi: 'hi/hi_IN/pratham/medium/hi_IN-pratham-medium', ar: 'ar/ar_JO/kareem/medium/ar_JO-kareem-medium', tr: 'tr/tr_TR/dfki/medium/tr_TR-dfki-medium', nl: 'nl/nl_NL/mls/medium/nl_NL-mls-medium', pl: 'pl/pl_PL/darkman/medium/pl_PL-darkman-medium', zh: 'zh/zh_CN/huayan/medium/zh_CN-huayan-medium' };
export const voicesDir = () => ensureDir(process.env.REELKIT_VOICES || path.join(os.homedir(), '.reelkit', 'voices'));
const piperBin = () => (has('piper') ? ['piper'] : pyCan('piper') ? [PYBIN(), '-m', 'piper'] : null);
export const piperAvailable = () => !!piperBin();
export async function installPiperVoice(lang = 'en', log = console.log) {
  const NAMED = { lessac: PIPER_VOICES.en, amy: 'en/en_US/amy/medium/en_US-amy-medium', ryan: 'en/en_US/ryan/medium/en_US-ryan-medium', joe: 'en/en_US/joe/medium/en_US-joe-medium' };
  const rel = NAMED[lang] || PIPER_VOICES[lang]; if (!rel) throw new Error('no Piper voice mapped for ' + lang);
  const name = path.basename(rel); const dir = voicesDir();
  for (const ext of ['.onnx', '.onnx.json']) {
    const f = path.join(dir, name + ext); if (fs.existsSync(f)) continue;
    log('downloading ' + name + ext); const r = await fetch(`https://huggingface.co/rhasspy/piper-voices/resolve/main/${rel}${ext}`); if (!r.ok) throw new Error('download failed ' + r.status);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  return path.join(dir, name + '.onnx');
}
export const piperModelFor = lang => { const rel = PIPER_VOICES[lang] || PIPER_VOICES.en; const f = path.join(voicesDir(), path.basename(rel) + '.onnx'); return fs.existsSync(f) ? f : null; };

// ---- Kokoro: free, offline, much more natural than Piper (pip install kokoro-onnx soundfile). Model ~350 MB, CPU is fine.
export const KOKORO_FILES = { 'kokoro-v1.0.onnx': 'https://huggingface.co/fastrtc/kokoro-onnx/resolve/main/kokoro-v1.0.onnx', 'voices-v1.0.bin': 'https://huggingface.co/fastrtc/kokoro-onnx/resolve/main/voices-v1.0.bin' };
export const KOKORO_LANG = { en: 'en-us', 'en-gb': 'en-gb', es: 'es', fr: 'fr-fr', hi: 'hi', it: 'it', ja: 'ja', pt: 'pt-br', zh: 'cmn' };
export const KOKORO_DEFAULT = { en: 'af_heart', 'en-gb': 'bf_emma', es: 'ef_dora', fr: 'ff_siwis', hi: 'hf_alpha', it: 'if_sara', ja: 'jf_alpha', pt: 'pf_dora', zh: 'zf_xiaobei' };
export const KOKORO_VOICES = { en: [['af_heart', 'Heart (warm, female)'], ['af_bella', 'Bella (female)'], ['af_nicole', 'Nicole (calm, female)'], ['af_sarah', 'Sarah (female)'], ['am_michael', 'Michael (male)'], ['am_adam', 'Adam (deep, male)'], ['am_fenrir', 'Fenrir (male)'], ['am_puck', 'Puck (energetic, male)']], 'en-gb': [['bf_emma', 'Emma (British, female)'], ['bm_george', 'George (British, male)'], ['bm_daniel', 'Daniel (British, male)']] };
const kokoroDir = () => ensureDir(path.join(voicesDir(), 'kokoro'));
export const kokoroInstalled = () => Object.keys(KOKORO_FILES).every(f => fs.existsSync(path.join(kokoroDir(), f)));
const PY = () => process.env.REELKIT_PYTHON || (isWin ? 'python' : 'python3');
export const kokoroAvailable = () => kokoroInstalled() && pyCan('kokoro_onnx, soundfile');
export async function installKokoro(log = console.log) {
  for (const [f, url] of Object.entries(KOKORO_FILES)) { const dest = path.join(kokoroDir(), f); if (fs.existsSync(dest)) continue; log(`downloading ${f} (large, one time)...`); const r = await fetch(url); if (!r.ok) throw new Error('download failed ' + r.status); const tmp = dest + '.part'; const ws = fs.createWriteStream(tmp); const rd = r.body.getReader(); for (;;) { const { done, value } = await rd.read(); if (done) break; if (!ws.write(value)) await new Promise(x => ws.once('drain', x)); } await new Promise(x => ws.end(x)); fs.renameSync(tmp, dest); }
  return kokoroDir();
}
const KOKORO_PY = `
import sys, soundfile as sf
from kokoro_onnx import Kokoro
d, text, out, voice, speed, lang = sys.argv[1:7]
k = Kokoro(d + '/kokoro-v1.0.onnx', d + '/voices-v1.0.bin')
s, sr = k.create(text, voice=voice, speed=float(speed), lang=lang)
sf.write(out, s, sr)
`;

// ---- provider catalog (what the app shows in Setup / Voice picker)
export function voiceCatalog() {
  const piperVoices = [['lessac', 'Lessac (clear, female)'], ['amy', 'Amy (female)'], ['ryan', 'Ryan (male)'], ['joe', 'Joe (male)']];
  return [
    { id: 'kokoro', label: 'Kokoro', kind: 'offline · free', quality: 4, available: kokoroAvailable(), install: 'pip install kokoro-onnx soundfile  then  reelkit voices install kokoro  (~350 MB)', langs: Object.keys(KOKORO_LANG), voices: Object.entries(KOKORO_VOICES).flatMap(([l, v]) => v.map(([id, n]) => ({ id, name: n, lang: l }))) },
    { id: 'piper', label: 'Piper', kind: 'offline · free', quality: 3, available: piperAvailable() && !!piperModelFor('en'), install: 'pip install piper-tts  then  reelkit voices install piper en', langs: Object.keys(PIPER_VOICES), voices: piperVoices.map(([id, name]) => ({ id, name, lang: 'en' })) },
    { id: 'elevenlabs', label: 'ElevenLabs', kind: 'online · your API key', quality: 5, available: !!process.env.ELEVENLABS_API_KEY, install: 'reelkit key elevenlabs <key>', langs: ['en', 'es', 'fr', 'it', 'pt', 'de', 'ja', 'ko', 'zh', 'hi', 'ru', 'ar', 'tr', 'pl', 'nl'], voices: [{ id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (default)', lang: 'en' }] },
    { id: 'edge', label: 'Microsoft Edge voices', kind: 'online · free · unofficial', quality: 4, available: has('edge-tts'), install: 'pip install edge-tts', langs: Object.keys(EDGE_VOICES), voices: Object.entries(EDGE_VOICES).map(([l, id]) => ({ id, name: id, lang: l })) },
    { id: 'sapi', label: 'Windows built-in', kind: 'offline · free', quality: 2, available: isWin, install: 'built in on Windows', langs: ['en'], voices: [] },
    { id: 'say', label: 'macOS built-in', kind: 'offline · free', quality: 2, available: isMac && has('say'), install: 'built in on macOS', langs: ['en'], voices: [] },
    { id: 'espeak', label: 'eSpeak', kind: 'offline · free', quality: 1, available: has('espeak-ng') || has('espeak'), install: 'apt install espeak-ng', langs: ['en'], voices: [] },
    { id: 'silent', label: 'No voice (captions only)', kind: 'none', quality: 0, available: true, install: '', langs: ['*'], voices: [] },
  ];
}

export const RTL = new Set(['he', 'ar', 'fa', 'ur']);

/** Pick best available voice provider. Order: elevenlabs (key) > edge-tts > OS voice > silent. */
export function detectProvider(pref) {
  if (pref && pref !== 'auto') return pref;
  if (process.env.ELEVENLABS_API_KEY) return 'elevenlabs';
  if (kokoroAvailable()) return 'kokoro';
  if (piperAvailable() && piperModelFor('en')) return 'piper';
  if (has('edge-tts')) return 'edge';
  if (isWin) return 'sapi';
  if (isMac && has('say')) return 'say';
  if (has('espeak-ng') || has('espeak')) return 'espeak';
  return 'silent';
}

/** Synthesize one line to an audio file. Returns {file, seconds} or {file:null, seconds:estimate}. */
export async function synth(text, base, provider, opts = {}) {
  const est = Math.max(1.2, text.split(/\s+/).length / 2.6);
  try {
    if (provider === 'elevenlabs') {
      const voice = (opts.voiceId && opts.voiceId.length > 15 ? opts.voiceId : null) || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps`, {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
      });
      if (!res.ok) throw new Error('elevenlabs ' + res.status);
      const j = await res.json();
      const f = base + '.mp3'; fs.writeFileSync(f, Buffer.from(j.audio_base64, 'base64'));
      // character alignment -> word timings
      const words = []; const a = j.alignment;
      if (a?.characters) { let cur = '', s0 = 0, e0 = 0; a.characters.forEach((ch, i) => { if (/\s/.test(ch)) { if (cur) words.push({ t: cur, s: s0, e: e0 }); cur = ''; } else { if (!cur) s0 = a.character_start_times_seconds[i]; cur += ch; e0 = a.character_end_times_seconds[i]; } }); if (cur) words.push({ t: cur, s: s0, e: e0 }); }
      return { file: f, seconds: probeDuration(f), words };
    }
    if (provider === 'kokoro') {
      const f = base + '.wav'; const lg = KOKORO_LANG[opts.lang || 'en'] ? (opts.lang || 'en') : 'en'; const voice = opts.voiceId && /^[a-z]{2}_/.test(opts.voiceId) ? opts.voiceId : KOKORO_DEFAULT[lg];
      const r = run(PY(), ['-c', KOKORO_PY, kokoroDir(), text, f, voice, String(opts.speed || 1.05), KOKORO_LANG[lg]]); if (!r.ok) throw new Error(r.err.slice(-300));
      return { file: f, seconds: probeDuration(f) };
    }
    if (provider === 'piper') {
      const model = (opts.voiceId && fs.existsSync(path.join(voicesDir(), `en_US-${opts.voiceId}-medium.onnx`)) ? path.join(voicesDir(), `en_US-${opts.voiceId}-medium.onnx`) : null) || piperModelFor(opts.lang || 'en') || piperModelFor('en'); if (!model) throw new Error('no Piper voice installed (reelkit voices install piper en)');
      const f = base + '.wav'; const [bin, ...pre] = piperBin();
      const r = run(bin, [...pre, '-m', model, '-f', f], { input: text }); if (!r.ok) throw new Error(r.err.slice(-200));
      return { file: f, seconds: probeDuration(f) };
    }
    if (provider === 'edge') {
      const f = base + '.mp3';
      const r = run('edge-tts', ['--voice', (opts.voiceId && /Neural$/.test(opts.voiceId) ? opts.voiceId : null) || opts.edgeVoice || EDGE_VOICES[opts.lang || 'en'] || 'en-US-AndrewNeural', '--rate', opts.rate || '+8%', '--text', text, '--write-media', f]);
      if (!r.ok) throw new Error(r.err);
      return { file: f, seconds: probeDuration(f) };
    }
    if (provider === 'sapi') {
      const f = base + '.wav';
      const ps = `Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate=1; $s.SetOutputToWaveFile($env:RK_OUT); $s.Speak($env:RK_TEXT); $s.Dispose()`;
      const r = run('powershell', ['-NoProfile', '-Command', ps], { env: { ...process.env, RK_OUT: path.resolve(f), RK_TEXT: text } });
      if (!r.ok) throw new Error(r.err);
      return { file: f, seconds: probeDuration(f) };
    }
    if (provider === 'say') {
      const aiff = base + '.aiff'; const r = run('say', ['-o', aiff, text]); if (!r.ok) throw new Error(r.err);
      return { file: aiff, seconds: probeDuration(aiff) };
    }
    if (provider === 'espeak') {
      const f = base + '.wav'; const bin = has('espeak-ng') ? 'espeak-ng' : 'espeak';
      const r = run(bin, ['-s', '165', '-w', f, text]); if (!r.ok) throw new Error(r.err);
      return { file: f, seconds: probeDuration(f) };
    }
  } catch (e) {
    console.warn(`  voice provider "${provider}" failed (${String(e.message).trim().slice(0, 120)}); using silent timing`);
  }
  return { file: null, seconds: est };
}
