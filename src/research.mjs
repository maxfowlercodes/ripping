// First-run deep research: four cached stages. Stages 1-3 use Claude's web search/fetch (no other tools), stage 4 synthesizes.
// Results are saved after each stage, so an interrupted run resumes. Everything cites sources; unverified items are labelled.
import fs from 'node:fs';
import path from 'node:path';
import { home, readJson, writeJson } from './util.mjs';
import { askClaude } from './claude.mjs';
import { getBrand, saveBrand, ctaText } from './brand.mjs';
import crypto from 'node:crypto';

const file = () => path.join(home(), 'research.json');
export const getResearch = () => readJson(file(), null);
const arr = { type: 'array', items: { type: 'string' } };
const src = { type: 'array', items: { type: 'object', properties: { url: { type: 'string' }, note: { type: 'string' } }, required: ['url'] } };

const SCHEMAS = {
  site: { type: 'object', properties: { what_it_is: { type: 'string' }, who_its_for: { type: 'string' }, offer: { type: 'string' }, pricing: { type: 'string' }, differentiators: arr, proof_found: { type: 'array', items: { type: 'object', properties: { claim: { type: 'string' }, source_url: { type: 'string' } }, required: ['claim'] } }, tone_of_voice: { type: 'string' }, gaps: arr, sources: src }, required: ['what_it_is', 'offer'] },
  audience: { type: 'object', properties: { segments: arr, pains: arr, desires: arr, objections: arr, customer_language: arr, where_they_hang_out: arr, buying_triggers: arr, confidence: { type: 'string' }, sources: src }, required: ['segments', 'pains', 'customer_language'] },
  competitors: { type: 'object', properties: { competitors: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, url: { type: 'string' }, positioning: { type: 'string' }, weakness: { type: 'string' } }, required: ['name'] } }, instagram_accounts: { type: 'array', items: { type: 'object', properties: { handle: { type: 'string' }, why: { type: 'string' }, verified: { type: 'boolean' } }, required: ['handle'] } }, content_angles_seen: arr, hashtags: arr, sources: src }, required: ['competitors'] },
  strategy: { type: 'object', properties: { positioning: { type: 'string' }, pillars: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, why: { type: 'string' }, example_hooks: arr }, required: ['name'] } }, first_ideas: { type: 'array', items: { type: 'object', properties: { hook: { type: 'string' }, payoff: { type: 'string' }, pillar: { type: 'string' } }, required: ['hook', 'payoff'] } }, do_not_say: arr, proof_to_collect: arr, cta_suggestions: arr, cadence: { type: 'string' }, style_mood: { type: 'string' } }, required: ['positioning', 'pillars', 'first_ideas'] },
};
const RULES = 'Rules: use web search/fetch to find real information. Cite a source URL for factual claims. If you cannot verify something, say so in the field or leave it out; never invent statistics, quotes, testimonials, competitors or Instagram handles. Return JSON only.';

