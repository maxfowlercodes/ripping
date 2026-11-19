import fs from 'node:fs';
import path from 'node:path';
import { getMeta, saveMeta, scriptPath, reelDir, createReel } from './store.mjs';
import { parseScript } from './script.mjs';
import { renderCarouselPng } from './render2.mjs';
import { summary } from './analytics.mjs';

export function carouselSlides(script) {
  const b = script.beats; const mid = b.slice(1, -1); const groups = [];
  const per = Math.max(1, Math.ceil(mid.length / 6));
  for (let i = 0; i < mid.length; i += per) groups.push(mid.slice(i, i + per).join(' '));
  return [{ kind: 'cover', text: b[0] }, ...groups.map((t, i) => ({ kind: 'step', n: i + 1, text: t })), { kind: 'cta', text: b[b.length - 1], button: 'Save this' }];
}

export async function repurpose(slug, { style } = {}) {
  const script = parseScript(fs.readFileSync(scriptPath(slug), 'utf8')); const m = getMeta(slug);
  const files = await renderCarouselPng({ slides: carouselSlides(script), style: style || m.style || script.style || 'aurora-dark', outDir: path.join(reelDir(slug), 'carousel') });
  const s = summary().reels.find(r => r.slug === slug);
  const brief = `# Repurpose brief: ${m.title}\n\nWinner stats: ${s ? `${s.views} views (${s.vsMedian}x your median), ${s.saves} saves, ${s.shares} shares` : 'not posted yet'}\n\n## Original script\n${script.beats.map((l, i) => `${i + 1}. ${l}`).join('\n')}\n\n## Task for Claude\n1. Name why this worked (hook type, payoff, length).\n2. Write 5 NEW hooks for the same payoff, each a different formula.\n3. Save them with: node bin/reelkit.mjs hooks ${slug} --add "<hook>"  (one call per hook)\n4. Draft 2 new full scripts from the best two hooks (node bin/reelkit.mjs new ...).\n`;
  fs.writeFileSync(path.join(reelDir(slug), 'repurpose.md'), brief);
  m.carousel = files.map(f => path.basename(f)); saveMeta(slug, m);
  return { files, brief: path.join(reelDir(slug), 'repurpose.md') };
}

/** Branch: new reel that reuses an existing reel's style, visuals and structure with new words (line N replaces line N). */
export function branch(slug, title, newLines) {
  const src = fs.readFileSync(scriptPath(slug), 'utf8').split(/\r?\n/); const out = []; let k = 0;
  for (const l of src) {
    const t = l.trim(); if (!t || t.startsWith('//') || t.startsWith('# ') || /^\[style:/i.test(t)) { out.push(t.startsWith('# ') ? '# ' + title : l); continue; }
    const dm = t.match(/(\{[^}]*\})\s*$/); const nl = newLines[k++]; out.push(nl == null ? l : nl + (dm && !/\{/.test(nl) ? ' ' + dm[1] : ''));
  }
  const s = createReel(title, out.join('\n')); const m = getMeta(s); const o = getMeta(slug); m.style = o.style; m.parent = slug; saveMeta(s, m); return s;
}
