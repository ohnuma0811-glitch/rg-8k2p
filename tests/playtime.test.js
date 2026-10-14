import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, isLimited, remainingSec, addPlay, remainingText } from '../src/playtime.js';

// 日本時間で年月日時分を指定した時刻（ミリ秒）
const jst = (y, mo, d, h, mi = 0) => Date.UTC(y, mo - 1, d, h - 9, mi);

test('1日の区切りは日本時間の深夜2時（1時59分は前の日、2時からは次の日）', () => {
  assert.equal(dayKey(jst(2026, 10, 15, 1, 59)), '2026-10-14');
  assert.equal(dayKey(jst(2026, 10, 15, 2, 0)), '2026-10-15');
  assert.equal(dayKey(jst(2026, 10, 15, 23, 59)), '2026-10-15');
});

test('制限があるのは KYUGO と SOKI だけ。ほかの名前は残り時間が無限', () => {
  assert.ok(isLimited('KYUGO') && isLimited('SOKI'));
  assert.ok(!isLimited('KENTA'));
  assert.equal(remainingSec({}, 'KENTA', jst(2026, 10, 15, 12)), Infinity);
});

test('1日20分。遊んだ分だけ減り、0より下にはならない', () => {
  const now = jst(2026, 10, 15, 12);
  let store = {};
  assert.equal(remainingSec(store, 'KYUGO', now), 1200);
  store = addPlay(store, 'KYUGO', now, 300);
  assert.equal(remainingSec(store, 'KYUGO', now), 900);
  store = addPlay(store, 'KYUGO', now, 2000);
  assert.equal(remainingSec(store, 'KYUGO', now), 0);
  assert.equal(remainingSec(store, 'SOKI', now), 1200, 'Soki は別に数える');
});

test('深夜2時をすぎると、また20分遊べる（古い日の記録は消える）', () => {
  let store = addPlay({}, 'SOKI', jst(2026, 10, 15, 1, 30), 1200);
  assert.equal(remainingSec(store, 'SOKI', jst(2026, 10, 15, 1, 50)), 0);
  assert.equal(remainingSec(store, 'SOKI', jst(2026, 10, 15, 2, 5)), 1200);
  store = addPlay(store, 'SOKI', jst(2026, 10, 15, 2, 5), 60);
  assert.deepEqual(Object.keys(store), ['2026-10-15']);
});

test('制限のない名前は記録しない', () => {
  assert.deepEqual(addPlay({}, 'KENTA', jst(2026, 10, 15, 12), 100), {});
});

test('残り時間の表示: 1分以上は分、1分を切ったら秒', () => {
  assert.equal(remainingText(725), 'Today: 12 min left');
  assert.equal(remainingText(44.2), 'Today: 45 sec left');
  assert.equal(remainingText(Infinity), '');
});

test('保存してある遊んだ時間が壊れていても（null や数字）、止まらずに 0 分使ったことにする（レビューの指摘）', async () => {
  const { usedSec } = await import('../src/playtime.js');
  const now = Date.now();
  assert.equal(usedSec(null, 'KYUGO', now), 0);
  assert.equal(usedSec(5, 'KYUGO', now), 0);
  assert.equal(remainingSec(null, 'KYUGO', now), 20 * 60);
  const after = addPlay(null, 'KYUGO', now, 30);
  assert.equal(usedSec(after, 'KYUGO', now), 30);
});
