// Procedurally generated sound effects (no samples, no licences): whoosh on cuts, pop on key words, thud on big beats.
import fs from 'node:fs';

const SR = 44100;
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1; }

const GEN = {
  whoosh(vol = 0.28) { const n = Math.floor(SR * 0.42), r = rng(11); const out = new Float32Array(n); let lp = 0;
    for (let i = 0; i < n; i++) { const t = i / n; const cutoff = 0.04 + 0.5 * Math.sin(Math.PI * t) ** 1.5; lp += (r() - lp) * cutoff; const env = Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 2; out[i] = lp * env * vol * 2.2; } return out; },
  pop(vol = 0.32) { const n = Math.floor(SR * 0.14); const out = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / n; const f = 520 + 700 * (1 - t) ** 2; ph += (2 * Math.PI * f) / SR; out[i] = Math.sin(ph) * Math.exp(-t * 7) * vol; } return out; },
  thud(vol = 0.5) { const n = Math.floor(SR * 0.34), r = rng(5); const out = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / n; const f = 130 - 70 * t; ph += (2 * Math.PI * f) / SR; out[i] = (Math.sin(ph) * Math.exp(-t * 6) + r() * 0.12 * Math.exp(-t * 30)) * vol; } return out; },
};

/** events: [{t: seconds, kind}] -> mono 16-bit WAV of length `total` seconds. Returns false if there is nothing to write. */
export function writeSfx(events, total, file, gain = 0.95) {
  if (!events.length) return false; const n = Math.ceil(total * SR); const mix = new Float32Array(n);
  for (const e of events) { const g = GEN[e.kind]; if (!g) continue; const s = g(); const start = Math.max(0, Math.floor(e.t * SR)); for (let i = 0; i < s.length && start + i < n; i++) mix[start + i] += s[i] * gain; }
  const buf = Buffer.alloc(44 + n * 2); buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(Math.tanh(mix[i]) * 32767))), 44 + i * 2);
  fs.writeFileSync(file, buf); return true;
}

/** Derive effect events from the rendered timeline (beats with start times, key words, visuals). */
export function eventsFor(beats) {
  const ev = [];
  beats.forEach((b, i) => {
    if (i > 0) ev.push({ t: Math.max(0, b.start - 0.06), kind: 'whoosh' });
    if (b.visual && (b.visual.type === 'big' || b.visual.type === 'price')) ev.push({ t: b.start + 0.12, kind: 'thud' });
    const k = b.words.find(w => w.key); if (k) ev.push({ t: k.s, kind: 'pop' });
  });
  return ev;
}
