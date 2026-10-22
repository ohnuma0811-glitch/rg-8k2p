import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { COURSES } from '../src/data/tracks.js';
import { createKart } from '../src/game/kart.js';
import { kartParams } from '../src/game/stats.js';
import { initItems, createItemWorld, ITEM } from '../src/game/items.js';
import { launchShell, stepShells, guard, SHELL } from '../src/game/shells.js';

const params = kartParams({ accel: 3, top: 3, handling: 3 });
const DT = 1 / 60;
const kampar = buildTrack(COURSES[1]);
function kartAt(t, i, lat = 0) {
  const k = createKart(t, i, lat);
  initItems(k);
  return k;
}
function fly(world, karts, sec) {
  const out = [];
  for (let s = 0; s < sec && world.shells.length; s += DT) out.push(...stepShells(world, karts, DT));
  return out;
}

test('赤の甲羅: 道にそって、ひとつ前の車を追いかけて当たる。当たった車は吹き飛ぶ', () => {
  const t = kampar;
  const me = kartAt(t, 100);
  const target = kartAt(t, 400, 3); // 300m 先（カーブの先）
  const world = createItemWorld(t);
  launchShell(world, me, 0, 'red', 1, params.topSpeed);
  const out = fly(world, [me, target], 8);
  assert.ok(out.some((e) => e.type === 'blast' && e.k === 1), JSON.stringify(out));
  assert.ok(target.blast > 0);
  assert.equal(world.shells.length, 0);
});

test('赤の甲羅は、相手のいる分かれ道へ進む（Soki Forest の内側の道）', () => {
  const t = buildTrack(COURSES[2]);
  const inner = t.paths.find((p) => p.id === 'inner');
  const me = kartAt(t, inner.fork - 60); // 内側の道は「中の道」の途中から分かれる（fork は点の番号）
  const target = kartAt(t, inner.start + 120);
  const world = createItemWorld(t);
  launchShell(world, me, 0, 'red', 1, params.topSpeed);
  const out = fly(world, [me, target], 10);
  assert.ok(out.some((e) => e.type === 'blast' && e.k === 1));
});

test('前に車がいない赤の甲羅は、前にまっすぐ飛び、5秒か柵で消える', () => {
  const t = kampar;
  const me = kartAt(t, 100);
  const world = createItemWorld(t);
  launchShell(world, me, 0, 'red', null, params.topSpeed);
  fly(world, [me], SHELL.LIFE + 0.1);
  assert.equal(world.shells.length, 0);
});

test('緑の甲羅: まっすぐ飛び、柵ではね返る。4回目に当たるか5秒で消える', () => {
  const t = kampar;
  const me = kartAt(t, 100);
  me.heading += 1.2; // 柵へ向けて投げる
  const world = createItemWorld(t);
  const s = launchShell(world, me, 0, 'green', null, params.topSpeed);
  let maxB = 0;
  for (let k = 0; k < 5 / DT && world.shells.length; k++) {
    stepShells(world, [me], DT);
    maxB = Math.max(maxB, s.bounces);
  }
  assert.ok(maxB >= 1, 'はね返った');
  assert.ok(maxB <= SHELL.BOUNCES);
  assert.equal(world.shells.length, 0);
});

test('緑の甲羅は、投げて0.5秒は自分に当たらない。そのあとは自分にも当たる', () => {
  const t = kampar;
  const me = kartAt(t, 100);
  const world = createItemWorld(t);
  const s = launchShell(world, me, 0, 'green', null, params.topSpeed);
  Object.assign(s, { x: me.x, z: me.z });
  assert.deepEqual(stepShells(world, [me], 0), []);
  s.age = SHELL.OWNER_SAFE + 0.01;
  Object.assign(s, { x: me.x, z: me.z, done: false });
  assert.deepEqual(stepShells(world, [me], 0).map((e) => e.type), ['blast']);
});

test('甲羅はジャンプ台を越えられず消える（Kenta Circuit。ジャンプの先の相手には届かない）', () => {
  const t = buildTrack(COURSES[0]);
  const ramp = t.samples.findIndex((p) => p.ramp && p.path === 0);
  const me = kartAt(t, (ramp - 60 + t.length) % t.length);
  let far = ramp;
  while (t.samples[far].ramp || t.samples[far].y === null) far = t.samples[far].next;
  const target = kartAt(t, (far + 60) % t.length); // ジャンプの着地の先
  const world = createItemWorld(t);
  const s = launchShell(world, me, 0, 'red', 1, params.topSpeed);
  for (let k = 0; k < 300 && world.shells.length; k++) stepShells(world, [me, target], DT);
  assert.equal(world.shells.length, 0);
  assert.equal(target.blast, 0, '相手には届かない');
  assert.ok(t.samples[s.seg].ramp, `ジャンプ台の上で消えた（点 ${s.seg}）`);
});

