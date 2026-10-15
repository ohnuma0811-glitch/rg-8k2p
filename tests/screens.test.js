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

test('VS RACE と BATTLE には「GAME CODE が必要」と書く（2026-10-14 のユーザー依頼）', () => {
  assert.deepEqual(MODES.filter((m) => m.code).map((m) => m.id), ['versus', 'battle']);
});

test('BACK で1つ前の画面へ: キャラ選び → 名前 → タイトル（2026-10-15 のユーザー依頼）', async () => {
  const { prevScreen, BACK } = await import('../src/screens.js');
  assert.equal(prevScreen('character'), 'name');
  assert.equal(prevScreen('name'), 'title');
  assert.equal(prevScreen('title'), 'title', 'タイトルより前はない');
  assert.equal(typeof BACK, 'string');
});

test('結果・大会の順位の表は、ボタンなし。全部の表示（行が出る・ポイントを数える）が終わって3秒後に次へ（2026-10-16 のユーザー依頼）', async () => {
  const { tableSeconds, AUTO_NEXT_SEC } = await import('../src/screens.js');
  assert.equal(AUTO_NEXT_SEC, 3);
  // 行2つ（0.35秒ずつ）＋ 1位: 0.15秒待って 10pt を数える（0.06秒ずつ）＋ 2位: 0.15秒待って 5pt
  const rows = [{ from: 0, to: 10 }, { from: 0, to: 5 }];
  assert.ok(Math.abs(tableSeconds(rows) - (2 * 0.35 + 0.15 + 10 * 0.06 + 0.15 + 5 * 0.06)) < 1e-9);
  // 前の合計から数える（大会の順位）
  assert.ok(Math.abs(tableSeconds([{ from: 20, to: 23 }]) - (0.35 + 0.15 + 3 * 0.06)) < 1e-9);
});