const prompts = {
  site: b => `Research the business at ${b.website} (read its homepage, pricing, features, about/FAQ pages with WebFetch).
Product described by the owner: ${b.product}. Audience (owner's words): ${b.audience}. Problem (owner's words): ${b.problem}.
Extract what it really offers, who it is for, pricing if public, differentiators, any proof (numbers, logos, testimonials) FOUND ON THE SITE with the page URL, the tone of voice, and gaps/weak spots in the messaging.\n${RULES}`,
  audience: (b, r) => `Research the target customers of this product: ${b.product} for ${b.audience}. Problem: ${b.problem}. ${r.site ? 'Site summary: ' + r.site.what_it_is : ''}
Search forums, reviews, Reddit-style discussions, industry articles. Return: customer segments, their pains, desires, objections, VERBATIM phrases customers use (customer_language, short), where they spend time online, and buying triggers. Set confidence (low/medium/high) honestly.\n${RULES}`,
  competitors: (b, r) => `Find the main competitors and adjacent solutions for: ${b.product} (niche: ${b.niche || b.audience}). ${(b.competitors || []).length ? 'Owner already follows: ' + b.competitors.join(', ') : ''}
For each (5 max): positioning, public pricing if any, a weakness the owner could contrast with. Also list Instagram accounts that post short-form video in this niche ONLY if you found them in search results (handle + why; set verified=false unless you saw the profile), content angles that appear common, and 8 relevant hashtags.\n${RULES}`,
  strategy: (b, r) => `You are a short-form video strategist. Using ONLY this research and the owner's facts, produce a content strategy for Instagram Reels.
Owner: ${b.product}. Audience: ${b.audience}. Problem: ${b.problem}. Tone: ${b.tone}. Call to action: ${ctaText(b)}. Proof the owner gave: ${(b.proof || []).map(p => p.claim + (p.number ? '=' + p.number : '')).join('; ') || 'none'}.
Research: ${JSON.stringify({ site: r.site, audience: r.audience, competitors: r.competitors }).slice(0, 9000)}
Return: a one-sentence positioning, 4 content pillars (each with why and 3 example hooks of at most 8 words), 10 starter reel ideas (hook + payoff + pillar), a do_not_say list (overclaims, compliance risks, words the audience dislikes), proof the owner should collect to make stronger claims, 3 CTA ideas, a realistic cadence, and the visual mood that fits (one phrase). Never invent numbers; where proof is missing write the hook so it needs none.`,
};

export const STAGES = [['site', 'Reading your website', 'research_site'], ['audience', 'Studying your audience', 'research_audience'], ['competitors', 'Mapping competitors', 'research_competitors'], ['strategy', 'Building your strategy', 'research_strategy']];

export async function runResearch({ force = false, onProgress = () => {}, log = () => {} } = {}) {
  const b = getBrand(); const cur = force ? {} : (getResearch() || {}); const r = { stages: {}, ...cur, started: cur.started || new Date().toISOString() };
  for (const [id, label, task] of STAGES) {
    if (r.stages[id]?.status === 'done') continue;
    if (id === 'site' && !b.website) { r.stages[id] = { status: 'skipped', note: 'no website given' }; writeJson(file(), r); continue; }
    onProgress({ stage: id, label }); log(label);
    try {
      const o = await askClaude({ task, prompt: prompts[id](b, r.data || {}), schema: SCHEMAS[id], system: 'You are a careful market researcher. ' + RULES, force, log });
      r.data = { ...(r.data || {}), [id]: o.output }; r.stages[id] = { status: 'done', model: o.model, cached: o.cached, at: new Date().toISOString() };
    } catch (e) { r.stages[id] = { status: 'failed', error: e.message }; writeJson(file(), r); throw e; }
    writeJson(file(), r);
  }
  r.finished = new Date().toISOString(); writeJson(file(), r);
  applyResearch(r); return r;
}

/** Turn the research into (a) a short digest injected into script prompts, (b) starter ideas, (c) a readable report. */
export function applyResearch(r = getResearch()) {
  if (!r?.data) return;
  const a = r.data.audience || {}, s = r.data.strategy || {};
  const digest = [a.customer_language?.length && `Customers say: ${a.customer_language.slice(0, 6).map(x => '"' + x + '"').join('; ')}`, a.pains?.length && `Top pains: ${a.pains.slice(0, 4).join('; ')}`, a.objections?.length && `Objections: ${a.objections.slice(0, 3).join('; ')}`, s.pillars?.length && `Pillars: ${s.pillars.map(p => p.name).join(', ')}`, s.do_not_say?.length && `DO NOT SAY: ${s.do_not_say.slice(0, 6).join('; ')}`].filter(Boolean).join('\n').slice(0, 1100);
  saveBrand({ researchDigest: digest });
  const ideasFile = path.join(home(), 'ideas.json'); const cur = readJson(ideasFile, { items: [] }); const have = new Set(cur.items.map(i => i.hook.toLowerCase()));
  const add = (s.first_ideas || []).filter(i => i.hook && !have.has(i.hook.toLowerCase())).map(i => ({ id: crypto.randomBytes(3).toString('hex'), hook: i.hook, payoff: i.payoff, borrows: i.pillar || '', status: 'new', source: 'research', created: new Date().toISOString() }));
  writeJson(ideasFile, { items: [...add, ...cur.items].slice(0, 200) });
  fs.writeFileSync(path.join(home(), 'research.md'), report(r));
}

