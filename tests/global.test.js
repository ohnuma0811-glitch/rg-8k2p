import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, locate, sampleAt } from '../src/game/track.js';
import { createRace, updateProgress, progress, ranking, raceLaps, raceDistance, LAPS } from '../src/game/race.js';
import { COURSE5, COURSES } from '../src/data/tracks.js';

const t = buildTrack(COURSE5);
const L = t.length;
const at = (m) => t.samples[Math.round(t.marks[m]) % L];

test('Global City は5つ目・最後のコース。大会は5レース（2026-10-20 のユーザー依頼）', () => {
  assert.equal(COURSES.length, 5);
  assert.equal(COURSES[4], COURSE5);
  assert.equal(COURSE5.name, 'Global City');
});

test('点は m（全体を scale 倍）: 全長は点から自動。走る道は 12km まで（2026-10-20 のユーザー依頼「目安 12km・5〜6分まで」）。東京駅と東京タワーの間の距離が地図のとおり', () => {
  const m = t.marks;
  const autos = (m.FL - m.AJ) + (m.HL - m.LP) + (m.KL - m.R1); // 大ジャンプ・宇宙・ワープ（自動の区間）
  const drive = t.finish - autos;
  assert.ok(drive > 10000 && drive < 12000, `${drive}`);
  const a = at('TS');
  const b = at('TT');
  const k = COURSE5.scale ?? 1;
  assert.ok(Math.abs(Math.hypot(a.x - b.x, a.z - b.z) - k * Math.hypot(410 - 260, 60 - 420)) < 40);
});

test('片道: ゴールは FIN、END から GB までは無い道（描かない・通れない）。スタートの後ろ 50m には車が並べる', () => {
  assert.equal(t.open, true);
  assert.equal(t.finish, t.marks.FIN);
  assert.ok(!at('END').void);
  const mid = t.samples[Math.round((t.marks.END + t.marks.GB) / 2)];
  assert.equal(mid.void, true);
  assert.equal(mid.y, null);
  for (let d = 1; d <= 50; d++) assert.ok(!t.samples[(L - d) % L].void, `スタートの ${d}m 後ろ`);
});

test('片道の大会: 1回だけ走る。ゴールを越えたらゴール。進んだ距離はスタートからの m', () => {
  assert.equal(raceLaps(t), 1);
  assert.equal(raceDistance(t), t.finish);
  const race = createRace(2);
  updateProgress(race, 0, t, L - 20); // スタートの後ろ
  assert.ok(progress(race, 0, t) < 0);
  for (let s = 0; s <= t.finish + 5; s += 5) updateProgress(race, 0, t, Math.round(s) % L);
  assert.equal(race.entries[0].finished, true);
  updateProgress(race, 1, t, 100);
  assert.deepEqual(ranking(race, t), [0, 1]);
});

test('sampleAt は s の所の位置を、となりの点の間でなめらかに返す', () => {
  const a = sampleAt(t, 100);
  const b = sampleAt(t, 100.5);
  const c = sampleAt(t, 101);
  assert.ok(Math.abs(b.x - (a.x + c.x) / 2) < 0.05 && Math.abs(b.z - (a.z + c.z) / 2) < 0.05);
});

test('ほかのコースは今のまま（3周、無い道なし）', () => {
  for (const c of COURSES.slice(0, 4)) {
    const tr = buildTrack(c);
    assert.equal(raceLaps(tr), LAPS, c.name);
    assert.ok(!tr.samples.some((p) => p.void), c.name);
  }
});

import { stageAt } from '../src/game/track.js';
import { stageText } from '../src/screens.js';

