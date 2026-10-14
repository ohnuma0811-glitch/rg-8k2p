import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CUP_RACES, createCup, addRace, standings, isOver } from '../src/game/cup.js';

test('大会は5レース（2026-10-14 のユーザー依頼）。ポイントを合計し、5レース走ったら終わり', () => {
  assert.equal(CUP_RACES, 5);
  const cup = createCup(3);
  assert.equal(cup.done, 0);
  assert.deepEqual(cup.totals, [0, 0, 0]);
  // レースの順位（車の番号を、1位から順に）
  addRace(cup, [2, 0, 1]);
  assert.deepEqual(cup.totals, [8, 6, 10]);
  assert.deepEqual(cup.gained, [8, 6, 10]);
  assert.equal(cup.done, 1);
  assert.equal(isOver(cup), false);
  for (let i = 0; i < 4; i++) addRace(cup, [0, 1, 2]);
  assert.equal(cup.done, 5);
  assert.equal(isOver(cup), true);
  assert.deepEqual(cup.totals, [8 + 40, 6 + 32, 10 + 24]);
  assert.deepEqual(standings(cup), [0, 1, 2]);
});

test('合計が同じなら、直前のレースで上だった方を上にする', () => {
  const cup = createCup(2);
  addRace(cup, [0, 1]); // 0: 10, 1: 8
  addRace(cup, [1, 0]); // 0: 18, 1: 18（直前は 1 が上）
  assert.deepEqual(cup.totals, [18, 18]);
  assert.deepEqual(standings(cup), [1, 0]);
});
