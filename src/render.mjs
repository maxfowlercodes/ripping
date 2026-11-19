import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, ensureDir, findFont, readJson, tmp } from './util.mjs';
import { synth, detectProvider } from './voice.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const themes = () => readJson(path.join(here, '..', 'styles', 'themes.json'), {});

export function wrap(text, max) {
  const out = []; let cur = '';
  for (const w of text.split(/\s+/)) {
    if ((cur + ' ' + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  return out.join('\n');
}
const esc = p => p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");

/** Render a script to a 1080x1920 mp4 using only ffmpeg. */
export async function renderReel({ beats, style = 'saas-dark', voice = 'auto', music, out, onLog = console.log }) {
  const th = themes()[style] || themes()['saas-dark'];
  const font = findFont();
  if (!font) throw new Error('No font found. Set REELKIT_FONT to a .ttf path.');
  const work = tmp();
  const provider = detectProvider(voice);
  onLog(`style=${style} voice=${provider}`);
  const clips = [];
  const maxChars = Math.floor(900 / (th.font * 0.6));
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    const v = await synth(b, path.join(work, 'a' + i), provider);
    const dur = +(Math.max(1.4, v.seconds * th.pace + 0.35)).toFixed(2);
    const txt = path.join(work, `t${i}.txt`);
    fs.writeFileSync(txt, wrap(b, maxChars));
    const isHook = i === 0, isCta = i === beats.length - 1;
    const color = isHook || isCta ? th.accent : th.fg;
    const size = isHook ? Math.round(th.font * 1.15) : th.font;
    const draw = `drawtext=fontfile='${esc(font)}':textfile='${esc(txt)}':fontcolor=${color}:fontsize=${size}:line_spacing=18:` +
      `x=(w-text_w)/2:y=(h-text_h)/2+if(lt(t\\,0.3)\\,(0.3-t)*260\\,0):alpha='min(1\\,t/0.25)':borderw=4:bordercolor=black@0.35`;
    const bar = `drawbox=x=90:y=ih*0.72:w=${Math.round(1080 * 0.2 + (i / beats.length) * 1080 * 0.6)}:h=10:color=${th.accent}@0.9:t=fill`;
    const clip = path.join(work, `c${i}.mp4`);
    const args = ['-y', '-f', 'lavfi', '-i', `gradients=s=1080x1920:c0=${th.bg[0]}:c1=${th.bg[1]}:x0=0:y0=0:x1=${(i % 2) * 1080}:y1=1920:d=${dur}:r=30`];
    if (v.file) args.push('-i', v.file); else args.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono');
    args.push('-vf', `${draw},${bar},format=yuv420p`, '-af', 'apad,aresample=44100', '-t', String(dur),
      '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-r', '30', '-c:a', 'aac', '-ar', '44100', '-ac', '1', clip);
    const r = run('ffmpeg', args);
    if (!r.ok) throw new Error(`ffmpeg failed on beat ${i + 1}:\n${r.err.slice(-600)}`);
    clips.push({ clip, dur });
    onLog(`  beat ${i + 1}/${beats.length} ${dur}s`);
  }
  const list = path.join(work, 'list.txt');
  fs.writeFileSync(list, clips.map(c => `file '${c.clip.replace(/\\/g, '/')}'`).join('\n'));
  ensureDir(path.dirname(out));
  const cat = path.join(work, 'cat.mp4');
  let r = run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', cat]);
  if (!r.ok) throw new Error('concat failed: ' + r.err.slice(-400));
  if (music && fs.existsSync(music)) {
    r = run('ffmpeg', ['-y', '-i', cat, '-stream_loop', '-1', '-i', music, '-filter_complex', '[1:a]volume=0.12[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]',
      '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-shortest', out]);
  } else fs.copyFileSync(cat, out);
  if (!r.ok) throw new Error('mix failed: ' + r.err.slice(-400));
  fs.rmSync(work, { recursive: true, force: true });
  return { out, durations: clips.map(c => c.dur), seconds: +clips.reduce((n, c) => n + c.dur, 0).toFixed(1), provider };
}

/** Repurpose: export 1080x1350 carousel slides (PNG) from beats. */
export function renderCarousel({ beats, style = 'saas-dark', outDir }) {
  const th = themes()[style] || themes()['saas-dark'];
  const font = findFont(); ensureDir(outDir);
  const work = tmp(); const files = [];
  const slides = [beats[0], ...beats.slice(1, -1).reduce((a, b, i) => { (i % 2 ? a[a.length - 1].push(b) : a.push([b])); return a; }, []).map(g => g.join('\n\n')), beats[beats.length - 1]];
  slides.forEach((s, i) => {
    const txt = path.join(work, `s${i}.txt`); fs.writeFileSync(txt, wrap(s.replace(/\n\n/g, ' • '), 22));
    const f = path.join(outDir, `slide-${String(i + 1).padStart(2, '0')}.png`);
    const r = run('ffmpeg', ['-y', '-f', 'lavfi', '-i', `gradients=s=1080x1350:c0=${th.bg[0]}:c1=${th.bg[1]}:d=1:r=1`, '-frames:v', '1',
      '-vf', `drawtext=fontfile='${esc(font)}':textfile='${esc(txt)}':fontcolor=${i === 0 ? th.accent : th.fg}:fontsize=64:line_spacing=16:x=(w-text_w)/2:y=(h-text_h)/2,drawtext=fontfile='${esc(font)}':text='${i + 1}/${slides.length}':fontcolor=${th.accent}:fontsize=36:x=w-text_w-60:y=h-90`, f]);
    if (r.ok) files.push(f);
  });
  fs.rmSync(work, { recursive: true, force: true });
  return files;
}
