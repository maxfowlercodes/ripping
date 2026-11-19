// Motion-graphics renderer: HTML scenes in Chromium -> frames -> ffmpeg. Per-scene cache makes renders resumable.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { launch, rootDir } from './browser.mjs';
import { run, ensureDir, probeDuration, home } from './util.mjs';
import { synth, detectProvider, RTL, voiceCatalog } from './voice.mjs';
import { transcribe, alignTokens, whisperAvailable } from './transcribe.mjs';
import { writeSfx, eventsFor } from './sfx.mjs';
import { assertDisk } from './storage.mjs';
import { checkLayout } from './layoutqa.mjs';

const sha = x => crypto.createHash('sha1').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex').slice(0, 14);
export const customStyleFiles = () => {
  const dirs = [path.join(rootDir, 'styles', 'custom'), path.join(home(), 'styles')];
  return dirs.flatMap(d => (fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.js')).map(f => path.join(d, f)) : []));
};
const engineHash = () => sha(['runtime.js', 'widgets.js', 'styles.js'].map(f => fs.readFileSync(path.join(rootDir, 'render', f), 'utf8')).join() + customStyleFiles().map(f => fs.readFileSync(f, 'utf8')).join());

/** Per-frame loudness (0..1) of an audio file: drives avatar lip-sync. */
export function audioEnvelope(file, fps) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', '8000', '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0 || !r.stdout?.length) return null;
  const buf = r.stdout; const n = buf.length / 4, per = Math.floor(8000 / fps), frames = Math.floor(n / per); const rms = new Float32Array(frames);
  for (let f = 0; f < frames; f++) { let sum = 0; for (let i = 0; i < per; i++) { const v = buf.readFloatLE((f * per + i) * 4); sum += v * v; } rms[f] = Math.sqrt(sum / per); }
  const sorted = [...rms].sort((a, b) => a - b); const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1e-6; const gate = p95 * 0.06;
  return { fps, data: [...rms].map(v => (v < gate ? 0 : Math.min(1, Math.pow(v / p95, 0.7)))).map(v => +v.toFixed(3)) };
}

export function tokenize(text, lang) {
  if (['ja', 'zh', 'th'].includes(lang) && typeof Intl?.Segmenter === 'function') return [...new Intl.Segmenter(lang, { granularity: 'word' }).segment(text)].filter(s => s.isWordLike || /\S/.test(s.segment)).map(s => s.segment);
  return text.split(/\s+/).filter(Boolean);
}

/** Make an in-page page object for rendering. */
export async function openStage(browser, k) {
  const ctx = await browser.newContext({ viewport: { width: Math.round(1080 * k), height: Math.round(1920 * k) }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(path.join(rootDir, 'render', 'stage.html')).href);
  for (const f of customStyleFiles()) await page.addScriptTag({ path: f });
  await page.evaluate(k => RK.setScale(k), k);
  return { ctx, page };
}

async function grabScreen(browser, url, outFile) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const page = await ctx.newPage();
  try { await page.goto(url, { waitUntil: 'load', timeout: 25000 }); await page.waitForTimeout(1200); await page.screenshot({ path: outFile }); } finally { await ctx.close(); }
}

function encodeSegment(frames, fps, out) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), out], { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = ''; ff.stderr.on('data', d => (err += d)); ff.on('close', c => (c === 0 ? resolve() : reject(new Error('ffmpeg: ' + err.slice(-400)))));
    ff.on('error', reject);
    frames(async buf => { if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }).then(() => ff.stdin.end(), e => { ff.kill(); reject(e); });
  });
}

