import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.REELKIT_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'rk-test-'));
process.env.REELKIT_CLAUDE_DRYRUN = '1';
const { modelFor, saveSettings, getSettings, buildArgs, askClaude, TASKS, CODE_ONLY, usageToday } = await import('../src/claude.mjs');
const { parseVisual } = await import('../src/directives.mjs');
const { getBrand, saveBrand, missingBrand, brandFacts } = await import('../src/brand.mjs');
const { addInbox, listInbox, resolveItem } = await import('../src/inbox.mjs');
const { startRun, executeRun, answerGate } = await import('../src/autopilot.mjs');
const { alignTokens } = await import('../src/transcribe.mjs');
const { addFromText, listSwipe } = await import('../src/swipe.mjs');
const { chunkWords } = await import('../src/footagecap.mjs');

test('routing: eco uses the small model for small tasks, quality upgrades writing', () => {
  saveSettings({ mode: 'eco' }); assert.equal(modelFor('caption_hashtags'), 'haiku'); assert.equal(modelFor('lint_fix'), 'haiku'); assert.equal(modelFor('computer_post'), 'haiku');
  saveSettings({ mode: 'quality' }); assert.equal(modelFor('script_write'), 'opus');
  saveSettings({ mode: 'balanced', routing: { script_write: 'haiku' } }); assert.equal(modelFor('script_write'), 'haiku'); assert.equal(modelFor('ideas'), 'sonnet');
  saveSettings({ routing: {} });
});
test('no task defaults to opus except in quality mode (usage protection)', () => {
  for (const mode of ['eco', 'balanced']) for (const t of Object.keys(TASKS)) assert.notEqual(TASKS[t][mode], 'opus', `${t} in ${mode}`);
  assert.ok(CODE_ONLY.includes('lint') && CODE_ONLY.includes('render'));
});
test('text tasks run with no tools, no skills, no MCP', () => {
  const a = buildArgs({ task: 'caption_hashtags', prompt: 'x', model: 'haiku', schema: { type: 'object' } });
  assert.deepEqual(a.slice(a.indexOf('--tools'), a.indexOf('--tools') + 2), ['--tools', '']); assert.ok(a.includes('--disable-slash-commands') && a.includes('--strict-mcp-config') && a.includes('--no-session-persistence') && a.includes('--json-schema'));
  assert.ok(!a.includes('--mcp-config'));
});
test('computer tasks: strict MCP, only the playwright server allowed, no built-in tools', () => {
  const a = buildArgs({ task: 'computer_post', prompt: 'x', model: 'haiku', mcpConfig: { mcpServers: { playwright: {} } }, allowedTools: ['mcp__playwright'] });
  assert.ok(a.includes('--mcp-config') && a.includes('--strict-mcp-config')); assert.equal(a[a.indexOf('--allowedTools') + 1], 'mcp__playwright'); assert.equal(a[a.indexOf('--tools') + 1], ''); assert.equal(a[a.indexOf('--permission-mode') + 1], 'dontAsk'); assert.equal(a[a.indexOf('--max-turns') + 1], '40');
});
test('dry run returns argv without calling Claude or spending usage', async () => {
  saveSettings({ mode: 'eco' }); const r = await askClaude({ task: 'ideas', prompt: 'p', schema: { type: 'object' } }); assert.equal(r.output.dryRun, true); assert.equal(r.model, 'haiku'); assert.equal(usageToday().calls, 0);
});
test('budget stops runaway usage', async () => {
  fs.appendFileSync(path.join(process.env.REELKIT_HOME, 'usage.jsonl'), JSON.stringify({ t: new Date().toISOString(), task: 'x', model: 'haiku', output: 10 }) + '\n');
  saveSettings({ budget: { dailyCalls: 1, dailyOutputTokens: 1000 } }); await assert.rejects(() => askClaude({ task: 'ideas', prompt: 'q' }), /budget/); saveSettings({ budget: { dailyCalls: 60, dailyOutputTokens: 120000 } });
});
test('new directives parse', () => {
  assert.deepEqual(parseVisual('chat', 'them: Free trial?; me: No, paid pilot.').msgs, [{ who: 'them', text: 'Free trial?' }, { who: 'me', text: 'No, paid pilot.' }]);
  assert.deepEqual(parseVisual('stats', '12k users; 4.9 rating').items, [{ value: '12k', label: 'users' }, { value: '4.9', label: 'rating' }]);
  assert.equal(parseVisual('compare', 'Before: 2% conv | After: 11% conv').right.big, '11%'); assert.equal(parseVisual('timeline', 'Day 1: Launch; Day 7: 100 users').items.length, 2);
  assert.deepEqual(parseVisual('price', '$49 | /mo | $99 | Pilot'), { type: 'price', price: '$49', per: '/mo', was: '$99', badge: 'Pilot' });
});
test('brand: only given facts reach prompts', () => {
  assert.deepEqual(missingBrand(), ['product', 'audience', 'problem']); // cta has a default
  saveBrand({ product: 'PriceLoop', audience: 'founders', problem: 'tire-kickers', proof: [{ claim: 'teams switched', number: '212' }] }); assert.deepEqual(missingBrand(), []);
  assert.match(brandFacts(), /212/); saveBrand({ proof: [] }); assert.match(brandFacts(), /make no numeric claims/);
});
test('inbox: dedupe and resolve', () => {
  const a = addInbox({ type: 'checkin', title: 'T', dedupeKey: 'k1', notify: false }), b = addInbox({ type: 'checkin', title: 'T', dedupeKey: 'k1', notify: false }); assert.equal(a.id, b.id);
  resolveItem(a.id, { ok: 1 }); assert.equal(listInbox('open').some(i => i.id === a.id), false);
});
test('autopilot pauses at the brand gate and the references gate (no model calls made)', async () => {
  saveBrand({ product: '', audience: '', problem: '' }); let r = startRun({ post: 'none' }); r = await executeRun(r.id);
  assert.equal(r.status, 'waiting'); assert.equal(r.gate.type, 'brand');
  saveBrand({ product: 'PriceLoop', audience: 'founders', problem: 'tire-kickers' }); answerGate(r.id, { ok: true }); r = await executeRun(r.id);
  assert.equal(r.status, 'waiting'); assert.equal(r.gate.type, 'refs'); assert.equal(usageToday().calls, 1); // only the seeded ledger row above: no model was called
  answerGate(r.id, { text: 'https://www.instagram.com/a/reel/x/ | 2.4M | 170K | Free trials are killing your SaaS\nhttps://www.instagram.com/c/reel/y/ | 1M | 90K | second\nhttps://www.instagram.com/d/reel/z/ | 500K | 40K | third' }); r = await executeRun(r.id); // later steps hit the dry-run stub and may fail; irrelevant here
  assert.equal(r.steps.find(x => x.id === 'refs').status, 'done'); assert.equal(listSwipe({ status: 'saved' }).length, 3);
});
test('paste intake parses views and baselines', () => {
  const s = listSwipe({ status: 'saved' }).find(x => x.creator === 'a'); assert.equal(s.views, 2400000); assert.equal(s.multiplier, +(2400000 / 170000).toFixed(1)); assert.equal(s.creator, 'a');
  assert.equal(addFromText('https://instagram.com/b/reel/y/ | 800K | 60K | hook two'), 1);
});
test('caption alignment maps script tokens to recognized words', () => {
  const rec = [{ t: 'Stop', s: 0, e: .3 }, { t: 'posting', s: .3, e: .7 }, { t: 'reels', s: .7, e: 1 }, { t: 'nobody', s: 1.1, e: 1.5 }];
  const al = alignTokens(['Stop', 'posting', 'reels,', 'nobody', 'watches.'], rec); assert.equal(al.length, 5); assert.equal(al[2].s, .7); assert.ok(al[4].s >= 1.5); assert.equal(alignTokens(['totally', 'different', 'words', 'here'], rec), null);
});
test('footage caption chunks break on punctuation and pauses', () => {
  const w = [{ t: 'So', s: 0, e: .2 }, { t: 'hello.', s: .2, e: .5 }, { t: 'Next', s: .6, e: .9 }, { t: 'one', s: 2, e: 2.3 }];
  const c = chunkWords(w); assert.equal(c.length, 3); assert.equal(c[0].text, 'So hello.');
});
