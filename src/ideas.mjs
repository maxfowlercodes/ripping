import path from 'node:path';
import crypto from 'node:crypto';
import { home, readJson, writeJson } from './util.mjs';
import { askClaude } from './claude.mjs';
import { schemas, SYSTEM, ideasPrompt, refPrompt } from './prompts.mjs';
import { getBrand } from './brand.mjs';
import { listSwipe } from './swipe.mjs';
import { listReels } from './store.mjs';

const file = () => path.join(home(), 'ideas.json');
export const listIdeas = status => readJson(file(), { items: [] }).items.filter(i => !status || i.status === status);
const saveAll = items => writeJson(file(), { items });
export function setIdea(id, patch) { const items = readJson(file(), { items: [] }).items; const it = items.find(i => i.id === id); if (it) Object.assign(it, patch); saveAll(items); return it; }
export const referenceCount = () => listSwipe({ status: 'saved' }).length;

/** Cache a one-time formula analysis per saved reference (cheap model, cached 90 days). */
export async function analyzeRefs(max = 6, log) {
  const refs = listSwipe({ status: 'saved' }).slice(0, max); const out = [];
  for (const r of refs) { try { const a = await askClaude({ task: 'reference_analysis', prompt: refPrompt(r), system: SYSTEM, schema: schemas.refAnalysis, log }); out.push({ ...r, analysis: a.output }); } catch { out.push(r); } }
  return out;
}
export async function generateIdeas({ n = 5, log } = {}) {
  const brand = getBrand(); const refs = await analyzeRefs(6, log); const recent = listReels().map(r => r.title);
  const r = await askClaude({ task: 'ideas', prompt: ideasPrompt({ brand, refs, recent, n }), system: SYSTEM, schema: schemas.ideas, log });
  const items = readJson(file(), { items: [] }).items; const have = new Set(items.map(i => i.hook.toLowerCase()));
  const fresh = (r.output.ideas || []).filter(i => i.hook && !have.has(i.hook.toLowerCase())).map(i => ({ id: crypto.randomBytes(3).toString('hex'), ...i, status: 'new', created: new Date().toISOString() }));
  saveAll([...fresh, ...items].slice(0, 200)); return fresh;
}