const FALLBACKS = ['kokoro', 'piper', 'edge', 'sapi', 'say', 'espeak'];
const est = t => Math.max(1.2, t.split(/\s+/).length / 2.6);
export async function renderReel2({ script, style, voice = 'auto', lang = 'en', music, out, fps = 30, draft = false, avatarFile, avatar, brandColors, sync, voiceId, sfx, workDir, fallbackStyles = ['glass', 'clean-white', 'mono-minimal', 'fintech-clean'], layoutCheck = true, onLog = console.log, onProgress = () => {} }) {
  ensureDir(workDir); assertDisk(1.5e9, workDir);
  const provider = detectProvider(voice); const dead = new Set();
  const syncWhisper = sync !== false && whisperAvailable();
  const beatsText = script.beats; const n = beatsText.length;
  onLog(`style=${style} voice=${provider} lang=${lang}${draft ? ' (draft)' : ''}`);

  // ---- 1. audio + timing
  const beatInfo = [];
  let avatarSecs = avatarFile ? probeDuration(avatarFile) : null;
  for (let i = 0; i < n; i++) {
    const text = beatsText[i]; let seconds, file = null, words = null;
    if (avatarFile) { const tot = beatsText.reduce((a, b) => a + b.length, 0); seconds = (avatarSecs * text.length) / tot; }
    else {
      const key = sha([text, provider, lang, voiceId || '', process.env.ELEVENLABS_VOICE_ID || '']);
      const cached = fs.readdirSync(workDir).find(f => f.startsWith('a_' + key));
      if (cached) { file = path.join(workDir, cached); seconds = probeDuration(file); const wj = path.join(workDir, 'a_' + key + '.json'); if (fs.existsSync(wj)) words = JSON.parse(fs.readFileSync(wj, 'utf8')); }
      else {
        // try the chosen voice, then fall back to the next working one (a provider that failed once is skipped for this render)
        let v = { file: null, seconds: 0 };
        for (const pv of [provider, ...FALLBACKS.filter(x => x !== provider)]) {
          if (dead.has(pv) || (pv !== provider && !voiceCatalog().find(c => c.id === pv)?.available)) continue;
          v = await synth(text, path.join(workDir, 'a_' + key), pv, { lang, voiceId: pv === provider ? voiceId : undefined }); if (v.file || pv === 'silent') { if (pv !== provider) onLog(`  voice fallback: ${provider} -> ${pv}`); break; } dead.add(pv);
        }
        file = v.file; seconds = v.seconds || est(text); words = v.words;
        // exact caption timing for any voice: align the script to Whisper's word timestamps (falls back to estimates)
        if (!words && file && syncWhisper) {
          const tr = transcribe(file, { lang, model: process.env.REELKIT_SYNC_MODEL || (lang === 'en' ? 'tiny.en' : 'base'), verbatim: false });
          const al = tr.words ? alignTokens(tokenize(text, lang), tr.words) : null; if (al) words = al.map((a, k) => ({ t: tokenize(text, lang)[k], s: a.s, e: a.e }));
        }
        if (words) fs.writeFileSync(path.join(workDir, 'a_' + key + '.json'), JSON.stringify(words));
      }
    }
    beatInfo.push({ text, file, seconds, words });
    onProgress({ stage: 'voice', done: i + 1, total: n });
  }
  // build spec
  let t0 = 0;
  const specBeats = beatInfo.map((b, i) => {
    const dur = +(Math.max(1.3, b.seconds + 0.3)).toFixed(3);
    const toks = tokenize(b.text, lang); const wc = toks.reduce((a, w) => a + w.length + 1, 0);
    let acc = 0.05; const spoken = Math.max(0.5, b.seconds - 0.1);
    let words = toks.map((w, k) => { const s = t0 + acc; acc += (spoken * (w.length + 1)) / wc; return { t: w, s, e: t0 + acc, key: script.keys?.[i]?.has(k) || false }; });
    if (b.words && b.words.length === toks.length) words = toks.map((w, k) => ({ t: w, s: t0 + b.words[k].s, e: t0 + b.words[k].e, key: script.keys?.[i]?.has(k) || false }));
    // auto key words
    if (!words.some(w => w.key)) {
      const idx = []; words.forEach((w, k) => { if (/[\d$%]/.test(w.t)) idx.push(k); });
      if (!idx.length && words.length > 2) { let best = 0; words.forEach((w, k) => { if (w.t.length > words[best].t.length) best = k; }); idx.push(best); }
      idx.slice(0, 2).forEach(k => (words[k].key = true));
    }
    // auto big number
    let visual = script.visuals?.[i] || null;
    if (!visual) { const m = b.text.match(/(\$?\d[\d,.]*\s?(?:%|[kKmMxX])?)/g)?.find(x => x.replace(/\D/g, '').length >= 2 && x.length >= 3); if (m) visual = { type: 'big', text: m.trim() }; }
    const beat = { text: b.text, start: t0, end: t0 + dur, words, visual }; t0 += dur; return beat;
  });
  const total = t0;

  // ---- audio track first (lip-sync needs its envelope)
  const aud = path.join(workDir, 'audio.m4a'); let r;
  if (avatarFile) r = run('ffmpeg', ['-y', '-i', avatarFile, '-vn', '-t', String(total), '-c:a', 'aac', aud]);
  else {
    const args = ['-y']; let fc = '';
    beatInfo.forEach((b, i) => { const d = (specBeats[i].end - specBeats[i].start).toFixed(3);
      if (b.file) args.push('-i', b.file); else args.push('-f', 'lavfi', '-t', d, '-i', 'anullsrc=r=44100:cl=mono');
      fc += `[${i}:a]aresample=44100,aformat=channel_layouts=mono,apad=whole_dur=${d},atrim=0:${d}[a${i}];`; });
    fc += beatInfo.map((_, i) => `[a${i}]`).join('') + `concat=n=${n}:v=0:a=1[a]`;
    r = run('ffmpeg', [...args, '-filter_complex', fc, '-map', '[a]', '-c:a', 'aac', '-b:a', '160k', aud]);
  }
  if (!r.ok) throw new Error('audio failed: ' + r.err.slice(-400));
  const envelope = audioEnvelope(aud, fps);
  // sound effects (generated), mixed under the voice; lip-sync above used the voice-only track
  let mixedAud = aud;
  if (sfx !== false && !avatarFile) { const sw = path.join(workDir, 'sfx.wav'); if (writeSfx(eventsFor(specBeats), total, sw)) { mixedAud = path.join(workDir, 'audio_sfx.m4a'); const rs = run('ffmpeg', ['-y', '-i', aud, '-i', sw, '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]', '-map', '[a]', '-c:a', 'aac', '-b:a', '160k', mixedAud]); if (!rs.ok) mixedAud = aud; } }

  // ---- 2. browser
  const browser = await launch();
  try {
    // resolve image/screen visuals to absolute file URLs
    for (let i = 0; i < specBeats.length; i++) {
      const v = specBeats[i].visual; if (!v) continue;
      if (v.type === 'screen' || v.type === 'browser') { const f = path.join(workDir, 'screen_' + sha(v.url) + '.png'); if (!fs.existsSync(f)) { onLog('  capturing ' + v.url); await grabScreen(browser, v.url, f); } specBeats[i].visual = v.type === 'browser' ? { type: 'browser', url: v.url, src: pathToFileURL(f).href } : { type: 'image', src: pathToFileURL(f).href }; }
      else if (v.type === 'image' && !/^(file|https?|data):/.test(v.src)) specBeats[i].visual = { type: 'image', src: pathToFileURL(path.resolve(v.src)).href };
    }
    const k = draft ? 0.5 : 1;
    const { ctx, page } = await openStage(browser, k);
    const builtin = avatar && !String(avatar).startsWith('heygen') ? { character: String(avatar).replace(/^builtin:/, '') } : undefined;
    const spec = { style, beats: specBeats, total, rtl: RTL.has(lang), lang, envelope, avatar: builtin, colors: brandColors || undefined };
    await page.evaluate(s => RK.setup(s), spec);
    // ---- layout QA: measure text clashes every 2s; if the chosen style clashes, try safer ones and keep the cleanest
    let qa = null;
    if (layoutCheck) {
      try {
        const qdir = ensureDir(path.join(workDir, 'qa')); let best = null; const cands = [style, ...fallbackStyles.filter(x => x !== style)].slice(0, 3);
        for (const st of cands) {
          spec.style = st; await page.evaluate(sp => RK.setup(sp), spec);
          const q = await checkLayout(page, specBeats, total, { writeShot: async t => { const f = path.join(qdir, `clash_${st}_${t}.jpg`); await page.screenshot({ path: f, type: 'jpeg', quality: 70 }); return f; } }); q.style = st;
          onLog(`layout check (${st}): ${q.checked} moments, ${q.issues.length ? q.issues.length + ' clash(es), e.g. ' + q.issues[0].text + ' at ' + q.issues[0].t + 's' : 'clean'}`);
          if (!best || q.issues.length < best.issues.length) best = q; if (!q.issues.length) break;
        }
        if (best.style !== style) onLog(`layout check: using ${best.style} instead of ${style} to avoid clashing text`);
        style = best.style; spec.style = style; await page.evaluate(sp => RK.setup(sp), spec); qa = { style, checked: best.checked, clashes: best.issues.length, examples: best.issues.slice(0, 5), shots: best.shots };
      } catch (e) { onLog('layout check skipped: ' + e.message); spec.style = style; await page.evaluate(sp => RK.setup(sp), spec); }
    }

    const eh = engineHash(); const segs = [];
    for (let i = 0; i < n; i++) {
      const b = specBeats[i]; const env = envelope ? sha(envelope.data.slice(Math.floor(b.start * fps), Math.ceil(b.end * fps))) : ''; const key = sha([b, style, fps, draft, eh, total, env, spec.avatar, brandColors]);
      const seg = path.join(workDir, `seg_${String(i).padStart(3, '0')}_${key}.mp4`);
      segs.push(seg);
      if (fs.existsSync(seg)) { onLog(`  beat ${i + 1}/${n} cached`); onProgress({ stage: 'render', done: i + 1, total: n }); continue; }
      const f0 = Math.round(b.start * fps), f1 = Math.round(b.end * fps);
      const tmpSeg = seg + '.part.mp4';
      await encodeSegment(async push => { for (let f = f0; f < f1; f++) { await page.evaluate(t => RK.seek(t), f / fps); await push(await page.screenshot({ type: 'jpeg', quality: 92 })); } }, fps, tmpSeg);
      fs.renameSync(tmpSeg, seg);
      onLog(`  beat ${i + 1}/${n} rendered (${f1 - f0} frames)`); onProgress({ stage: 'render', done: i + 1, total: n });
    }
    await ctx.close();
    // remove stale segments
    for (const f of fs.readdirSync(workDir)) if (f.startsWith('seg_') && !segs.includes(path.join(workDir, f))) fs.rmSync(path.join(workDir, f), { force: true });

    // ---- 3. concat video
    const list = path.join(workDir, 'list.txt'); fs.writeFileSync(list, segs.map(s => `file '${s.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
    const vcat = path.join(workDir, 'video.mp4'); r = run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', vcat]);
    if (!r.ok) throw new Error('concat failed: ' + r.err.slice(-400));

    // ---- 5. mux (+music, +avatar overlay)
    ensureDir(path.dirname(out));
    const a = ['-y', '-i', vcat, '-i', mixedAud]; let fcx = ''; let vmap = '0:v', amap = '1:a'; let vcodec = ['-c:v', 'copy'];
    let idx = 2;
    if (avatarFile) { a.push('-i', avatarFile); fcx += `[${idx}:v]scale=1080:-2,colorkey=0x00FF00:0.32:0.12,format=yuva420p[av];[0:v][av]overlay=0:H-h:shortest=1:format=auto,format=yuv420p[v];`; vmap = '[v]'; vcodec = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18']; idx++; }
    if (music && fs.existsSync(music)) { a.push('-stream_loop', '-1', '-i', music); fcx += `[${idx}:a]volume=0.10[m];[1:a][m]amix=inputs=2:duration=first:dropout_transition=0[am];`; amap = '[am]'; idx++; }
    if (fcx) a.push('-filter_complex', fcx.replace(/;$/, ''));
    a.push('-map', vmap, '-map', amap, ...vcodec, '-c:a', 'aac', '-t', String(total), '-movflags', '+faststart', out);
    r = run('ffmpeg', a); if (!r.ok) throw new Error('mux failed: ' + r.err.slice(-500));
    return { out, durations: specBeats.map(b => +(b.end - b.start).toFixed(2)), seconds: +total.toFixed(1), provider, spec, style, qa };
  } finally { await browser.close(); }
}

/** Carousel PNGs (1080x1350) in a given style. */
export async function renderCarouselPng({ slides, style, outDir, lang = 'en' }) {
  ensureDir(outDir);
  const browser = await launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(pathToFileURL(path.join(rootDir, 'render', 'stage.html')).href);
    for (const f of customStyleFiles()) await page.addScriptTag({ path: f });
    await page.evaluate(s => RK.carousel(s), { style, slides, rtl: RTL.has(lang) });
    const files = [];
    for (let i = 0; i < slides.length; i++) { await page.evaluate(i => RK.showSlide(i), i); const f = path.join(outDir, `slide-${String(i + 1).padStart(2, '0')}.png`); await page.screenshot({ path: f }); files.push(f); }
    return files;
  } finally { await browser.close(); }
}

/** Full style metadata (from the browser registry): name, desc, tags, bg, caption mode, whether it carries a presenter. */
export async function styleInfo() {
  const browser = await launch();
  try { const { ctx, page } = await openStage(browser, 1); const r = await page.evaluate(() => Object.keys(RK.styles).map(n => { const c = RK.resolve(n); return { name: n, desc: c.desc || '', tags: c.tags || null, bg: c.bg, captionMode: c.caption?.mode || 'words', key: c.key, transition: c.transition || 'slide', presenter: !!c.avatar, glass: !!c.glass }; })); await ctx.close(); return r; }
  finally { await browser.close(); }
}

/** One thumbnail per style (270x480 jpg) + catalog.json for the chooser. */
export async function renderStylePreviews(outDir, catalogFile, onLog = () => {}) {
  ensureDir(outDir); const info = await styleInfo(); const browser = await launch();
  const words = [['Stop', .1], ['posting', .4], ['*reels*', .8], ['nobody', 1.2], ['watches.', 1.5]].map(([t, s]) => ({ t: t.replace(/\*/g, ''), s, e: s + .3, key: t.includes('*') }));
  const beat = { text: 'Stop posting reels nobody watches.', start: 0, end: 5, words, visual: { type: 'counter', value: 628, label: 'teams onboarded', delta: '+64%' } };
  try {
    const { ctx, page } = await openStage(browser, 0.25);
    for (const st of info) { await page.evaluate(s => RK.setup(s), { style: st.name, beats: [beat], total: 5, lang: 'en' }); await page.evaluate(() => RK.seek(2.6)); await page.screenshot({ path: path.join(outDir, st.name + '.jpg'), type: 'jpeg', quality: 78 }); onLog(st.name); }
    await ctx.close();
  } finally { await browser.close(); }
  if (catalogFile) fs.writeFileSync(catalogFile, JSON.stringify(Object.fromEntries(info.map(i => [i.name, i])), null, 1));
  return info.length;
}

export async function styleList() {
  const browser = await launch();
  try {
    const { ctx, page } = await openStage(browser, 1);
    const r = await page.evaluate(() => Object.keys(RK.styles).map(n => ({ name: n, desc: RK.resolve(n).desc || '' })));
    await ctx.close(); return r;
  } finally { await browser.close(); }
}
