// Prompt + schema builders. Prompts are short on purpose: every token is the user's usage.
import { brandFacts, ctaText } from './brand.mjs';

import { pexelsAvailable } from './pexels.mjs';
const photoHint = () => (pexelsAvailable() ? 'Photos are rare and optional. Most scripts need none: use NO photo unless one line names a concrete, visible real-world thing (for example a handshake, a recruiter at a desk, a laptop) and the photo would match that line almost exactly. If so, end that single beat with {photo: 2 to 3 plain English words that literally describe the picture}. Never more than one in the whole script, never on the hook or the last line, never for abstract ideas, numbers or advice.\n' : '');
export const rulesFor = b => `Script format: one line per beat. Beat 1 is the hook: at most 8 words, speaks to "you" or names a number/outcome. Last beat: ONE action: ${ctaText(b)}. Every line at most 14 words, one idea. 6-12 beats, 20-40 seconds spoken. Mark 1 key word per line with *asterisks* (not on every line). Add a visual directive at the END of roughly every second line, vary them: {counter: N | label | delta} {bars: A=from>to, B=to | title | unit} {chart: up|down|s|flat} {tier: S=A,B; A=C} {code: text} {list: a; b; c} {big: text} {stats: 12k users; 4.9 rating} {compare: Before: 2% text | After: 11% text} {timeline: Day 1: x; Day 7: y} {chat: them: q; me: a} {notify: App: text} {donut: 72 | label} {price: $49 | /mo | $99 | badge}. No filler words. Never invent numbers, testimonials or results: use only the proof points given; if none fit, use no numbers.`;
export const RULES = rulesFor({ ctaType: 'bio' });

export const schemas = {
  ideas: { type: 'object', properties: { ideas: { type: 'array', items: { type: 'object', properties: { hook: { type: 'string' }, payoff: { type: 'string' }, borrows: { type: 'string' } }, required: ['hook', 'payoff'] } } }, required: ['ideas'] },
  script: { type: 'object', properties: { title: { type: 'string' }, style: { type: 'string' }, lines: { type: 'array', items: { type: 'string' } } }, required: ['title', 'lines'] },
  caption: { type: 'object', properties: { caption: { type: 'string' }, hashtags: { type: 'array', items: { type: 'string' } }, youtube: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['title', 'description'] } }, required: ['caption', 'hashtags', 'youtube'] },
  hooks: { type: 'object', properties: { hooks: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, formula: { type: 'string' } }, required: ['text'] } } }, required: ['hooks'] },
  refAnalysis: { type: 'object', properties: { formula: { type: 'string' }, structure: { type: 'string' }, payoff: { type: 'string' }, cta: { type: 'string' }, whyItWorked: { type: 'string' } }, required: ['formula', 'whyItWorked'] },
  summary: { type: 'object', properties: { headline: { type: 'string' }, wins: { type: 'array', items: { type: 'string' } }, issues: { type: 'array', items: { type: 'string' } }, nextActions: { type: 'array', items: { type: 'string' } } }, required: ['headline', 'nextActions'] },
};

export const SYSTEM = 'You write for short-form video. Reply with the requested JSON only. Be specific and concrete, no hype words.';

export const ideasPrompt = ({ brand, refs, recent, n = 5 }) => `${brandFacts(brand)}

Saved reference reels that outperformed their accounts (reuse the STRUCTURE, never the wording):
${refs.slice(0, 12).map((r, i) => `${i + 1}. [${r.multiplier || '?'}x] "${r.caption.slice(0, 140)}"${r.analysis ? ' | formula: ' + r.analysis.formula : ''}${r.note ? ' | note: ' + r.note : ''}`).join('\n') || '(none yet: rely on proven hook formulas)'}

Recent posts (do not repeat): ${recent.slice(0, 8).join(' | ') || 'none'}

Give ${n} reel ideas for this product. Each: hook (<=8 words), payoff (one line the viewer gets), borrows (which reference's structure, or a formula name).`;

export const scriptPrompt = ({ brand, idea, refs, lang = 'en', styles }) => `${brandFacts(brand)}${brand.researchDigest ? '\n\nResearch digest (use the customers\' own words, avoid the do-not-say list):\n' + brand.researchDigest : ''}

Write ONE reel script.
Idea hook: ${idea.hook}
Payoff: ${idea.payoff}
${idea.borrows ? 'Structure inspiration: ' + idea.borrows : ''}
${refs.slice(0, 3).map(r => `Reference: "${r.caption.slice(0, 120)}"`).join('\n')}
Language: ${lang}.
${rulesFor(brand)}
${photoHint()}${styles?.length ? `Also choose the visual style that best fits this script's mood from this list and return its exact name in "style":\n${styles.map(x => `- ${x.name}: ${x.desc}`).join('\n')}\n` : ''}Return {title${styles?.length ? ', style' : ''}, lines[]} where each line is one beat INCLUDING its directive and *key* marks.`;

export const lintFixPrompt = ({ lines, issues }) => `Fix ONLY these problems in the script below, changing as little as possible. Keep every directive and *key* mark. Return {title, lines[]}.
Problems:\n${issues.map(i => '- ' + i).join('\n')}
Script:\n${lines.join('\n')}`;

export const captionPrompt = ({ brand, lines }) => `Write the posting text for this short video.\n1. Instagram: caption (max 22 words, first line restates the hook, ends with the call to action: ${ctaText(brand)}) and exactly 3 relevant hashtags.\n2. YouTube Shorts: title (max 70 characters, curiosity or outcome, no clickbait lies, no hashtags in it), description (2 to 4 short lines: what the viewer learns, then the call to action adapted for YouTube, e.g. follow or watch the next one; link line only if the brand has a website), and 3 to 5 tags.\nNever invent numbers, results or claims. Product: ${brand.product}.${brand.website ? ' Website: ' + brand.website + '.' : ''} Script:\n${lines.join('\n')}`;
export const hooksPrompt = ({ brand, lines, n = 5 }) => `${n} NEW hooks (<=8 words, each a different formula) for the same payoff as this winning reel. Product: ${brand.product}. Winner:\n${lines.join('\n')}`;
export const refPrompt = r => `Analyze this reel that got ${r.views} views (${r.multiplier}x its account's normal). Caption: "${r.caption.slice(0, 400)}". Give: hook formula name, beat structure, payoff, CTA type, why it worked (one sentence).`;
export const summaryPrompt = ({ rows, med }) => `Account stats (median views ${med}). Per reel: ${rows.map(r => `"${r.title}" ${r.views}v ${r.saves}s ${r.shares}sh D1:${r.d1} D7:${r.d7}`).join(' | ')}. Give a one-line headline, wins, issues, and max 3 next actions. Say "too early" if under 5 posts.`;
