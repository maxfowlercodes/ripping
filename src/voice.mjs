import fs from 'node:fs';
import path from 'node:path';
import { run, has, isWin, isMac, probeDuration } from './util.mjs';

/** Pick best available voice provider. Order: elevenlabs (key) > edge-tts > OS voice > silent. */
export function detectProvider(pref) {
  if (pref && pref !== 'auto') return pref;
  if (process.env.ELEVENLABS_API_KEY) return 'elevenlabs';
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
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
      });
      if (!res.ok) throw new Error('elevenlabs ' + res.status);
      const f = base + '.mp3'; fs.writeFileSync(f, Buffer.from(await res.arrayBuffer()));
      return { file: f, seconds: probeDuration(f) };
    }
    if (provider === 'edge') {
      const f = base + '.mp3';
      const r = run('edge-tts', ['--voice', opts.edgeVoice || 'en-US-AndrewNeural', '--rate', opts.rate || '+8%', '--text', text, '--write-media', f]);
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