test('甲羅は障害物をすり抜ける（牛のいる Kampar Town でも、相手まで届く。stepShells は車・バナナ・回る甲羅だけを見る）', () => {
  const t = kampar;
  const me = kartAt(t, 100);
  const target = kartAt(t, 200);
  const world = createItemWorld(t);
  launchShell(world, me, 0, 'red', 1, params.topSpeed);
  const out = fly(world, [me, target], 5);
  assert.ok(out.some((e) => e.type === 'blast' && e.k === 1));
});

test('甲羅は、自動の区間・無い道に入ったら消える（World Cities）', () => {
  const t = buildTrack(COURSES[4]);
  const me = kartAt(t, t.marks.AJ - 30);
  const world = createItemWorld(t);
  launchShell(world, me, 0, 'red', null, params.topSpeed);
  for (let k = 0; k < 120 && world.shells.length; k++) stepShells(world, [me], DT);
  assert.equal(world.shells.length, 0);
  const end = kartAt(t, t.marks.END - 20);
  launchShell(world, end, 0, 'red', null, params.topSpeed);
  for (let k = 0; k < 300 && world.shells.length; k++) stepShells(world, [end], DT);
  assert.equal(world.shells.length, 0);
});

test('自動の区間の車・Star の車: 自動の区間は当たらない。Star は甲羅だけが消える', () => {
  const t = kampar;
  const me = kartAt(t, 100);
  const a = kartAt(t, 130);
  const world = createItemWorld(t);
  const s = launchShell(world, me, 0, 'green', null, params.topSpeed);
  Object.assign(s, { x: a.x, z: a.z });
  a.auto = { id: 'jump' };
  assert.deepEqual(stepShells(world, [me, a], 0), []);
  a.auto = null;
  a.star = 3;
  assert.deepEqual(stepShells(world, [me, a], 0).map((e) => e.type), ['starBlock']);
  assert.equal(a.blast, 0);
});

test('甲羅が置かれたバナナに当たると、両方とも消える', () => {
  const t = kampar;
  const me = kartAt(t, 100);
  const world = createItemWorld(t);
  const s = launchShell(world, me, 0, 'green', null, params.topSpeed);
  world.bananas.push({ id: 50, owner: 0, x: s.x, y: s.y, z: s.z, age: 5 });
  stepShells(world, [me], 0);
  assert.equal(world.shells.length, 0);
  assert.equal(world.bananas.length, 0);
});

test('守り: 回る甲羅は向きで決まる（3つは必ず、2つは 2/3、1つは 1/3 の向き）。ふせいだら1つ消える', () => {
  const count = (slots) => {
    let blocked = 0;
    for (let d = 0; d < 360; d++) {
      const k = { heading: 0, orbitAngle: 0, orbit: [...slots], trailing: false };
      if (guard(k, (d * Math.PI) / 180, true)) blocked++;
    }
    return blocked;
  };
  assert.equal(count([0, 1, 2]), 360);
  assert.ok(Math.abs(count([0, 1]) - 240) <= 2);
  assert.ok(Math.abs(count([0]) - 120) <= 2);
  const k = { heading: 0, orbitAngle: 0, orbit: [0, 1, 2], trailing: false };
  assert.equal(guard(k, 0, true), 'orbit');
  assert.deepEqual(k.orbit, [1, 2], '前（0度）の甲羅が消えた');
  assert.equal(k.blocked, 1);
});

test('守り: ぶら下げたバナナは、後ろから来た甲羅を必ずふせぐ（前からは、ふせがない。バナナにはきかない）', () => {
  const k = { heading: 0, orbitAngle: 0, orbit: [], trailing: true };
  assert.equal(guard(k, 0, true), null);
  assert.equal(guard(k, Math.PI, false), null);
  assert.equal(guard(k, Math.PI, true), 'trail');
  assert.equal(k.trailing, false);
});

test('回る甲羅がある車へ飛んできた甲羅は、回る甲羅の所で、向きが合えばふせがれる', () => {
  const t = kampar;
  const me = kartAt(t, 100);
  const b = kartAt(t, 160);
  b.orbit = [0, 1, 2];
  const world = createItemWorld(t);
  launchShell(world, me, 0, 'red', 1, params.topSpeed);
  const out = fly(world, [me, b], 5);
  assert.ok(out.some((e) => e.type === 'blocked' && e.k === 1));
  assert.equal(b.blast, 0);
  assert.equal(b.orbit.length, 2);
});