export function report(r) {
  const d = r.data || {}; const L = [`# Research report`, `_Generated ${r.finished || ''}. Items marked unverified were not confirmed in sources._`];
  const list = (t, a) => a?.length ? [`\n**${t}**`, ...a.map(x => '- ' + (typeof x === 'string' ? x : JSON.stringify(x)))] : [];
  if (d.site) L.push('\n## Your business (from your site)', d.site.what_it_is, `Offer: ${d.site.offer}`, d.site.pricing && `Pricing: ${d.site.pricing}`, ...list('Differentiators', d.site.differentiators), ...list('Proof found on site', (d.site.proof_found || []).map(p => `${p.claim} (${p.source_url || 'no url'})`)), ...list('Messaging gaps', d.site.gaps));
  if (d.audience) L.push('\n## Audience', `Confidence: ${d.audience.confidence || 'n/a'}`, ...list('Segments', d.audience.segments), ...list('Pains', d.audience.pains), ...list('Desires', d.audience.desires), ...list('Objections', d.audience.objections), ...list('Their words', d.audience.customer_language), ...list('Where they hang out', d.audience.where_they_hang_out), ...list('Buying triggers', d.audience.buying_triggers));
  if (d.competitors) L.push('\n## Competitors', ...(d.competitors.competitors || []).map(c => `- **${c.name}** ${c.url || ''}: ${c.positioning || ''} Weakness: ${c.weakness || 'n/a'}`), ...list('Instagram accounts (check manually)', (d.competitors.instagram_accounts || []).map(x => `@${x.handle.replace('@', '')} ${x.verified ? '(verified)' : '(unverified)'}: ${x.why || ''}`)), ...list('Angles seen', d.competitors.content_angles_seen), ...list('Hashtags', d.competitors.hashtags));
  if (d.strategy) L.push('\n## Strategy', d.strategy.positioning, ...(d.strategy.pillars || []).flatMap(p => [`\n### ${p.name}`, p.why, ...(p.example_hooks || []).map(h => '- ' + h)]), '\n### Starter ideas', ...(d.strategy.first_ideas || []).map((i, k) => `${k + 1}. ${i.hook}: ${i.payoff}`), ...list('Do not say', d.strategy.do_not_say), ...list('Proof to collect', d.strategy.proof_to_collect), ...list('CTA ideas', d.strategy.cta_suggestions), d.strategy.cadence && `\nCadence: ${d.strategy.cadence}`);
  const sources = [...(d.site?.sources || []), ...(d.audience?.sources || []), ...(d.competitors?.sources || [])]; if (sources.length) L.push('\n## Sources', ...sources.map(s => `- ${s.url} ${s.note || ''}`));
  return L.filter(Boolean).join('\n');
}

const AUTOFILL = { type: 'object', properties: { product: { type: 'string' }, audience: { type: 'string' }, problem: { type: 'string' }, tone: { type: 'string' }, niche: { type: 'string' }, cta_ideas: arr, proof_found: { type: 'array', items: { type: 'object', properties: { claim: { type: 'string' }, number: { type: 'string' }, source_url: { type: 'string' } }, required: ['claim'] } } }, required: ['product', 'audience', 'problem'] };
/** Onboarding shortcut: read the user's website and propose brand fields. Proof is only what the site itself states. */
export async function autofillBrand(url, { log = () => {} } = {}) {
  if (!/^https?:\/\//i.test(url)) throw new Error('Enter a full website address starting with https://');
  const r = await askClaude({ task: 'brand_autofill', prompt: `Read ${url} (homepage, plus pricing/about if linked) with WebFetch. Propose, in plain words an owner would use: product (one line), audience (who it is for), problem (the real problem it solves, from the customer's side), tone (2-4 adjectives matching the site), niche (2-3 words), 3 short CTA keyword ideas (one word, upper case), and proof_found: ONLY numbers or claims the site itself states (with the page URL). ${RULES}`, system: 'You are a careful brand analyst. ' + RULES, schema: AUTOFILL, log });
  return r.output;
}
