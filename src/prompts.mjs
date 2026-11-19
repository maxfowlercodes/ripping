// Prompt + schema builders. Prompts are short on purpose: every token is the user's usage.
import { brandFacts } from './brand.mjs';

export const RULES = `Script format: one line per beat. Beat 1 is the hook: at most 8 words, speaks to "you" or names a number/outcome. Last beat: ONE action (comment the CTA keyword). Every line at most 14 words, one idea. 6-12 beats, 20-40 seconds spoken. Mark 1 key word per line with *asterisks* (not on every line). Add a visual directive at the END of roughly every second line, vary them: {counter: N | label | delta} {bars: A=from>to, B=to | title | unit} {chart: up|down|s|flat} {tier: S=A,B; A=C} {code: text} {list: a; b; c} {big: text} {stats: 12k users; 4.9 rating} {compare: Before: 2% text | After: 11% text} {timeline: Day 1: x; Day 7: y} {chat: them: q; me: a} {notify: App: text} {donut: 72 | label} {price: $49 | /mo | $99 | badge}. No filler words. Never invent numbers, testimonials or results: use only the proof points given; if none fit, use no numbers.`;

export const schemas = {
  ideas: { type: 'object', properties: { ideas: { type: 'array', items: { type: 'object', properties: { hook: { type: 'string' }, payoff: { type: 'string' }, borrows: { type: 'string' } }, required: ['hook', 'payoff'] } } }, required: ['ideas'] },
  script: { type: 'object', properties: { title: { type: 'string' }, lines: { type: 'array', items: { type: 'string' } } }, required: ['title', 'lines'] },
  caption: { type: 'object', properties: { caption: { type: 'string' }, hashtags: { type: 'array', items: { type: 'string' } } }, required: ['caption', 'hashtags'] },
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

export const scriptPrompt = ({ brand, idea, refs, lang = 'en' }) => `${brandFacts(brand)}

Write ONE reel script.
Idea hook: ${idea.hook}
Payoff: ${idea.payoff}
${idea.borrows ? 'Structure inspiration: ' + idea.borrows : ''}
${refs.slice(0, 3).map(r => `Reference: "${r.caption.slice(0, 120)}"`).join('\n')}
Language: ${lang}.
${RULES}
Return {title, lines[]} where each line is one beat INCLUDING its directive and *key* marks.`;

export const lintFixPrompt = ({ lines, issues }) => `Fix ONLY these problems in the script below, changing as little as possible. Keep every directive and *key* mark. Return {title, lines[]}.
Problems:\n${issues.map(i => '- ' + i).join('\n')}
Script:\n${lines.join('\n')}`;

export const captionPrompt = ({ brand, lines }) => `Instagram caption for this reel (max 22 words, first line restates the hook, mention the CTA "comment ${brand.cta}"), plus 3 relevant hashtags. Product: ${brand.product}. Script:\n${lines.join('\n')}`;
export const hooksPrompt = ({ brand, lines, n = 5 }) => `${n} NEW hooks (<=8 words, each a different formula) for the same payoff as this winning reel. Product: ${brand.product}. Winner:\n${lines.join('\n')}`;
export const refPrompt = r => `Analyze this reel that got ${r.views} views (${r.multiplier}x its account's normal). Caption: "${r.caption.slice(0, 400)}". Give: hook formula name, beat structure, payoff, CTA type, why it worked (one sentence).`;
export const summaryPrompt = ({ rows, med }) => `Account stats (median views ${med}). Per reel: ${rows.map(r => `"${r.title}" ${r.views}v ${r.saves}s ${r.shares}sh D1:${r.d1} D7:${r.d7}`).join(' | ')}. Give a one-line headline, wins, issues, and max 3 next actions. Say "too early" if under 5 posts.`;
