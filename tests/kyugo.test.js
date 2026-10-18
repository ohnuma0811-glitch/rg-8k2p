import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, markS, locate, span, between } from '../src/game/track.js';
import { COURSE4, COURSES } from '../src/data/tracks.js';

const t = buildTrack(COURSE4);
const L = t.length;
const at = (ref) => t.samples[Math.round(markS(t, typeof ref === 'string' ? [ref, ref, 0] : ref)) % L];

test('Kyugo Mountain は4つ目のコース。大会は4レース（2026-10-18 のユーザー依頼）', () => {
  assert.equal(COURSES.length, 4);
  assert.equal(COURSES[3], COURSE4);
  assert.equal(COURSE4.name, 'Kyugo Mountain');
  assert.equal(COURSE4.theme, 'snow');
});

test('本線の印は走る順: スタート → GS → UB → X1 → FK → SP → XJ → MG → BZ → TI → HX → TO', () => {
  const names = ['GS', 'UB', 'X1', 'FK', 'SP', 'XJ', 'MG', 'BZ', 'TI', 'HX', 'TO'];
  const order = names.map((m) => markS(t, [m, m, 0]));
  for (let k = 1; k < order.length; k++) assert.ok(order[k] > order[k - 1], names[k]);
});

test('スタートは左の道で、北（地図の上）へ向かう。そのあと右へ曲がって、上の道は東へ', () => {
  const p = t.samples[t.startIndex];
  assert.ok(Math.sin(p.h) < -0.9, `${p.h}`); // z が減る向き
  assert.ok(Math.cos(at(['GS', 'UB', 0.5]).h) > 0.9);
});