test('7つのステージ: TOKYO・MT. FUJI・KYOTO・HONG KONG・UNDER THE SEA・NEW YORK・KUALA LUMPUR（2026-10-20 のユーザー依頼）', () => {
  assert.deepEqual(t.stages.map((st) => st.name), ['TOKYO', 'MT. FUJI', 'KYOTO', 'HONG KONG', 'UNDER THE SEA', 'NEW YORK', 'KUALA LUMPUR']);
  assert.equal(stageAt(t, -30), 0);
  assert.equal(stageAt(t, t.marks.TT), 0);
  assert.equal(stageAt(t, t.marks.FL + 1), 1);
  assert.equal(stageAt(t, t.marks.KM), 2);
  assert.equal(stageAt(t, t.marks.CEN), 3);
  assert.equal(stageAt(t, t.marks.SD + 50), 4);
  assert.equal(stageAt(t, t.marks.TSQ), 5);
  assert.equal(stageAt(t, t.marks.FIN), 6);
  assert.equal(stageText(t, 3), 'STAGE 4/7 HONG KONG');
});

import { createKart, stepKart } from '../src/game/kart.js';
import { kartParams } from '../src/game/stats.js';
import { pushApart } from '../src/game/collide.js';

const params = kartParams({ accel: 3, top: 3, handling: 3 });
const full = { throttle: 1, brake: 0, steer: 0, drift: false };
// 自動の区間の前から、ハンドルをいっぱいに切ったまま走らせる（自動の間は操作が効かない）
function through(id, seconds) {
  const a = t.autos.find((x) => x.id === id);
  const kart = createKart(t, Math.round(a.from - 30), 0);
  kart.speed = 30;
  const log = [];
  for (let f = 0; f < seconds * 60; f++) {
    stepKart(kart, { ...full, steer: f < 60 ? 0 : 1 }, t, params, 1 / 60);
    log.push({ auto: kart.auto?.id ?? null, s: t.samples[kart.seg].s, err: !!kart.autoError, speed: kart.speed, air: kart.airborne });
  }
  return { kart, log };
}

test('自動の区間は3つ: 大ジャンプ 4秒、宇宙 8秒、ワープ（輪っか3つ + 3秒）', () => {
  assert.deepEqual(t.autos.map((a) => a.id), ['jump', 'space', 'warp']);
  const time = (id) => t.autos.find((a) => a.id === id).legs.reduce((x, l) => x + l.time, 0);
  assert.equal(time('jump'), 4);
  assert.equal(time('space'), 8);
  assert.ok(Math.abs(time('warp') - 4.2) < 1e-9);
});

for (const [id, to, secs] of [['jump', 'FL', 4], ['space', 'HL', 8], ['warp', 'KL', 4.2]]) {
  test(`${id}: 操作は効かず、決まった時間で ${to} に出る。出たら地面の上で、入る前の速さ`, () => {
    const { log } = through(id, secs + 3);
    const inAuto = log.filter((x) => x.auto === id).length / 60;
    assert.ok(Math.abs(inAuto - secs) < 0.1, `${inAuto}`);
    const first = log.findIndex((x) => x.auto === id);
    const out = log.findIndex((x, k) => k > 0 && log[k - 1].auto === id && x.auto === null);
    assert.ok(out > 0);
    assert.ok(Math.abs(log[out].s - t.marks[to]) < 3, `${log[out].s}`);
    assert.ok(!log[out].air, '浮いている');
    assert.ok(Math.abs(log[out].speed - log[first - 1].speed) < 3);
    for (let k = first + 1; k < out; k++) assert.ok(log[k].s >= log[k - 1].s - 0.01, '自動の区間で戻った');
  });
}

test('ワープ: 1つ目の輪っかから自動。3つ目の輪っかのあとは「ERROR」（2026-10-20 のユーザー依頼）', () => {
  const { log } = through('warp', 6);
  const first = log.findIndex((x) => x.auto === 'warp');
  assert.ok(Math.abs(log[first].s - t.marks.R1) < 3);
  const err = log.find((x) => x.err);
  assert.ok(err && err.s >= t.marks.R3 - 1);
});

