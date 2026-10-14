import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODES } from '../src/screens.js';

test('タイトルで選べるのは4つ: SOLO RACE / TIME TRIAL / VS RACE / BATTLE（2026-10-14 のユーザー依頼）。いま遊べるのは SOLO RACE だけ', () => {
  assert.deepEqual(MODES.map((m) => m.id), ['solo', 'timetrial', 'versus', 'battle']);
  assert.deepEqual(MODES.map((m) => m.label), ['SOLO RACE', 'TIME TRIAL', 'VS RACE', 'BATTLE']);
  assert.deepEqual(MODES.filter((m) => m.ready).map((m) => m.id), ['solo']);
  for (const m of MODES) assert.ok(m.icon && m.sub, m.id);
});

test('結果は、下の順位から1行ずつ出す（5位 → 1位。2026-10-14 のユーザー依頼）', async () => {
  const { revealOrder } = await import('../src/screens.js');
  assert.deepEqual(revealOrder(5), [4, 3, 2, 1, 0]);
  assert.deepEqual(revealOrder(1), [0]);
});
