import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { COURSES } from '../src/data/tracks.js';
import { createKart } from '../src/game/kart.js';
import { kartParams } from '../src/game/stats.js';
import { ITEM, initItems, createItemWorld, canTake, itemPress, stepItems, itemFrame, swapSteer } from '../src/game/items.js';

const t = buildTrack(COURSES[1]);
const params = kartParams({ accel: 3, top: 3, handling: 3 });
export function setup(n = 3) {
  const karts = Array.from({ length: n }, (_, k) => {
    const kart = createKart(t, (100 + k * 30) % t.length);
    initItems(kart);
    return kart;
  });
  const world = createItemWorld(t);
  // 順位: 番号の大きい車ほど前（100m、130m、160m）
  const f = { me: 0, press: false, cpuPress: () => false, t: 0, ranks: karts.map((_, k) => k).reverse(), finished: karts.map(() => false), params, rand: () => 0 };
  return { karts, world, f };
}
const DT = 1 / 60;
function frames(world, karts, f, sec) {
  const out = [];
  for (let s = 0; s < sec; s += DT) out.push(...stepItems(world, karts, f, DT));
  return out;
}

test('箱を取ると、約2秒ルーレットが回って決まる（何が出るかは、その時の順位）', () => {
  const { karts, world, f } = setup();
  const b = world.boxes[0];
  Object.assign(karts[2], { x: b.x, z: b.z, y: b.y }); // 1位の車
  f.rand = () => 0; // 1位の行の最初（Banana）
  const out = stepItems(world, karts, f, DT);
  assert.deepEqual(out.map((e) => e.type), ['box']);
  assert.ok(karts[2].roulette > 0);
  assert.equal(karts[2].held, null);
  karts[2].x += 100; // 箱から離れる
  const later = frames(world, karts, f, ITEM.ROULETTE);
  assert.ok(later.some((e) => e.type === 'decided' && e.k === 2));
  assert.equal(karts[2].held, 'banana');
  assert.equal(karts[2].roulette, 0);
});

test('ルーレットの間に ITEM を押すと、すぐ止まる', () => {
  const { karts, world, f } = setup();
  karts[0].roulette = 1.5;
  karts[0].rouletteItem = 'mushroom';
  const ev = itemPress(world, karts, 0, f);
  assert.equal(ev.type, 'stop');
  assert.equal(karts[0].held, 'mushroom');
  assert.equal(karts[0].roulette, 0);
});

test('アイテムを持っているとき・ルーレットの間に箱を取っても、何ももらえない（箱は消える）', () => {
  const { karts, world, f } = setup();
  karts[0].held = 'star';
  const b = world.boxes[0];
  Object.assign(karts[0], { x: b.x, z: b.z, y: b.y });
  assert.deepEqual(stepItems(world, karts, f, DT), []);
  assert.equal(karts[0].held, 'star');
  assert.ok(b.gone > 0);
  assert.equal(canTake(karts[0]), false);
  karts[0].held = null;
  karts[0].roulette = 1;
  assert.equal(canTake(karts[0]), false);
});

test('Mushroom を使う: 加速して、枠が空になる。出来事が返る', () => {
  const { karts, world, f } = setup();
  karts[0].held = 'mushroom';
  karts[0].speed = 20;
  const ev = itemPress(world, karts, 0, f);
  assert.deepEqual({ type: ev.type, item: ev.item, k: ev.k }, { type: 'use', item: 'mushroom', k: 0 });
  assert.equal(karts[0].held, null);
  assert.ok(karts[0].speed >= params.topSpeed * 1.3 - 1e-9);
  assert.equal(itemPress(world, karts, 0, f), null, '空の枠では何もしない');
});

test('Star を使う: 6秒の無敵', () => {
  const { karts, world, f } = setup();
  karts[0].held = 'star';
  itemPress(world, karts, 0, f);
  assert.equal(karts[0].star, 6);
});

test('使えない時: 吹き飛んでいる・転がっている・自動の区間・コースに戻る途中・ゴールしたあと', () => {
  for (const [key, value] of [['blast', 1], ['tumble', 1], ['auto', { id: 'jump' }], ['respawn', 1], ['finished', true]]) {
    const { karts, world, f } = setup();
    karts[0].held = 'mushroom';
    if (key === 'finished') f.finished[0] = true;
    else karts[0][key] = value;
    assert.equal(itemPress(world, karts, 0, f), null, key);
    assert.equal(karts[0].held, 'mushroom', key);
  }
});

