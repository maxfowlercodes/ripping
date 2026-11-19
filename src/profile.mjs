// Profile plan: Instagram name, bio, link, profile-picture brief, highlights and pinned posts, from your brand + research.
// Suggestions only. Reelkit never edits your profile (Claude's browser rules forbid it): you copy each one in.
import path from 'node:path';
import { home, readJson, writeJson } from './util.mjs';
import { askClaude } from './claude.mjs';
import { getBrand, brandFacts } from './brand.mjs';
import { getResearch } from './research.mjs';

const file = () => path.join(home(), 'profile-plan.json');
export const getProfilePlan = () => readJson(file(), null);
const list = { type: 'array', items: { type: 'string' } };
const schema = { type: 'object', properties: {
  nameField: { type: 'object', properties: { value: { type: 'string' }, why: { type: 'string' } }, required: ['value'] },
  bios: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, angle: { type: 'string' } }, required: ['text'] } },
  link: { type: 'object', properties: { suggestion: { type: 'string' }, why: { type: 'string' } } },
  picture: { type: 'object', properties: { brief: { type: 'string' }, why: { type: 'string' }, keepFace: { type: 'boolean' } }, required: ['brief'] },
  highlights: list, pinned: list, oldContent: { type: 'string' }, checklist: list },
  required: ['bios', 'picture'] };

export async function planProfile({ currentBio = '', currentName = '', oldContent = '', log } = {}) {
  const b = getBrand(); const rs = getResearch(); const digest = b.researchDigest ? `\nResearch digest:\n${b.researchDigest.slice(0, 2500)}` : '';
  const prompt = `${brandFacts(b)}${digest}
Their Instagram profile today: name field "${currentName || 'unknown'}", bio "${currentBio || 'unknown'}". What the account posted before: ${oldContent || 'not stated'}.
Design the profile so a stranger who lands from a reel understands in 3 seconds who it is for, what they get, and what to do next. Give:
- nameField: the searchable name line (keyword + role, max 30 chars).
- bios: 3 options, each max 150 characters, 4 short lines max, with a different angle each (outcome, proof, audience). The last line is one action matching this CTA: ${b.ctaType || 'bio'}${b.ctaOffer ? ' for ' + b.ctaOffer : ''}. No emoji spam, no hype words, no made-up numbers or claims.
- link: what the single bio link should point to and why.
- picture: a clear brief for the profile picture (keep it recognisable at 40px; say whether to keep a face photo or use a logo mark) and why.
- highlights: 4 highlight titles worth having (max 12 chars each).
- pinned: 3 kinds of posts to pin first.
- oldContent: ONE plain paragraph on what to do with the earlier posts (archive vs keep vs pin). Never advise deleting posts that have reach.
- checklist: 5 short ordered steps to apply all of this in the app.
Reply as JSON only.`;
  const r = await askClaude({ task: 'profile_plan', prompt, system: 'You are an Instagram profile strategist. Reply with the requested JSON only. Be concrete; never invent facts about the business.', schema, log, force: true });
  const plan = { at: new Date().toISOString(), inputs: { currentBio, currentName, oldContent }, ...r.output, model: r.model }; writeJson(file(), plan); return plan;
}
