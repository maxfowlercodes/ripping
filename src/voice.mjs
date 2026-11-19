import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { run, has, isWin, isMac, probeDuration, ensureDir } from './util.mjs';

export const EDGE_VOICES = { en: 'en-US-AndrewNeural', es: 'es-ES-AlvaroNeural', fr: 'fr-FR-HenriNeural', it: 'it-IT-DiegoNeural', pt: 'pt-BR-AntonioNeural', de: 'de-DE-ConradNeural', ja: 'ja-JP-KeitaNeural', ko: 'ko-KR-InJoonNeural', zh: 'zh-CN-YunxiNeural', hi: 'hi-IN-MadhurNeural', ru: 'ru-RU-DmitryNeural', uk: 'uk-UA-OstapNeural', he: 'he-IL-AvriNeural', ar: 'ar-SA-HamedNeural', el: 'el-GR-NestorasNeural', tr: 'tr-TR-AhmetNeural', nl: 'nl-NL-MaartenNeural', pl: 'pl-PL-MarekNeural' };
// Piper: free, offline neural TTS (pip install piper-tts). Voices are downloaded once from Hugging Face (rhasspy/piper-voices).
export const PIPER_VOICES = { en: 'en/en_US/lessac/medium/en_US-lessac-medium', 'en-gb': 'en/en_GB/alan/medium/en_GB-alan-medium', es: 'es/es_ES/davefx/medium/es_ES-davefx-medium', fr: 'fr/fr_FR/siwis/medium/fr_FR-siwis-medium', de: 'de/de_DE/thorsten/medium/de_DE-thorsten-medium', it: 'it/it_IT/riccardo/x_low/it_IT-riccardo-x_low', pt: 'pt/pt_BR/faber/medium/pt_BR-faber-medium', ru: 'ru/ru_RU/dmitri/medium/ru_RU-dmitri-medium', uk: 'uk/uk_UA/ukrainian_tts/medium/uk_UA-ukrainian_tts-medium', hi: 'hi/hi_IN/pratham/medium/hi_IN-pratham-medium', ar: 'ar/ar_JO/kareem/medium/ar_JO-kareem-medium', tr: 'tr/tr_TR/dfki/medium/tr_TR-dfki-medium', nl: 'nl/nl_NL/mls/medium/nl_NL-mls-medium', pl: 'pl/pl_PL/darkman/medium/pl_PL-darkman-medium', zh: 'zh/zh_CN/huayan/medium/zh_CN-huayan-medium' };
export const voicesDir = () => ensureDir(process.env.REELKIT_VOICES || path.join(os.homedir(), '.reelkit', 'voices'));
const piperBin = () => (has('piper') ? ['piper'] : run(isWin ? 'python' : 'python3', ['-c', 'import piper']).ok ? [isWin ? 'python' : 'python3', '-m', 'piper'] : null);
export const piperAvailable = () => !!piperBin();
export async function installPiperVoice(lang = 'en', log = console.log) {
  const rel = PIPER_VOICES[lang]; if (!rel) throw new Error('no Piper voice mapped for ' + lang);
  const name = path.basename(rel); const dir = voicesDir();
  for (const ext of ['.onnx', '.onnx.json']) {
    const f = path.join(dir, name + ext); if (fs.existsSync(f)) continue;
    log('downloading ' + name + ext); const r = await fetch(`https://huggingface.co/rhasspy/piper-voices/resolve/main/${rel}${ext}`); if (!r.ok) throw new Error('download failed ' + r.status);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  return path.join(dir, name + '.onnx');
}
export const piperModelFor = lang => { const rel = PIPER_VOICES[lang] || PIPER_VOICES.en; const f = path.join(voicesDir(), path.basename(rel) + '.onnx'); return fs.existsSync(f) ? f : null; };

export const RTL = new Set(['he', 'ar', 'fa', 'ur']);

/** Pick best available voice provider. Order: elevenlabs (key) > edge-tts > OS voice > silent. */
export function detectProvider(pref) {
  if (pref && pref !== 'auto') return pref;
  if (process.env.ELEVENLABS_API_KEY) return 'elevenlabs';
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
      const voice = opts.voiceId || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
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
    if (provider === 'piper') {
      const model = piperModelFor(opts.lang || 'en') || piperModelFor('en'); if (!model) throw new Error('no Piper voice installed (reelkit voices install en)');
      const f = base + '.wav'; const [bin, ...pre] = piperBin();
      const r = run(bin, [...pre, '-m', model, '-f', f], { input: text }); if (!r.ok) throw new Error(r.err.slice(-200));
      return { file: f, seconds: probeDuration(f) };
    }
    if (provider === 'edge') {
      const f = base + '.mp3';
      const r = run('edge-tts', ['--voice', opts.edgeVoice || EDGE_VOICES[opts.lang || 'en'] || 'en-US-AndrewNeural', '--rate', opts.rate || '+8%', '--text', text, '--write-media', f]);
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