test('自動の区間の間は、ほかの車に当たらない（押し合わない）', () => {
  const i = Math.round(t.marks.HL) - 400;
  const a = createKart(t, i, 0);
  const b = createKart(t, i, 1);
  a.auto = { id: 'space', leg: 0, t: 1, from: 0, speedIn: 30 };
  const before = [{ ...a }, { ...b }];
  pushApart([a, b], before);
  assert.equal(a.x, before[0].x);
  assert.equal(b.x, before[1].x);
});

test('自動の区間の前後で、2台の差（s）は変わらない（同じ時間で進むので順位はそのまま）', () => {
  const a = t.autos.find((x) => x.id === 'space');
  const k1 = createKart(t, Math.round(a.from - 40), 0);
  const k2 = createKart(t, Math.round(a.from - 80), 0);
  k1.speed = k2.speed = 30;
  for (let f = 0; f < 60 * 14; f++) {
    stepKart(k1, full, t, params, 1 / 60);
    stepKart(k2, full, t, params, 1 / 60);
  }
  const gap = t.samples[k1.seg].s - t.samples[k2.seg].s;
  assert.ok(gap > 20 && gap < 70, `${gap}`);
});

import { minimapPaths, minimapDashes } from '../src/render/minimap.js';

test('道のはしでは、前にもうしろにも、それより先へ行けない（無い道に入らない）', () => {
  const end = createKart(t, Math.round(t.marks.END) - 20, 0);
  end.speed = 40;
  for (let f = 0; f < 120; f++) stepKart(end, full, t, params, 1 / 60);
  assert.ok(!t.samples[end.seg].void && !(end.respawn > 0), '道の終わりの先');
  const back = createKart(t, (L - 40) % L, 0);
  back.heading += Math.PI;
  back.move = back.heading;
  back.speed = 15;
  for (let f = 0; f < 240; f++) stepKart(back, full, t, params, 1 / 60);
  assert.ok(!t.samples[back.seg].void && !(back.respawn > 0), 'スタートの後ろの先');
});

test('コースマップ: 無い道と自動の区間は道としては描かない。自動の区間は点線（3本）', () => {
  for (const ps of minimapPaths(t)) for (const p of ps) assert.ok(!p.void && !p.auto);
  assert.equal(minimapDashes(t).length, 3);
});

import { stageVisible } from '../src/game/world.js';
import { skyFor } from '../src/render/world/sky.js';
import { terrainHeight } from '../src/render/terrain.js';

test('ステージの景色は、今のステージとその前後だけ見える。宇宙・ワープの間は、その景色だけ', () => {
  assert.equal(stageVisible([3], 3, null), true);
  assert.equal(stageVisible([3], 4, null), true);
  assert.equal(stageVisible([3], 5, null), false);
  assert.equal(stageVisible([0, 1, 2], 2, null), true); // 富士山の山は東京〜京都
  assert.equal(stageVisible([2], 2, 'space'), false);
  assert.equal(stageVisible(['space'], 2, 'space'), true);
  assert.equal(stageVisible(['space'], 2, null), false);
});

test('空: 東京は春の青空、香港は夜、海の底は青い水、宇宙は黒（高さ 150 より上）、ワープは光のトンネル', () => {
  assert.equal(skyFor(t, 0, { y: 0, auto: null }).mode, 'normal');
  assert.ok(skyFor(t, 3, { y: 0, auto: null }).sky < 0x202040);
  assert.equal(skyFor(t, 4, { y: -30, auto: null }).mode, 'sea');
  assert.equal(skyFor(t, 2, { y: 400, auto: { id: 'space' } }).mode, 'space');
  assert.equal(skyFor(t, 5, { y: 100, auto: { id: 'warp' } }).mode, 'warp');
});

test('地面: 富士山のまわりだけ高さがある（富士山の頂上は 500m 以上）。ほかは平ら', () => {
  const fuji = t.toWorld(-900, 600);
  assert.ok(terrainHeight(t, fuji.x, fuji.z) > 500);
  const ny = t.toWorld(500, 2200);
  assert.equal(terrainHeight(t, ny.x, ny.z), 0);
});

