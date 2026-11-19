// Style-matched animated captions over your own footage (transparent overlay frames from the same engine).
import path from 'node:path';
import { spawn } from 'node:child_process';
import { launch } from './browser.mjs';
import { openStage } from './render2.mjs';
import { probeDuration } from './util.mjs';
import { RTL } from './voice.mjs';

export function chunkWords(words, { maxWords = 5, gap = 0.6 } = {}) {
  const beats = []; let cur = [];
  const flush = () => { if (cur.length) beats.push(cur); cur = []; };
  words.forEach((w, i) => { cur.push(w); const next = words[i + 1]; if (cur.length >= maxWords || /[.?!]$/.test(w.t) || (next && next.s - w.e > gap)) flush(); }); flush();
  return beats.map((c, i) => { const start = Math.max(0, c[0].s - 0.04); const nextStart = beats[i + 1] ? beats[i + 1][0].s - 0.04 : Infinity; const end = Math.min(nextStart, c[c.length - 1].e + 0.45);
    return { text: c.map(w => w.t).join(' '), start, end, words: c.map(w => ({ t: w.t, s: w.s, e: w.e, key: /[\d$%]/.test(w.t) || w.t.length > 9 })), visual: null }; });
}

export async function captionFootage({ video, words, style = 'volt', out, lang = 'en', y = 1060, fps = 30, onProgress = () => {} }) {
  const dur = probeDuration(video); const beats = chunkWords(words);
  if (!beats.length) throw new Error('no words to caption');
  const browser = await launch();
  try {
    const { ctx, page } = await openStage(browser, 1);
    await page.evaluate(s => RK.setup(s), { style, beats, total: dur, rtl: RTL.has(lang), lang, overlay: true, overlayTop: y });
    const frames = Math.ceil(dur * fps);
    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', ['-y', '-i', video, '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', '-filter_complex', '[0:v][1:v]overlay=0:0:shortest=1,format=yuv420p[v]', '-map', '[v]', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-c:a', 'copy', '-movflags', '+faststart', out], { stdio: ['pipe', 'ignore', 'pipe'] });
      let err = ''; ff.stderr.on('data', d => (err += d)); ff.on('close', c => (c === 0 ? resolve() : reject(new Error('ffmpeg: ' + err.slice(-400))))); ff.on('error', reject);
      (async () => { for (let f = 0; f < frames; f++) { await page.evaluate(t => RK.seek(t), f / fps); const buf = await page.screenshot({ type: 'png', omitBackground: true }); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); if (f % 15 === 0) onProgress({ done: f, total: frames }); } ff.stdin.end(); })().catch(e => { ff.kill(); reject(e); });
    });
    await ctx.close(); return out;
  } finally { await browser.close(); }
}
