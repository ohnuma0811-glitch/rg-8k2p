import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kartParams } from '../src/game/stats.js';

test('数字が大きいほど、最高速・加速・曲がる速さが上がる', () => {
  for (let n = 1; n < 5; n++) {
    const a = kartParams({ accel: n, top: n, handling: n });
    const b = kartParams({ accel: n + 1, top: n + 1, handling: n + 1 });
    assert.ok(b.topSpeed > a.topSpeed && b.accel > a.accel && b.turnRate > a.turnRate);
  }
});

test('万能タイプ（3・3・3）は最高速41m/s（時速約148km。レースらしいスピード感）', () => {
  assert.equal(kartParams({ accel: 3, top: 3, handling: 3 }).topSpeed, 41);
});

test('1〜5以外の数字はまちがいとして止める', () => {
  assert.throws(() => kartParams({ accel: 0, top: 3, handling: 3 }), RangeError);
  assert.throws(() => kartParams({ accel: 3, top: 6, handling: 3 }), RangeError);
  assert.throws(() => kartParams({ accel: 3, top: 2.5, handling: 3 }), RangeError);
});
