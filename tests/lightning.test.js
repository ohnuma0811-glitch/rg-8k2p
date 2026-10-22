import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { COURSES } from '../src/data/tracks.js';
import { createKart, stepKart, BLAST } from '../src/game/kart.js';
import { kartParams } from '../src/game/stats.js';
import { ITEM, initItems, createItemWorld, itemPress, stepItems, canUse } from '../src/game/items.js';

const t = buildTrack(COURSES[1]);
const params = kartParams({ accel: 3, top: 3, handling: 3 });
const DT = 1 / 60;
function setup(n = 4) {
  const karts = Array.from({ length: n }, (_, k) => {
    const kart = createKart(t, (100 + k * 30) % t.length);
    initItems(kart);
    return kart;
  });
  const world = createItemWorld(t);
  const f = { me: 0, press: false, cpuPress: () => false, t: 0, ranks: karts.map((_, k) => k).reverse(), finished: karts.map(() => false), params, rand: () => 0 };
  return { karts, world, f };
}
function run(world, karts, f, sec) {
  for (let s = 0; s < sec - 1e-9; s += DT) {
    stepItems(world, karts, f, DT);
    karts.forEach((k) => stepKart(k, { steer: 0, throttle: true, brake: false, drift: false }, t, params, DT));
  }
}
function strike(n) {
  const c = setup(n);
  c.karts[0].held = 'lightning';
  itemPress(c.world, c.karts, 0, c.f);
  return c;
}

test('稲妻: 自分以外の全員がスピンして（赤甲羅と同じ）、10秒の小さい時間が始まる。使った人は無事', () => {
  const { karts, world } = strike(4);
  assert.equal(karts[0].blast, 0);
  assert.equal(karts[0].smallTime, 0);
  for (const k of [1, 2, 3]) {
    assert.equal(karts[k].blast, BLAST.TIME);
    assert.equal(karts[k].smallTime, ITEM.LIGHTNING_TIME);
    assert.equal(karts[k].zap, ITEM.ZAP_SHOW);
    assert.ok(!(karts[k].muddy > 0), '左右は入れ替わらない');
  }
  assert.equal(world.flash, 1);
  assert.equal(world.thunder, 1);
});

test('稲妻: Star の車と自動の区間の車には効かない', () => {
  const c = setup(4);
  c.karts[2].star = 3;
  c.karts[3].auto = { id: 'jump' };
  c.karts[0].held = 'lightning';
  itemPress(c.world, c.karts, 0, c.f);
  for (const k of [2, 3]) {
    assert.equal(c.karts[k].blast, 0);
    assert.equal(c.karts[k].smallTime, 0);
    assert.equal(c.karts[k].zap, 0);
  }
  assert.equal(c.karts[1].smallTime, ITEM.LIGHTNING_TIME);
});

test('稲妻: スピンの間に1から0.35へ小さくなり、そのあと0.35のまま', () => {
  const { karts, world, f } = strike(3);
  run(world, karts, f, BLAST.TIME / 2);
  assert.ok(karts[1].small < 0.8 && karts[1].small > 0.5, `半分: ${karts[1].small}`);
  run(world, karts, f, BLAST.TIME / 2 + 0.1);
  assert.ok(Math.abs(karts[1].small - ITEM.LIGHTNING_SCALE) < 1e-6);
  run(world, karts, f, 3);
  assert.ok(Math.abs(karts[1].small - ITEM.LIGHTNING_SCALE) < 1e-6);
  assert.equal(karts[0].small, 1);
});

test('稲妻: 小さい間の最高速は75%。10秒たつと大きさも速さも元にもどる', () => {
  const { karts, world, f } = strike(3);
  const ref = createKart(t, 130);
  initItems(ref);
  const small = karts[1];
  small.blast = 0; // スピンはもう終わったことにして、走っているところから見る
  small.blastRest = 0;
  small.speed = ref.speed = params.topSpeed * 0.97;
  const go = { steer: 0, brake: false, drift: false };
  for (let s = 0; s < 1.5; s += DT) {
    stepKart(small, go, t, params, DT);
    stepKart(ref, go, t, params, DT);
  }
  assert.ok(small.speed <= params.topSpeed * ITEM.LIGHTNING_SPEED * 1.06, `small ${small.speed}`);
  assert.ok(ref.speed > params.topSpeed * 0.9, `ref ${ref.speed}`);
  // 10秒たつと、大きさも速さも元にもどる
  run(world, karts, f, ITEM.LIGHTNING_TIME + 0.2);
  assert.equal(karts[1].smallTime, 0);
  assert.equal(karts[1].small, 1);
  const again = createKart(t, 130);
  initItems(again);
  again.speed = params.topSpeed * 0.97;
  for (let s = 0; s < 1.5; s += DT) stepKart(again, go, t, params, DT);
  assert.ok(again.speed > params.topSpeed * 0.9);
});

test('稲妻: 終わりの0.3秒でなめらかに元の大きさにもどる', () => {
  const { karts, world, f } = strike(2);
  run(world, karts, f, ITEM.LIGHTNING_TIME - 0.15);
  assert.ok(karts[1].small > ITEM.LIGHTNING_SCALE + 0.1 && karts[1].small < 1, `${karts[1].small}`);
});

