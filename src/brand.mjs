import path from 'node:path';
import { home, readJson, writeJson } from './util.mjs';

const file = () => path.join(home(), 'brand.json');
export const DEFAULT_BRAND = {
  product: '', website: '', researchDigest: '', audience: '', problem: '', tone: 'direct, specific, no hype', cta: 'GUIDE', ctaType: 'bio', ctaOffer: '', niche: '', languages: ['en'],
  proof: [],            // [{claim, number}]  real numbers only
  competitors: [],      // instagram handles to watch
  production: { style: 'auto', avatar: 'founder', voice: 'auto', voiceId: '', sfx: true, lang: 'en', music: '', brandColors: null },
  posting: { method: 'computer', mode: 'review', account: '', username: '', times: ['08:00'], trial: true },
  daily: { enabled: true, time: '09:00', autopilot: false, graceMinutes: 90, minReferences: 3, requireReferences: false },
  chat: { enabled: false, businessName: '', tagline: '', welcome: '', faq: [], leadMagnet: { label: '', text: '', url: '' }, consent: 'I agree that my details are sent to the business owner and that an AI assistant (Anthropic Claude) processes this chat to reply.', tunnel: true, port: 4178, maxMessages: 30, accent: '' },
  notify: true,
};
export const getBrand = () => { const b = readJson(file(), {}); return { ...DEFAULT_BRAND, ...b, chat: { ...DEFAULT_BRAND.chat, ...(b.chat || {}), leadMagnet: { ...DEFAULT_BRAND.chat.leadMagnet, ...((b.chat || {}).leadMagnet || {}) } }, production: { ...DEFAULT_BRAND.production, ...(b.production || {}) }, posting: { ...DEFAULT_BRAND.posting, ...(b.posting || {}) }, daily: { ...DEFAULT_BRAND.daily, ...(b.daily || {}) } }; };
export const saveBrand = patch => { const cur = getBrand(); const b = { ...cur, ...patch, chat: { ...cur.chat, ...(patch.chat || {}) }, production: { ...cur.production, ...(patch.production || {}) }, posting: { ...cur.posting, ...(patch.posting || {}) }, daily: { ...cur.daily, ...(patch.daily || {}) } }; writeJson(file(), b); return b; };
export const CTA_TYPES = { bio: 'Link in bio', comment: 'Comment a word', dm: 'DM me a word', follow: 'Follow for more', save: 'Save this' };
/** The one action the reel asks for, in plain words. */
export function ctaText(b = getBrand()) {
  const offer = String(b.ctaOffer || '').trim(); const kw = String(b.cta || '').trim() || 'GUIDE';
  switch (b.ctaType || 'bio') {
    case 'comment': return `comment ${kw}${offer ? ' to get ' + offer : ''}`;
    case 'dm': return `send me a DM with the word ${kw}${offer ? ' to get ' + offer : ''}`;
    case 'follow': return 'follow for more';
    case 'save': return 'save this for later';
    default: return `tap the link in bio${offer ? ' for ' + offer : ''}`;
  }
}
export const missingBrand = (b = getBrand()) => ['product', 'audience', 'problem', ...(['comment', 'dm'].includes(b.ctaType) ? ['cta'] : [])].filter(k => !String(b[k] || '').trim());
export function brandFacts(b = getBrand()) {
  return [`Product: ${b.product}`, `Audience: ${b.audience}`, `Their real problem: ${b.problem}`, `Tone: ${b.tone}`, `Call to action (the ONE thing the last line asks for): ${ctaText(b)}`, b.niche && `Niche: ${b.niche}`,
    `Proof points (the ONLY numbers you may use): ${b.proof.length ? b.proof.map(p => `${p.claim}${p.number ? ' = ' + p.number : ''}`).join('; ') : '(none given: make no numeric claims)'}`].filter(Boolean).join('\n');
}
