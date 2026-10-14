import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODES } from '../src/screens.js';

test('タイトルで選べるのは4つ: SOLO RACE / TIME TRIAL / VS RACE / BATTLE（2026-10-14 のユーザー依頼）。いま遊べるのは SOLO RACE だけ', () => {
  assert.deepEqual(MODES.map((m) => m.id), ['solo', 'timetrial', 'versus', 'battle']);
  assert.deepEqual(MODES.map((m) => m.label), ['SOLO RACE', 'TIME TRIAL', 'VS RACE', 'BATTLE']);
  assert.deepEqual(MODES.filter((m) => m.ready).map((m) => m.id), ['solo']);
  for (const m of MODES) assert.ok(m.icon && m.sub, m.id);
});