import { buildTokyo } from '../src/render/world/tokyo.js';

// 名所の印（userData.landmark）の位置
const landmarks = (g) => { const m = new Map(); g.updateMatrixWorld(true); g.traverse((o) => { if (o.userData.landmark) m.set(o.userData.landmark, o.getWorldPosition(o.position.clone())); }); return m; };

test('東京の景色の形に、数でない座標（NaN）がない（あると、その形がまるごと描かれない）', () => {
  buildTokyo(t).traverse((o) => {
    if (!o.isMesh) return;
    const a = o.geometry.attributes.position.array;
    for (let i = 0; i < a.length; i++) assert.ok(Number.isFinite(a[i]), `${o.parent.userData.stages}`);
  });
});

test('東京の名所: 皇居・二重橋・桜並木・新丸ビル・東京駅・東京タワー・新幹線の線路・レインボーブリッジ・フジテレビ・巨大ジャンプ台', () => {
  const m = landmarks(buildTokyo(t));
  for (const name of ['palace', 'nijubashi', 'sakura', 'shinmaru', 'tokyoStation', 'tokyoTower', 'shinkansenLine', 'rainbowBridge', 'fujiTV', 'bigJump']) assert.ok(m.has(name), name);
  for (const name of ['palace', 'shinmaru', 'tokyoStation', 'tokyoTower', 'fujiTV']) {
    const p = m.get(name);
    const loc = locate(t, p.x, p.z, null, 40);
    assert.ok(Math.abs(loc.lateral) > loc.wall + 2, `${name} が道の上`);
  }
});

test('方角: 東京駅は丸の内の東、東京タワーは皇居の南、フジテレビはお台場の道の右（北）、富士山はお台場の道の正面（西）', () => {
  const m = landmarks(buildTokyo(t));
  assert.ok(m.get('tokyoStation').x > m.get('shinmaru').x);
  assert.ok(m.get('tokyoTower').z > m.get('palace').z);
  const p = at('FTV');
  assert.ok(Math.cos(p.h) < -0.95, 'お台場の道は西向き');
  assert.ok(m.get('fujiTV').z < p.z, 'フジテレビは北（右）');
  assert.ok(t.toWorld(-900, 600).x < p.x, '富士山は西');
});

test('大ジャンプ・宇宙・ワープの空の道すじは、地面を引き上げない（富士山の地面の上に、細長い山ができない）', () => {
  for (let s = t.marks.AJ + 50; s < t.marks.FL - 50; s += 25) {
    const p = t.samples[Math.round(s)];
    if (p.y < 60) continue;
    assert.ok(terrainHeight(t, p.x, p.z) < p.y - 40, `${Math.round(s)}: 地面 ${terrainHeight(t, p.x, p.z).toFixed(0)} 空の道 ${p.y.toFixed(0)}`);
  }
});

test('高さのある地面の四角（terrainBox）のはしでは、地面は平ら（富士山のすそ野が切れて崖にならない）', () => {
  const [x0, z0, x1, z1] = COURSE5.terrainBox;
  for (let k = 0; k <= 40; k++) {
    const u = k / 40;
    for (const [x, z] of [[x0 + (x1 - x0) * u, z0], [x0 + (x1 - x0) * u, z1], [x0, z0 + (z1 - z0) * u], [x1, z0 + (z1 - z0) * u]]) {
      const w = t.toWorld(x, z);
      const loc = locate(t, w.x, w.z, null, 40);
      if (Math.abs(loc.lateral) < loc.wall + 60) continue; // 道の近くは道の高さ
      assert.ok(terrainHeight(t, w.x - 1, w.z - 1) < 3, `${x.toFixed(0)},${z.toFixed(0)}: ${terrainHeight(t, w.x - 1, w.z - 1).toFixed(1)}`);
    }
  }
});