test('稲妻: 左右は入れ替わらない（バナナは今まで通り入れ替わる）', () => {
  const { karts, world, f } = strike(3);
  assert.ok(!karts[1].swapItem);
  assert.ok(!(karts[1].muddy > 0));
  assert.equal(karts[1].shock, undefined);
  run(world, karts, f, 3);
  assert.ok(!(karts[1].muddy > 0));
  // バナナ
  const b = setup(2);
  b.karts[1].blast = 0;
  b.karts[0].held = 'banana';
  itemPress(b.world, b.karts, 0, b.f);
  b.world.bananas.push({ id: 99, owner: 0, x: b.karts[1].x, z: b.karts[1].z, y: b.karts[1].y, age: 5, h: 0 });
  stepItems(b.world, b.karts, b.f, DT);
  assert.ok(b.karts[1].muddy > 0 && b.karts[1].swapItem);
});

test('稲妻: 小さい車がまた当たると、10秒をやり直してスピンする', () => {
  const { karts, world, f } = strike(2);
  run(world, karts, f, 6);
  assert.ok(karts[1].smallTime < 5);
  assert.equal(karts[1].blast, 0);
  karts[2 - 1].held = null;
  karts[0].held = 'lightning';
  itemPress(world, karts, 0, f);
  assert.equal(karts[1].smallTime, ITEM.LIGHTNING_TIME);
  assert.equal(karts[1].blast, BLAST.TIME);
  assert.ok(Math.abs(karts[1].small - ITEM.LIGHTNING_SCALE) < 1e-6, '大きくもどらない');
  stepItems(world, karts, f, DT);
  assert.ok(karts[1].small <= ITEM.LIGHTNING_SCALE + 1e-6);
});

test('稲妻: 白い光は約0.4秒で消える', () => {
  const { karts, world, f } = strike(2);
  run(world, karts, f, 0.2);
  assert.ok(world.flash > 0.3);
  run(world, karts, f, 0.3);
  assert.equal(world.flash, 0);
});

// ---- 小さい車は大きい車にぶつかると、ぺしゃんこ（2026-10-22 のユーザー依頼） ----
import { pushApart } from '../src/game/collide.js';
import { SQUASH, squashKart, squashContacts } from '../src/game/items.js';

function pair() {
  const c = setup(2);
  const [a, b] = c.karts;
  b.x = a.x + 1.5; b.z = a.z; b.y = a.y; b.seg = a.seg;
  a.speed = b.speed = 20;
  return { ...c, a, b };
}
function touch(karts) {
  const now = pushApart(karts, new Set());
  return squashContacts(karts, now);
}

test('ぺしゃんこ: 小さい車が大きい車にぶつかると squash=1.0 で止まる。大きい車は無事', () => {
  const { karts, a, b } = pair();
  b.smallTime = 8; b.small = 0.35;
  const hit = touch(karts);
  assert.deepEqual(hit, [1]);
  assert.equal(b.squash, SQUASH.TIME);
  assert.equal(SQUASH.TIME, 1.0);
  assert.equal(a.squash ?? 0, 0);
  stepKart(b, { steer: 0, throttle: true, brake: false, drift: false }, t, params, DT);
  assert.equal(b.speed, 0);
  assert.ok(a.speed > 0);
});

test('ぺしゃんこ: 小さい車どうしでは何も起きない', () => {
  const { karts, a, b } = pair();
  a.smallTime = b.smallTime = 8;
  assert.deepEqual(touch(karts), []);
  assert.ok(!(a.squash > 0) && !(b.squash > 0));
});

test('ぺしゃんこ: 1秒後に大きさも速さも元にもどる（稲妻が残っていても）', () => {
  const { karts, world, f, b } = pair();
  b.smallTime = 8; b.small = 0.35;
  touch(karts);
  run(world, karts, f, 0.5);
  assert.ok(b.squash > 0 && b.smallTime > 7, '途中はまだぺしゃんこで、稲妻は止まったまま進まなくてもよい');
  assert.ok(b.small < 0.4);
  run(world, karts, f, 0.6);
  assert.equal(b.squash, 0);
  assert.equal(b.small, 1);
  assert.equal(b.smallTime, 0);
  b.speed = params.topSpeed * 0.97;
  for (let s = 0; s < 1.5; s += DT) stepKart(b, { steer: 0, throttle: true, brake: false, drift: false }, t, params, DT);
  assert.ok(b.speed > params.topSpeed * 0.9);
});

test('ぺしゃんこ: つぶれている間はアイテムを使えない', () => {
  const { karts, b } = pair();
  assert.equal(canUse(b, false), true);
  b.smallTime = 8; b.small = 0.35;
  touch(karts);
  assert.equal(canUse(b, false), false);
});

test('ぺしゃんこ: スピン中・Star の車はつぶれない（Star の車は小さくならない）', () => {
  const { karts, b } = pair();
  b.smallTime = 8; b.small = 0.35; b.blast = 1;
  assert.equal(squashKart(b), false);
  assert.deepEqual(touch(karts), []);
  assert.ok(!(b.squash > 0));
  b.blast = 0; b.tumble = 1;
  assert.equal(squashKart(b), false);
  b.tumble = 0; b.auto = { id: 'x' };
  assert.equal(squashKart(b), false);
  b.auto = null; b.respawn = 1;
  assert.equal(squashKart(b), false);
  b.respawn = 0;
  assert.equal(squashKart(b), true);
  assert.equal(squashKart(b), false, '二重にはつぶれない');
});
