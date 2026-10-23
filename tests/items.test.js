import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { COURSES } from '../src/data/tracks.js';
import { createKart, stepKart, PHYS } from '../src/game/kart.js';
import { kartParams } from '../src/game/stats.js';
import { ITEM, initItems, createItemWorld, canTake, itemPress, stepItems, itemFrame, swapSteer, starGuard, starRestore } from '../src/game/items.js';

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

test('キノコの加速が効いている間は、次のキノコを使えない（連打できない。2026-10-22 のユーザー依頼）', () => {
  const { karts, world, f } = setup();
  const k = karts[0];
  k.held = 'mushroom';
  k.heldUses = 3;
  assert.equal(itemPress(world, karts, 0, f).item, 'mushroom');
  assert.equal(itemPress(world, karts, 0, f), null, '加速中はもう一度押しても何もしない');
  assert.equal(k.heldUses, 2);
  for (let i = 0; i < 100; i++) stepKart(k, { steer: 0, throttle: 1, brake: false, drift: false }, t, params, DT);
  assert.equal(k.mushroom, 0);
  assert.equal(itemPress(world, karts, 0, f).item, 'mushroom', '加速が終われば使える');
  assert.equal(k.heldUses, 1);
});

test('Star を使う: 9秒の無敵', () => {
  const { karts, world, f } = setup();
  karts[0].held = 'star';
  itemPress(world, karts, 0, f);
  assert.equal(karts[0].star, 9);
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

test('Banana: 1回目の ITEM で5個を後ろにぶら下げ（枠は空）、そのあと1回ごとに 3m 後ろに1個置く（2026-10-22 のユーザー依頼）', () => {
  const { karts, world, f } = setup();
  const k = karts[0];
  k.held = 'banana';
  itemPress(world, karts, 0, f);
  assert.equal(k.trailing, 5);
  assert.equal(k.held, null);
  assert.equal(canTake(k), true, 'ぶら下げている間は、次のアイテムを取れる');
  k.held = 'mushroom';
  const ev = itemPress(world, karts, 0, f);
  assert.equal(ev.type, 'drop', 'ぶら下げたバナナを置くのが先');
  assert.equal(k.held, 'mushroom');
  assert.equal(k.trailing, 4);
  assert.equal(world.bananas.length, 1);
  for (let n = 3; n >= 0; n--) {
    assert.equal(itemPress(world, karts, 0, f).type, 'drop');
    assert.equal(k.trailing, n);
  }
  assert.equal(world.bananas.length, 5);
  assert.equal(itemPress(world, karts, 0, f).item, 'mushroom', '5個置いたら、枠のアイテム');
  world.bananas.length = 1;
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

test('バナナはコース全体で20個まで。超えたら古い物から消える', () => {
  const { karts, world, f } = setup();
  for (let n = 0; n < 22; n++) {
    karts[0].trailing = 1;
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

test('Green Shell ×3: 1回目の ITEM で3つが回りだす（枠は空）。そのあと押すたびに1つずつ前へ投げる', () => {
  const { karts, world, f } = setup();
  const k = karts[0];
  k.held = 'green';
  itemPress(world, karts, 0, f);
  assert.deepEqual(k.orbit, [0, 1, 2]);
  assert.equal(k.held, null);
  assert.equal(canTake(k), true);
  k.held = 'green'; // 回している間に、また緑の甲羅を取った
  for (let n = 3; n > 0; n--) {
    assert.equal(itemPress(world, karts, 0, f).type, 'throw');
    assert.equal(k.orbit.length, n - 1);
  }
  assert.equal(world.shells.length, 3);
  assert.ok(world.shells.every((s) => s.kind === 'green' && Math.cos(s.heading - k.heading) > 0.99), 'いつも前');
  assert.equal(itemPress(world, karts, 0, f).item, 'green', '全部投げたら、次の緑の甲羅を回せる');
  assert.equal(k.orbit.length, 3);
});

test('Shell（赤）: 使った時点のひとつ前の順位の車をねらう。1位で使うと相手なし', () => {
  const { karts, world, f } = setup();
  karts[0].held = 'shell'; // 3位
  assert.equal(itemPress(world, karts, 0, f).target, 1);
  karts[2].held = 'shell'; // 1位
  assert.equal(itemPress(world, karts, 2, f).target, null);
  assert.equal(world.shells.length, 2);
});

test('ITEM の順番: ぶら下げたバナナ → 回る甲羅 → 枠', () => {
  const { karts, world, f } = setup();
  const k = karts[0];
  k.trailing = 1;
  k.orbit = [0, 1];
  k.held = 'mushroom';
  assert.deepEqual([itemPress(world, karts, 0, f).type, itemPress(world, karts, 0, f).type, itemPress(world, karts, 0, f).type, itemPress(world, karts, 0, f).type], ['drop', 'throw', 'throw', 'use']);
});

test('回る甲羅がある車は、置かれたバナナも、向きが合えばふせぐ', () => {
  const { karts, world, f } = setup();
  karts[1].orbit = [0, 1, 2];
  world.bananas.push({ id: 99, owner: 0, x: karts[1].x, y: karts[1].y, z: karts[1].z + 0.1, age: 5 });
  const out = stepItems(world, karts, f, DT);
  assert.ok(out.some((e) => e.type === 'blocked' && e.k === 1));
  assert.equal(karts[1].muddy ?? 0, 0);
  assert.equal(karts[1].orbit.length, 2);
});

test('Star の車がほかの車にぶつかると、相手が吹き飛ぶ（Star どうし・自動の区間はなし）', () => {
  const { karts, world, f } = setup();
  karts[0].star = 5;
  Object.assign(karts[1], { x: karts[0].x + 2, z: karts[0].z, y: karts[0].y });
  const out = stepItems(world, karts, f, DT);
  assert.ok(out.some((e) => e.type === 'blast' && e.k === 1 && e.by === 0));
  assert.ok(karts[1].blast > 0);
  assert.equal(karts[0].blast, 0);
  const s = setup();
  s.karts[0].star = 5;
  s.karts[1].star = 5;
  Object.assign(s.karts[1], { x: s.karts[0].x + 2, z: s.karts[0].z, y: s.karts[0].y });
  stepItems(s.world, s.karts, s.f, DT);
  assert.equal(s.karts[1].blast, 0);
});

test('Star の車は、障害物に当たってもスピン・転がり・入れ替わりにならない（starGuard → starRestore）', () => {
  const star = { star: 3, spin: 0, tumble: 0, speed: 40, heading: 0.2, muddy: 0 };
  const plain = { star: 0, spin: 0, tumble: 0, speed: 40, heading: 0.2, muddy: 0 };
  const saved = starGuard([star, plain]);
  for (const k of [star, plain]) Object.assign(k, { spin: 1, speed: 20, heading: 1, muddy: 4 }); // 牛にぶつかり、ぬかるみに入った
  starRestore([star, plain], saved);
  assert.deepEqual({ spin: star.spin, speed: star.speed, heading: star.heading, muddy: star.muddy }, { spin: 0, speed: 40, heading: 0.2, muddy: 0 });
  assert.equal(plain.spin, 1);
  assert.equal(plain.muddy, 4);
});

test('I2: swapSteer は swapItem の目印をつけ、muddy が 0 になったら stepItems が消す（ぬかるみだけの muddy には付かない）', () => {
  const { karts, world, f } = setup();
  karts[1].muddy = 3; // ぬかるみ
  stepItems(world, karts, f, DT);
  assert.ok(!karts[1].swapItem);
  assert.ok(swapSteer(karts[1], 0.05));
  assert.equal(karts[1].swapItem, true);
  karts[1].muddy = 0;
  stepItems(world, karts, f, DT);
  assert.equal(karts[1].swapItem, false);
});

test('I3: 赤の甲羅は、ゴール済みの車をねらわない（その前のゴールしていない車か、いなければまっすぐ）', () => {
  const { karts, world, f } = setup(4);
  f.ranks = [3, 2, 1, 0]; // 3位は 2 番、いちばん後ろが 0 番（自分）
  karts[0].held = 'shell';
  f.finished = [false, false, true, true]; // 1位・2位はゴール済み
  let ev = itemPress(world, karts, 0, f);
  assert.equal(ev.target, 1);
  karts[0].held = 'shell';
  f.finished = [false, true, true, true]; // 前の車が全員ゴール済み
  ev = itemPress(world, karts, 0, f);
  assert.equal(ev.target, null);
  assert.equal(world.shells[1].target, null);
});

test('M1: main.js の stepGame は、starGuard → 障害物 → 木の実（nutContact）→ starRestore の順（Star の車が木の実でスピンしない）', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const at = (s) => src.indexOf(s);
  assert.ok(at('starGuard(live)') > 0 && at('starGuard(live)') < at('cowContact(kart'));
  assert.ok(at('nutContact(kart') > 0 && at('starRestore(live') > at('nutContact(kart'));
});

test('M6: キノコは、使った車自身のパラメーター（f.paramsOf）で加速する。CPU が自分の最高速の2倍にならない', () => {
  const { karts, world, f } = setup();
  const slow = { ...params, topSpeed: params.topSpeed * 0.5 };
  f.paramsOf = (k) => (k === 1 ? slow : params);
  karts[1].held = 'mushroom';
  karts[0].held = 'mushroom';
  karts[1].speed = 0;
  karts[0].speed = 0;
  itemPress(world, karts, 1, { ...f, ranks: [0, 1, 2] });
  itemPress(world, karts, 0, f);
  assert.ok(karts[1].speed > 0);
  assert.ok(karts[1].speed < karts[0].speed * 0.6, `${karts[1].speed} vs ${karts[0].speed}`);
  // paramsOf がなければ f.params（今まで通り）
  const g = setup();
  g.karts[2].held = 'mushroom';
  g.karts[2].speed = 0;
  itemPress(g.world, g.karts, 2, g.f);
  assert.ok(Math.abs(g.karts[2].speed - karts[0].speed) < 1e-9);
});

test('ジャンプ台で飛んでいる間に投げた甲羅は、消さずに、着地したら発射する（2026-10-22 のユーザー依頼）', () => {
  const { karts, world, f } = setup();
  const k = karts[0];
  k.airborne = true;
  k.held = 'shell';
  itemPress(world, karts, 0, f);
  k.orbit = [0, 1, 2];
  itemPress(world, karts, 0, f); // 緑の甲羅も1つ投げる
  assert.equal(world.shells.length, 0, '空中ではまだ出さない');
  assert.equal(k.held, null);
  stepItems(world, karts, f, DT);
  assert.equal(world.shells.length, 0, '着地するまで待つ');
  k.airborne = false;
  stepItems(world, karts, f, DT);
  assert.deepEqual(world.shells.map((s) => s.kind).sort(), ['green', 'red'], '着地したら発射');
  assert.equal(world.shells.find((s) => s.kind === 'red').target, 1);
});

test('Mushroom は3個セット: 3回使える。使い切るまで枠はキノコのまま（次の箱は取れない）（2026-10-22 のユーザー依頼）', () => {
  const { karts, world, f } = setup();
  const k = karts[0];
  k.roulette = 1;
  k.rouletteItem = 'mushroom';
  itemPress(world, karts, 0, f); // ルーレットを止める
  assert.equal(k.held, 'mushroom');
  assert.equal(k.heldUses, 3);
  for (let n = 2; n >= 0; n--) {
    assert.equal(canTake(k), false);
    assert.equal(itemPress(world, karts, 0, f).item, 'mushroom');
    assert.equal(k.heldUses, n);
    assert.equal(k.held, n > 0 ? 'mushroom' : null);
    k.mushroom = 0; // 加速が終わってから次を使う
  }
  assert.equal(k.mushrooms, 3);
  assert.equal(canTake(k), true);
});

test('ルーレットが自然に止まってキノコになっても3個', () => {
  const { karts, world, f } = setup();
  karts[0].roulette = 0.01;
  karts[0].rouletteItem = 'mushroom';
  stepItems(world, karts, f, DT);
  assert.equal(karts[0].heldUses, 3);
});

test('バナナのふらふら（左右の入れ替わり）は、何かでスピンしたら終わる。稲妻の入れ替わりは残る（2026-10-22 のユーザー依頼）', () => {
  const ctl = { steer: 0, throttle: 1, brake: false, drift: false };
  const k = createKart(t, 10, 0);
  initItems(k);
  swapSteer(k, ITEM.BANANA_SWAP);
  k.spin = PHYS.SPIN_TIME;
  stepKart(k, ctl, t, params, 1 / 60);
  assert.equal(k.muddy, 0);
  assert.equal(k.swapItem, false);
});

test('甲羅の速さは、使った車のキャラの最高速の2倍（paramsOf）', () => {
  const { karts, world, f } = setup();
  const fast = { ...params, topSpeed: 46 };
  f.paramsOf = (k) => (k === 0 ? fast : params);
  karts[0].held = 'shell';
  itemPress(world, karts, 0, f);
  assert.equal(world.shells[0].speed, 92);
});

test('空中では、ぶら下げたバナナを置けない（空中にバナナが置かれていた。2026-10-22 のユーザー依頼）', () => {
  const { karts, world, f } = setup();
  const k = karts[0];
  k.trailing = 3;
  k.airborne = true;
  assert.equal(itemPress(world, karts, 0, f), null);
  assert.equal(world.bananas.length, 0);
  assert.equal(k.trailing, 3);
  k.airborne = false;
  assert.equal(itemPress(world, karts, 0, f).type, 'drop');
  assert.equal(world.bananas.length, 1);
});

test('回っている緑の甲羅にふれた車は、甲羅に当たったのと同じく吹き飛ぶ（甲羅は1つ消える。2026-10-22 のユーザー依頼）', () => {
  const { karts, world, f } = setup();
  const a = karts[0];
  const b = karts[1];
  a.orbit = [0, 1, 2];
  a.orbitAngle = 0;
  const ang = ITEM.ORBIT_SPIN * DT; // stepItems の中で、先に回る
  Object.assign(b, { x: a.x + Math.cos(ang) * (ITEM.ORBIT_R + 1), z: a.z + Math.sin(ang) * (ITEM.ORBIT_R + 1), y: a.y });
  const out = stepItems(world, karts, f, DT);
  assert.ok(out.some((e) => e.type === 'blast' && e.k === 1 && e.by === 0), JSON.stringify(out));
  assert.ok(b.blast > 0);
  assert.equal(a.orbit.length, 2);
  assert.equal(a.blast, 0, '自分は吹き飛ばない');
});

test('回っている緑の甲羅に Star の車がふれたら、甲羅だけ消える', () => {
  const { karts, world, f } = setup();
  const a = karts[0];
  const b = karts[1];
  a.orbit = [0];
  a.orbitAngle = 0;
  b.star = 3;
  const ang = ITEM.ORBIT_SPIN * DT;
  Object.assign(b, { x: a.x + Math.cos(ang) * ITEM.ORBIT_R, z: a.z + Math.sin(ang) * ITEM.ORBIT_R, y: a.y });
  stepItems(world, karts, f, DT);
  assert.equal(b.blast, 0);
  assert.equal(a.orbit.length, 0);
});
