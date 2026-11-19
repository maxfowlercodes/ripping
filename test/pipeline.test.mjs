import test from 'node:test';
import assert from 'node:assert/strict';
import { splitDirective, extractKeys, parseVisual } from '../src/directives.mjs';
import { parseScript } from '../src/script.mjs';
import { keepSegments } from '../src/footage.mjs';
import { rankFor, viewsAtDay } from '../src/analytics.mjs';
import { tokenize } from '../src/render2.mjs';
import { carouselSlides } from '../src/repurpose.mjs';

test('directive parsing', () => {
  assert.deepEqual(splitDirective('We grew. {counter: 9,851 | users | +64%}'), { text: 'We grew.', visual: { type: 'counter', value: 9851, label: 'users', delta: '+64%', app: undefined } });
  assert.equal(splitDirective('No visual here').visual, null);
  assert.equal(splitDirective('Odd {weird: x}').visual, null);
  const b = parseVisual('bars', 'A=10>40, B=5 | T | %'); assert.deepEqual(b.items, [{ name: 'A', from: 10, to: 40 }, { name: 'B', from: 0, to: 5 }]);
  assert.deepEqual(parseVisual('tier', 'S=A,B; A=C').rows, [{ tier: 'S', items: ['A', 'B'] }, { tier: 'A', items: ['C'] }]);
  assert.deepEqual(parseVisual('chart', '1,3,8').points, [1, 3, 8]);
});
test('key words', () => { const k = extractKeys('Stop *posting* reels'); assert.equal(k.text, 'Stop posting reels'); assert.ok(k.keys.has(1)); });
test('script keeps visuals and keys aligned with beats', () => {
  const s = parseScript('# T\nHello *world*.\nNumbers {big: 3x}\nBye'); assert.equal(s.beats.length, 3); assert.equal(s.visuals[1].type, 'big'); assert.ok(s.keys[0].has(1));
});
test('keepSegments cuts silences', () => {
  const k = keepSegments(10, [[2, 3], [6, 7]], 0.05, 0.2); assert.equal(k.length, 3); assert.ok(k[0][1] <= 2.1 && k[1][0] >= 2.9);
});
test('ranks', () => { assert.equal(rankFor(0).name, 'Rookie'); assert.equal(rankFor(32000).name, 'Regular'); assert.equal(rankFor(2e8).name, 'Icon'); });
test('views at day uses closest snapshot at or before', () => {
  const p = new Date(Date.now() - 8 * 864e5).toISOString(); const t = d => new Date(new Date(p).getTime() + d * 864e5).toISOString();
  const m = { postedAt: p, snapshots: [{ t: t(0.05), views: 10 }, { t: t(1), views: 100 }, { t: t(3), views: 300 }, { t: t(7), views: 500 }] };
  assert.equal(viewsAtDay(m, 1), 100); assert.equal(viewsAtDay(m, 7), 500);
});
test('CJK tokenizer', () => assert.ok(tokenize('今日は晴れです', 'ja').length > 1));
test('carousel slides', () => { const s = carouselSlides({ beats: ['h', 'a', 'b', 'c', 'd', 'cta'] }); assert.equal(s[0].kind, 'cover'); assert.equal(s.at(-1).kind, 'cta'); assert.ok(s.length <= 8); });