test('itemFrame: 自分は press、CPU は cpuPress で ITEM を押す', () => {
  const { karts, world, f } = setup();
  karts[0].held = 'mushroom';
  karts[1].held = 'mushroom';
  f.press = true;
  f.cpuPress = (k) => k === 1;
  const { events } = itemFrame(world, karts, f, DT);
  assert.deepEqual(events.map((e) => e.k).sort(), [0, 1]);
  assert.equal(karts[2].mushrooms ?? 0, 0);
});

test('Banana: 1回目の ITEM で後ろにぶら下げ（枠は空）、2回目で 3m 後ろに置く', () => {
  const { karts, world, f } = setup();
  const k = karts[0];
  k.held = 'banana';
  itemPress(world, karts, 0, f);
  assert.equal(k.trailing, true);
  assert.equal(k.held, null);
  assert.equal(canTake(k), true, 'ぶら下げている間は、次のアイテムを取れる');
  k.held = 'mushroom';
  const ev = itemPress(world, karts, 0, f);
  assert.equal(ev.type, 'drop', 'ぶら下げたバナナを置くのが先');
  assert.equal(k.held, 'mushroom');
  assert.equal(k.trailing, false);
  assert.equal(world.bananas.length, 1);
  const b = world.bananas[0];
  assert.ok(Math.abs(Math.hypot(b.x - k.x, b.z - k.z) - ITEM.BANANA_DROP) < 1e-6);
  assert.ok(Math.cos(Math.atan2(b.z - k.z, b.x - k.x) - k.heading) < -0.99, '後ろ');
});

test('置いたバナナを踏むと、5秒間ハンドルの左右が入れ替わる（スピンしない）。バナナは消える', () => {
  const { karts, world, f } = setup();
  world.bananas.push({ id: 99, owner: 0, x: karts[1].x, y: karts[1].y, z: karts[1].z, age: 5 });
  const out = stepItems(world, karts, f, DT);
  assert.ok(out.some((e) => e.type === 'banana' && e.k === 1));
  assert.equal(karts[1].muddy, ITEM.BANANA_SWAP);
  assert.equal(karts[1].spin, 0);
  assert.equal(karts[1].bananaHits, 1);
  assert.equal(world.bananas.length, 0);
});

test('置いてすぐ（1秒）は、自分では踏まない', () => {
  const { karts, world, f } = setup();
  world.bananas.push({ id: 99, owner: 0, x: karts[0].x, y: karts[0].y, z: karts[0].z, age: 0 });
  stepItems(world, karts, f, DT);
  assert.equal(world.bananas.length, 1);
});

test('バナナはコース全体で10個まで。超えたら古い物から消える', () => {
  const { karts, world, f } = setup();
  for (let n = 0; n < 12; n++) {
    karts[0].held = 'banana';
    itemPress(world, karts, 0, f);
    itemPress(world, karts, 0, f);
    karts[0].x += 20;
  }
  assert.equal(world.bananas.length, ITEM.BANANA_MAX);
  assert.equal(world.bananas[0].id, 3, '最初の2つが消えた');
});

test('入れ替わりがまた起きたら、残りは長い方。Star と自動の区間の車には効かない', () => {
  const k = { muddy: 3 };
  assert.equal(swapSteer(k, 5), true);
  assert.equal(k.muddy, 5);
  k.muddy = 8;
  swapSteer(k, 5);
  assert.equal(k.muddy, 8);
  assert.equal(swapSteer({ muddy: 0, star: 2 }, 5), false);
  assert.equal(swapSteer({ muddy: 0, auto: { id: 'jump' } }, 5), false);
});

test('Star の車はバナナを踏んでも何も起きない（バナナは消える）。自動の区間の車は踏まない', () => {
  const { karts, world, f } = setup();
  karts[1].star = 3;
  karts[2].auto = { id: 'jump' };
  world.bananas.push({ id: 1, owner: 0, x: karts[1].x, y: karts[1].y, z: karts[1].z, age: 5 });
  world.bananas.push({ id: 2, owner: 0, x: karts[2].x, y: karts[2].y, z: karts[2].z, age: 5 });
  stepItems(world, karts, f, DT);
  assert.equal(karts[1].muddy ?? 0, 0);
  assert.deepEqual(world.bananas.map((b) => b.id), [2]);
});
