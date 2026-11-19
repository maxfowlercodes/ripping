import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScript, lint, virality } from '../src/script.mjs';
import { wrap } from '../src/render.mjs';

const good = `# T
Stop posting reels nobody watches.
Most founders open with hey guys.
That costs you 60% of viewers fast.
Open with the result instead.
Show the number then the how.
One idea per line.
Comment "REEL" for the template.`;
test('parse title/beats/style', () => {
  const s = parseScript('# A\n[style: sunset]\n// note\nOne\nTwo');
  assert.deepEqual(s, { title: 'A', style: 'sunset', beats: ['One', 'Two'] });
});
test('good script scores high', () => assert.ok(lint(parseScript(good)).score >= 85));
test('bad hook and no CTA are flagged', () => {
  const r = lint(parseScript('hey guys so today I want to talk about a really long introduction to my topic\nok\nbye'));
  assert.ok(r.checks.find(c => c.id === 'hook-length').pass === false);
  assert.ok(r.checks.find(c => c.id === 'cta').pass === false);
});
test('virality returns monotone curve', () => {
  const v = virality(parseScript(good));
  for (let i = 1; i < v.curve.length; i++) assert.ok(v.curve[i].pct <= v.curve[i - 1].pct);
});
test('wrap', () => assert.equal(wrap('aaa bbb ccc', 7), 'aaa bbb\nccc'));
