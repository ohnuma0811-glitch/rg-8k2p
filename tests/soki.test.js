import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, markS } from '../src/game/track.js';
import { COURSE3, COURSES } from '../src/data/tracks.js';

const t = buildTrack(COURSE3);

test('Soki Forest は3つ目のコース。大会は3レース（2026-10-16 のユーザー依頼）', () => {
  assert.equal(COURSES.length, 3);
  assert.equal(COURSES[2], COURSE3);
  assert.equal(COURSE3.name, 'Soki Forest');
  assert.equal(COURSE3.theme, 'forest');
});

test('本線の印は走る順: スタート → J1 → F1 → M1 → BR → M2 → HILL → J2', () => {
  const order = ['J1', 'F1', 'M1', 'BR', 'M2', 'HILL', 'J2'].map((m) => markS(t, [m, m, 0]));
  for (let k = 1; k < order.length; k++) assert.ok(order[k] > order[k - 1], `${k}`);
  assert.equal(t.length, 2500);
});

test('スタートは下の道で、西（左）へ向かう', () => {
  const p = t.samples[t.startIndex];
  assert.ok(Math.cos(p.h) < -0.8, `${p.h}`);
});
