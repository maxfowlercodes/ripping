// Style chooser: code ranks the catalog by niche / mood / energy fit and recent variety; Claude then picks from a short list
// inside the script call (no extra model call). Custom styles without tags are never auto-picked.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listReels } from './store.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const loadCatalog = () => { try { return JSON.parse(fs.readFileSync(path.join(root, 'styles', 'catalog.json'), 'utf8')); } catch { return {}; } };

const NICHE_WORDS = {
  saas: ['saas', 'software', 'app', 'startup', 'platform', 'subscription', 'founder', 'b2b'], 'dev-tools': ['developer', 'dev', 'api', 'code', 'engineer', 'cli', 'github', 'devops'], fintech: ['finance', 'fintech', 'bank', 'payment', 'invoice', 'accounting', 'money', 'invest'],
  ecommerce: ['shop', 'store', 'ecommerce', 'product', 'brand', 'dtc', 'retail'], coaching: ['coach', 'coaching', 'mentor', 'consult', 'course', 'program'], health: ['health', 'wellness', 'therapy', 'mental', 'nutrition', 'clinic', 'care'],
  education: ['teach', 'learn', 'education', 'school', 'student', 'tutor', 'course'], creator: ['creator', 'influencer', 'content', 'youtube', 'podcast'], b2b: ['b2b', 'enterprise', 'sales', 'team', 'operations'],
  'local-business': ['local', 'restaurant', 'salon', 'shop', 'gym', 'cafe', 'plumber', 'dentist'], 'real-estate': ['real estate', 'property', 'realtor', 'mortgage', 'agent'], legal: ['law', 'legal', 'attorney', 'compliance'],
  kids: ['kids', 'children', 'parents', 'toy', 'school'], food: ['food', 'recipe', 'restaurant', 'bakery', 'meal'], fitness: ['fitness', 'gym', 'workout', 'training', 'sport'], gaming: ['game', 'gaming', 'esports', 'twitch'],
  agency: ['agency', 'studio', 'design', 'marketing agency'], luxury: ['luxury', 'premium', 'high-end', 'bespoke'], ai: ['ai', 'llm', 'machine learning', 'gpt', 'claude'], security: ['security', 'cyber', 'privacy', 'encryption'], nonprofit: ['nonprofit', 'charity', 'foundation'], events: ['event', 'wedding', 'party', 'conference'],
};
const MOOD_WORDS = { serious: ['direct', 'serious', 'professional', 'authoritative', 'no hype', 'specific'], bold: ['bold', 'loud', 'punchy', 'aggressive', 'confident'], friendly: ['friendly', 'warm', 'approachable', 'helpful', 'conversational'], playful: ['playful', 'fun', 'witty', 'humor', 'quirky'], calm: ['calm', 'gentle', 'soothing', 'relaxed', 'mindful'], techy: ['technical', 'nerdy', 'geeky', 'developer'], luxury: ['luxury', 'premium', 'elegant', 'refined'], energetic: ['energetic', 'high-energy', 'fast-paced', 'high energy'], minimal: ['minimal', 'clean', 'simple'] };

const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };

export function rankStyles({ brand, script, recent, avatar, day = new Date().toISOString().slice(0, 10) }) {
  const cat = loadCatalog(); const text = [brand.product, brand.audience, brand.niche, brand.problem, brand.tone].join(' ').toLowerCase();
  const niches = Object.entries(NICHE_WORDS).filter(([, ws]) => ws.some(w => new RegExp('\\b' + w.replace(/[-/]/g, '[- ]') + '\\b').test(text))).map(([k]) => k);
  const moods = Object.entries(MOOD_WORDS).filter(([, ws]) => ws.some(w => text.includes(w))).map(([k]) => k);
  let target = moods.includes('energetic') || moods.includes('bold') ? 4 : moods.includes('calm') || moods.includes('luxury') || moods.includes('minimal') ? 2 : 3;
  if (script?.beats?.length) { const avg = script.beats.reduce((a, b) => a + b.split(/\s+/).length, 0) / script.beats.length; if (avg < 6) target = Math.min(5, target + 1); if (avg > 10) target = Math.max(1, target - 1); }
  const last = recent ?? listReels().sort((a, b) => (b.created || '').localeCompare(a.created || '')).map(r => r.style).filter(Boolean);
  const useAvatar = avatar ?? (brand.production?.avatar && brand.production.avatar !== 'none');
  return Object.values(cat).filter(s => s.tags).map(s => {
    const why = []; let score = 0;
    const nm = s.tags.niches.filter(n => niches.includes(n)); if (nm.length) { score += 3 * nm.length; why.push('fits ' + nm.join('/')); }
    const mm = s.tags.mood.filter(m => moods.includes(m)); if (mm.length) { score += 2 * mm.length; why.push(mm.join('/') + ' tone'); }
    const de = Math.abs(s.tags.energy - target); score -= de * 0.8; if (de <= 1) why.push('energy ' + s.tags.energy);
    const li = last.indexOf(s.name); if (li === 0) { score -= 4; why.push('used last'); } else if (li > 0 && li < 5) { score -= 2; why.push('used recently'); }
    if (s.presenter && !useAvatar) score -= 10;
    score += hash(s.name + day) * 0.6; // small daily shuffle so ties rotate
    return { name: s.name, desc: s.desc, score: +score.toFixed(1), why: why.join(', ') || 'neutral' };
  }).sort((a, b) => b.score - a.score);
}
export const validStyle = name => !!loadCatalog()[name];
