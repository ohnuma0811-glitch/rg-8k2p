import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, HUMAN_ODDS, CPU_ODDS, oddsRow, lowerHalf, itemOdds, rollItem } from '../src/game/itemOdds.js';

test('出やすさの表: 人も CPU も、8行とも合計 100', () => {
  for (const table of [HUMAN_ODDS, CPU_ODDS]) {
    assert.equal(table.length, 8);
    for (const row of table) assert.equal(ITEMS.reduce((a, it) => a + row[it], 0), 100);
  }
});

test('Shell はどの順位も 20%（人）。CPU には Shell・Green Shell が出ない', () => {
  for (const row of HUMAN_ODDS) assert.equal(row.shell, 20);
  for (let n = 1; n <= 8; n++) {
    for (let r = 1; r <= n; r++) {
      const o = itemOdds(r, n, true);
      assert.equal(o.shell, 0);
      assert.equal(o.green, 0);
    }
  }
});

test('表の行: 8台はそのまま、5台は 1→1、2→3、3→5、4→6、5→8 位の行、1台は1位の行', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map((r) => oddsRow(r, 8)), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual([1, 2, 3, 4, 5].map((r) => oddsRow(r, 5)), [0, 2, 4, 5, 7]);
  assert.equal(oddsRow(1, 1), 0);
});

test('Lightning は下半分の順位だけ（8台は5〜8位、6台は4〜6位、5台は4・5位、2台は2位、1台はなし）', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map((r) => lowerHalf(r, 8)), [false, false, false, false, true, true, true, true]);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((r) => lowerHalf(r, 6)), [false, false, false, true, true, true]);
  assert.deepEqual([1, 2, 3, 4, 5].map((r) => lowerHalf(r, 5)), [false, false, false, true, true]);
  assert.deepEqual([1, 2].map((r) => lowerHalf(r, 2)), [false, true]);
  assert.equal(lowerHalf(1, 1), false);
});

test('下半分でないときは、Lightning の分を Mushroom に足す（人も CPU も）', () => {
  const human = itemOdds(3, 8, false); // 3位の行は Lightning 5、でも8台の3位は下半分ではない
  assert.equal(human.lightning, 0);
  assert.equal(human.mushroom, 25);
  assert.equal(itemOdds(5, 8, false).lightning, 5);
  const cpu = itemOdds(3, 8, true);
  assert.equal(cpu.lightning, 0);
  assert.equal(cpu.mushroom, 48);
  assert.equal(itemOdds(4, 5, true).lightning, 5); // 5台の4位 → 6位の行、下半分
});

test('rollItem: 0〜1 の数で、表のとおりに選ぶ', () => {
  // 人の1位: Banana 45、Green 30、Shell 20、Mushroom 5
  assert.equal(rollItem(1, 8, false, 0), 'banana');
  assert.equal(rollItem(1, 8, false, 0.449), 'banana');
  assert.equal(rollItem(1, 8, false, 0.45), 'green');
  assert.equal(rollItem(1, 8, false, 0.75), 'shell');
  assert.equal(rollItem(1, 8, false, 0.97), 'mushroom');
  // 人の8位: Shell 20、Mushroom 35、Star 40、Lightning 5
  assert.equal(rollItem(8, 8, false, 0.999), 'lightning');
  assert.equal(rollItem(8, 8, false, 0.6), 'star');
  // CPU の1位: Banana 70、Mushroom 30
  assert.equal(rollItem(1, 5, true, 0.69), 'banana');
  assert.equal(rollItem(1, 5, true, 0.71), 'mushroom');
});
