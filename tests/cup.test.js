import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCup, addRace, standings, isOver, courseOf } from '../src/game/cup.js';

test('5レースの大会: ポイントを合計し、5レース走ったら終わり（2026-10-14 のユーザー依頼）', () => {
  const cup = createCup(3, 5);
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
  const cup = createCup(2, 5);
  addRace(cup, [0, 1]); // 0: 10, 1: 8
  addRace(cup, [1, 0]); // 0: 18, 1: 18（直前は 1 が上）
  assert.deepEqual(cup.totals, [18, 18]);
  assert.deepEqual(standings(cup), [1, 0]);
});

test('大会のレースの数は、できているコースの数（2026-10-15 のユーザー依頼）。全部走ったら終わり', () => {
  const cup = createCup(5, 2);
  assert.equal(cup.races, 2);
  assert.equal(isOver(cup), false);
  addRace(cup, [0, 1, 2, 3, 4]);
  assert.equal(isOver(cup), false);
  addRace(cup, [0, 1, 2, 3, 4]);
  assert.equal(isOver(cup), true);
});

test('何レース目にどのコースを走るか: 1レース目から順に、コースの一覧の順', () => {
  const courses = [{ name: 'Kenta Circuit' }, { name: 'Kampar Town' }];
  const cup = createCup(5, courses.length);
  assert.equal(courseOf(courses, cup).name, 'Kenta Circuit');
  addRace(cup, [0, 1, 2, 3, 4]);
  assert.equal(courseOf(courses, cup).name, 'Kampar Town');
  // 新しい大会はまた1レース目から
  assert.equal(courseOf(courses, createCup(5, courses.length)).name, 'Kenta Circuit');
});

test('スタートの並び: 1レース目はいつもの順。2レース目からは、前のレースで勝った車ほど後ろ（弱い車が前。2026-10-17 のユーザー依頼）', async () => {
  const { createCup, addRace, gridOrder } = await import('../src/game/cup.js');
  const cup = createCup(5, 3);
  assert.deepEqual(gridOrder(cup), [0, 1, 2, 3, 4]);
  addRace(cup, [3, 0, 4, 1, 2]); // 3 が1位、2 が5位
  // 前（スタートの1番目）から: 5位 → 1位
  assert.deepEqual(gridOrder(cup), [2, 1, 4, 0, 3]);
});
