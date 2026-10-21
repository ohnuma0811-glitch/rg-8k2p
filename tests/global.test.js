import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, locate, sampleAt, markS } from '../src/game/track.js';
import { readFileSync } from 'node:fs';
import { GLOBAL_SCENERY } from '../src/data/global.js';
import { createRace, updateProgress, progress, ranking, raceLaps, raceDistance, LAPS } from '../src/game/race.js';
import { COURSE5, COURSES } from '../src/data/tracks.js';

const t = buildTrack(COURSE5);
const L = t.length;
const at = (m) => t.samples[Math.round(t.marks[m]) % L];

test('Global City は5つ目・最後のコース。大会は5レース（2026-10-20 のユーザー依頼）', () => {
  assert.equal(COURSES.length, 5);
  assert.equal(COURSES[4], COURSE5);
  assert.equal(COURSE5.name, 'World Cities'); // 2026-10-22 のユーザー依頼で Global City から変更
});

test('点は m（全体を scale 倍）: 全長は点から自動。走る道は 12km まで（2026-10-20 のユーザー依頼「目安 12km・5〜6分まで」）。東京駅と東京タワーの間の距離が地図のとおり', () => {
  const m = t.marks;
  const autos = (m.FL - m.AJ) + (m.HL - m.LP) + (m.KL - m.R1) + (t.finish - m.GJ); // 大ジャンプ・宇宙・ワープ・最後の大ジャンプ（ゴールまで）（自動の区間）
  const drive = t.finish - autos;
  // カーブを増やしたので 12.5km まで（2026-10-21 のユーザー依頼「直線で戦略性が無い」。最後のコースなので多少長くても良い）
  assert.ok(drive > 10000 && drive < 12500, `${drive}`);
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

test('自動の区間は6つ: 大ジャンプ 4秒、宇宙 8秒、ワープ（輪っか3つ + 9秒）、バトゥ洞窟へのジャンプ、洞窟の出口からの飛び降り、最後の大ジャンプ', () => {
  assert.deepEqual(t.autos.map((a) => a.id), ['jump', 'space', 'warp', 'batuJump', 'caveDrop', 'goalJump']);
  const time = (id) => t.autos.find((a) => a.id === id).legs.reduce((x, l) => x + l.time, 0);
  assert.equal(time('jump'), 4);
  assert.equal(time('space'), 8);
  assert.ok(Math.abs(time('warp') - 10.2) < 1e-9); // ワープは約10秒（2026-10-21 のユーザー依頼「もっと壮大に」）
});

for (const [id, to, secs] of [['jump', 'FL', 4], ['space', 'HL', 8], ['warp', 'KL', 10.2]]) {
  test(`${id}: 操作は効かず、決まった時間で ${to} に出る。出たら地面の上で、入る前の速さ`, () => {
    const { log } = through(id, secs + 3);
    const inAuto = log.filter((x) => x.auto === id).length / 60;
    assert.ok(Math.abs(inAuto - secs) < 0.1, `${inAuto}`);
    const first = log.findIndex((x) => x.auto === id);
    const out = log.findIndex((x, k) => k > 0 && log[k - 1].auto === id && x.auto === null);
    assert.ok(out > 0);
    assert.ok(Math.abs(log[out].s - t.marks[to]) < 3, `${log[out].s}`);
    assert.ok(!log[out].air, '浮いている');
    if (id === 'warp') assert.ok(log[out].speed >= log[first - 1].speed - 0.5, 'ワープのあとは最高速度のまま（2026-10-21 のユーザー依頼）');
    else assert.ok(Math.abs(log[out].speed - log[first - 1].speed) < 3);
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
  // 2台とも、発射台の手前の加速板（2026-10-21）を過ぎた所から
  const k1 = createKart(t, Math.round(a.from - 20), 0);
  const k2 = createKart(t, Math.round(a.from - 55), 0);
  k1.speed = k2.speed = 30;
  // 2台目が自動の区間を出たときに比べる（そのあとハンドルを切らずに走ると、壁にぶつかって差が変わる）
  let was = false;
  for (let f = 0; f < 60 * 14; f++) {
    stepKart(k1, full, t, params, 1 / 60);
    stepKart(k2, full, t, params, 1 / 60);
    if (k2.auto) was = true;
    else if (was) break;
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

test('コースマップ: 無い道と自動の区間は道としては描かない。自動の区間は点線（6本）', () => {
  for (const ps of minimapPaths(t)) for (const p of ps) assert.ok(!p.void && !p.auto);
  assert.equal(minimapDashes(t).length, 6);
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
  assert.equal(skyFor(t, 5, { y: 100, auto: { id: 'warp', leg: 2 } }).mode, 'warp');
});

test('地面: 富士山のまわりだけ高さがある（富士山の頂上は 500m 以上）。ほかは平ら', () => {
  const fuji = t.toWorld(-900, 300);
  assert.ok(terrainHeight(t, fuji.x, fuji.z) > 500);
  const ny = t.toWorld(500, 2200);
  assert.equal(terrainHeight(t, ny.x, ny.z), 0);
});

import { buildTokyo } from '../src/render/world/tokyo.js';

// 名所の印（userData.landmark）の位置
const landmarks = (g) => { const m = new Map(); g.updateMatrixWorld(true); g.traverse((o) => { if (o.userData.landmark) m.set(o.userData.landmark, o.getWorldPosition(o.position.clone())); }); return m; };

test('景色の形に、数でない座標（NaN）がない（あると、その形がまるごと描かれない）', async () => {
  const { buildFuji } = await import('../src/render/world/fuji.js');
  const { buildKyoto } = await import('../src/render/world/kyoto.js');
  const { buildLaunchRail } = await import('../src/render/world/space.js');
  const { buildHongKong } = await import('../src/render/world/hongkong.js');
  const { buildSea } = await import('../src/render/world/sea.js');
  const { buildNewYork } = await import('../src/render/world/newyork.js');
  const { buildKL } = await import('../src/render/world/kl.js');
  for (const build of [buildTokyo, buildFuji, buildKyoto, buildLaunchRail, buildSpace, buildHongKong, buildSea, buildNewYork, buildKL]) build(t).traverse((o) => {
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
  assert.ok(t.toWorld(-900, 300).x < p.x, '富士山は西');
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

import { buildKyoto } from '../src/render/world/kyoto.js';
import { SHINKANSEN_FACTOR } from '../src/game/world.js';

test('新幹線と並走: 加速板が並ぶ。加速板に乗れば新幹線より速く、乗らなければ遅い（2026-10-20 のユーザー依頼）', () => {
  const pads = t.samples.slice(0, L).filter((p) => p.boost && p.s > t.marks.SK && p.s < t.marks.KT);
  assert.ok(pads.length >= 30, `${pads.length}`);
  assert.ok(1.3 > SHINKANSEN_FACTOR && SHINKANSEN_FACTOR > 1);
});

test('清水の舞台: 舞台のはしからジャンプして、必ず谷の道に着地する（落ちない）', () => {
  const k = createKart(t, Math.round(t.marks.KM) - 60, 0);
  k.speed = 20;
  let air = false;
  for (let f = 0; f < 60 * 6; f++) {
    stepKart(k, full, t, params, 1 / 60);
    if (k.airborne) air = true;
    assert.ok(!(k.respawn > 0), '落ちた');
  }
  assert.ok(air, '飛んでいない');
  assert.ok(t.samples[k.seg].s > t.marks.KM + 20);
});

test('京都の名所（東から時計回り）: 伏見稲荷の鳥居 → 清水寺 → 八坂の五重塔・祇園 → 銀閣寺 → 金閣寺 → 嵐山の竹林', () => {
  const m = landmarks(buildKyoto(t));
  for (const name of ['toriiTunnel', 'kiyomizu', 'yasakaPagoda', 'gion', 'ginkaku', 'kinkaku', 'bamboo']) assert.ok(m.has(name), name);
  assert.ok(m.get('kinkaku').x < m.get('ginkaku').x, '金閣寺は銀閣寺の西');
  assert.ok(m.get('toriiTunnel').z > m.get('ginkaku').z, '伏見稲荷は銀閣寺の南');
  assert.ok(m.get('bamboo').x < m.get('kinkaku').x, '嵐山は金閣寺の西');
});

test('トンネル: Kyugo Mountain のトンネルは今のまま暗い。京都へ抜ける山のトンネルは暗くしない', () => {
  const k4 = buildTrack(COURSES[3]);
  assert.ok(k4.samples.some((p) => p.tunnel));
  assert.ok(!t.samples.slice(0, L).some((p) => p.tunnel && p.s > t.marks.SK && p.s < t.marks.KY));
});

test('景色の木・竹・桜は、道の上に立たない（道の真ん中から、柵より内がわに幹がない）', async () => {
  const { buildKyoto } = await import('../src/render/world/kyoto.js');
  const { buildFuji } = await import('../src/render/world/fuji.js');
  for (const build of [buildTokyo, buildFuji, buildKyoto]) {
    build(t).traverse((o) => {
      if (!o.isMesh) return;
      const a = o.geometry.attributes.position.array;
      const c = o.geometry.attributes.color?.array;
      if (!c) return;
      // 竹（緑の細い幹）の根もと: 高さ 0 の緑の点
      const seen = new Set();
      for (let i = 0; i < a.length; i += 3) {
        if (Math.abs(a[i + 1]) > 0.01 || !(c[i + 1] > c[i] * 1.3 && c[i + 1] > c[i + 2] * 1.3 && c[i + 1] > 0.15)) continue;
        const key = `${Math.round(a[i])},${Math.round(a[i + 2])}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const loc = locate(t, a[i], a[i + 2], null, 40);
        assert.ok(Math.abs(loc.lateral) > loc.half, `${build.name}: ${a[i].toFixed(0)},${a[i + 2].toFixed(0)}`);
      }
    });
  }
});

test('高さのある地面（土手もふくむ）は、空の道すじにそって空へのびない（150m より上は富士山のまわりだけ）', async () => {
  const { buildTerrain } = await import('../src/render/terrain.js');
  const fuji = t.toWorld(-900, 300);
  buildTerrain(t).traverse((o) => {
    if (!o.isMesh) return;
    const a = o.geometry.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) {
      if (a[i + 1] < 150) continue;
      assert.ok(Math.hypot(a[i] - fuji.x, a[i + 2] - fuji.z) < 600, `${a[i].toFixed(0)},${a[i + 1].toFixed(0)},${a[i + 2].toFixed(0)}`);
    }
  });
});

import { busPose } from '../src/game/hazards.js';
import { buildHongKong } from '../src/render/world/hongkong.js';
import { buildSpace, buildLaunchRail } from '../src/render/world/space.js';

test('乗り物は、その範囲の中だけを走る（香港の路面電車は香港、NY のタクシーは NY）', () => {
  const trams = t.buses.filter((b) => b.kind === 'tram');
  const taxis = t.buses.filter((b) => b.kind === 'taxi');
  assert.equal(trams.length, 5); // 向かってくる 3台 ＋ 同じ向き 2台（2026-10-21）
  assert.equal(taxis.length, 27); // 向かってくる 15台 ＋ 同じ向き 12台（5倍の 45台から 3/5 に。2026-10-22 のユーザー依頼）
  for (let time = 0; time < 120; time += 0.7) {
    for (const b of trams) {
      const s = busPose(t, b, time).s;
      assert.ok(s >= t.marks.HL && s <= t.marks.SD, `${s}`);
    }
  }
});

test('宇宙: 星・地球・月・いん石がある。発射台のレールは、最後は約70度の上り', () => {
  const m = landmarks(buildSpace(t));
  for (const name of ['stars', 'earth', 'moon', 'meteors']) assert.ok(m.has(name), name);
  let steep = 0;
  for (let i = Math.round(t.marks.LP); i < Math.round(t.marks.LP) + 70; i++) {
    const a = t.samples[i];
    const b = t.samples[i + 1];
    steep = Math.max(steep, (b.y - a.y) / Math.hypot(b.x - a.x, b.z - a.z));
  }
  assert.ok(steep > 2, `${steep}`); // tan 70度 ≒ 2.7
});

test('香港の名所: 中環の高層ビル・中国銀行タワー・IFC・ネオンの看板・ビクトリア湾（北がわ）', () => {
  const m = landmarks(buildHongKong(t));
  for (const name of ['central', 'bocTower', 'ifc', 'neon', 'harbour']) assert.ok(m.has(name), name);
  assert.ok(m.get('harbour').z < at('CEN').z, '湾は北');
});

import { buildSea } from '../src/render/world/sea.js';
import { buildNewYork } from '../src/render/world/newyork.js';

test('海の底: ガラスのトンネル（暗くしない）。クジラ・サメ・魚の群れ・しずんだ船。自由の女神の足もとに出る', () => {
  const m = landmarks(buildSea(t));
  for (const name of ['whale', 'shark', 'fish', 'wreck', 'liberty']) assert.ok(m.has(name), name);
  const p = t.samples[Math.round((t.marks.SD + t.marks.LIB) / 2)];
  assert.ok(p.y < -20);
  assert.ok(!p.tunnel, '海の底は暗くしない');
  assert.equal(p.tunnelLook, 'glass');
});

test('ニューヨーク: 曲がる角はすべて直角（16）。名所は南から北へ。ジョージ・ワシントン・ブリッジは西（ハドソン川）', () => {
  assert.equal(t.corners.length, 16); // ビルの間を右に左に（2026-10-21 のユーザー依頼）
  const m = landmarks(buildNewYork(t));
  for (const name of ['timesSquare', 'jefferies', 'uniqlo', 'tiffany', 'centralPark', 'gwb', 'ikueiGate', 'ring1', 'ring2', 'ring3']) assert.ok(m.has(name), name);
  assert.ok(m.get('timesSquare').z > m.get('centralPark').z, 'タイムズスクエアはセントラルパークの南');
  assert.ok(m.get('gwb').x < m.get('centralPark').x, 'ジョージ・ワシントン・ブリッジは西');
  assert.ok(Math.hypot(m.get('ring1').x - at('R1').x, m.get('ring1').z - at('R1').z) < 3, '1つ目の輪っかは R1');
});

import { hasTunnels } from '../src/render/trackMesh.js';

test('トンネルの形は、雪山だけでなく、トンネルのあるコース（Global City の山の岩・海の底のガラス）にも作る', () => {
  assert.equal(hasTunnels(t), true);
  assert.equal(hasTunnels(buildTrack(COURSES[0])), false);
});

import { buildTunnel } from '../src/render/snow/tunnel.js';

test('海の底のガラスのトンネルは半円（2026-10-20 のユーザー依頼）: てっぺんは道から道の半分のはばくらいの高さ', () => {
  let glass = null;
  buildTunnel(t).traverse((o) => { if (o.isMesh && o.material?.transparent && o.material.opacity < 0.5) glass = o; });
  const p = t.samples[Math.round((t.marks.SD + t.marks.LIB) / 2)];
  const a = glass.geometry.attributes.position;
  let top = -Infinity;
  for (let k = 0; k < a.count; k++) if (Math.hypot(a.getX(k) - p.x, a.getZ(k) - p.z) < p.wall + 3) top = Math.max(top, a.getY(k));
  assert.ok(top > p.y + p.wall - 1, `${top - p.y}`);
});

import { buildKL } from '../src/render/world/kl.js';
import { buildWarp } from '../src/render/world/warp.js';
import { showcaseCamera } from '../src/render/showcase.js';

test('クアラルンプール: ピンクモスクの中を通る → バトゥ洞窟の中を通る（暗い）→ ペトロナスの前でゴール。方角のとおり', () => {
  const m = landmarks(buildKL(t));
  for (const name of ['pinkMosque', 'batuCaves', 'muruganStatue', 'rainbowStairs', 'petronas']) assert.ok(m.has(name), name);
  assert.ok(m.get('pinkMosque').z > m.get('petronas').z, 'モスクは南');
  assert.ok(m.get('batuCaves').x < m.get('petronas').x && m.get('batuCaves').z < m.get('petronas').z, '洞窟は北西');
  assert.ok(at('BC').tunnel, 'バトゥ洞窟の中は暗い');
  assert.equal(at('PM').tunnelLook, 'mosque');
  assert.ok(!at('PM').tunnel, 'モスクの中は暗くしない');
});

test('ワープの景色は、ワープの間だけ・カメラについていく', () => {
  const w = buildWarp(t).children[0];
  assert.deepEqual(w.userData.stages, ['warp']);
  assert.equal(w.userData.followCamera, true);
});

test('コースの外観は、クアラルンプールだけ。ペトロナスのまわりを回る', async () => {
  assert.deepEqual(COURSE5.showcase, { at: 'FIN', r: 260, h: 140 });
  const THREE = await import('../vendor/three.module.min.js');
  const cam = new THREE.PerspectiveCamera();
  const f = t.samples[t.marks.FIN];
  for (const time of [0, 3, 10]) {
    showcaseCamera(cam, t, time);
    assert.ok(Math.abs(Math.hypot(cam.position.x - f.x, cam.position.z - f.z) - 260) < 1);
    assert.ok(Math.abs(cam.position.y - (f.y + 140)) < 1);
  }
});

import { autoViewOf } from '../src/game/world.js';

test('ワープの景色は3つ目の輪っか（R3）を過ぎてから。輪っかの間はニューヨークと輪っかが見える', () => {
  assert.equal(autoViewOf({ auto: { id: 'warp', leg: 0 }, y: 0 }), null);
  assert.equal(autoViewOf({ auto: { id: 'warp', leg: 1 }, y: 0 }), null);
  assert.equal(autoViewOf({ auto: { id: 'warp', leg: 2 }, y: 0 }), 'warp');
  assert.equal(autoViewOf({ auto: { id: 'space', leg: 0, t: 0.5 }, y: 100 }), null); // 発射台のレールを上っている所
  assert.equal(autoViewOf({ auto: { id: 'space', leg: 0, t: 6 }, y: 100 }), 'space'); // 宇宙を出るまで、宇宙だけ（香港の道が見えない。2026-10-21 のユーザー依頼）
  assert.equal(autoViewOf({ auto: { id: 'space', leg: 0 }, y: 200 }), 'space');
  assert.equal(autoViewOf({ auto: null, y: 0 }), null);
  assert.equal(skyFor(t, 5, { auto: { id: 'warp', leg: 0 }, y: 0 }).mode, 'normal');
  assert.equal(skyFor(t, 5, { auto: { id: 'warp', leg: 2 }, y: 0 }).mode, 'warp');
});

import { createCpu, cpuControl, cpuParams } from '../src/game/cpu.js';
import { busContact } from '../src/game/hazards.js';
import { PHYS } from '../src/game/kart.js';

test('CPU がスタートからゴールまで走りきる（自動の区間・直角の角・清水の舞台・海の底の坂・乗り物）。7分以内。止まらない', () => {
  for (const seed of [0, 1, 2]) {
    const kart = createKart(t, 0, seed % 2 ? 4 : -4);
    const cpu = createCpu(1, seed);
    let time = 0;
    let best = 0;
    let bestAt = 0;
    for (let f = 0; f < 60 * 420; f++) {
      stepKart(kart, cpuControl(cpu, kart, t, time), t, cpuParams(params, 1), 1 / 60);
      busContact(kart, t, time, PHYS);
      time += 1 / 60;
      const s = t.samples[kart.seg].s;
      if (s > best + 15) { best = s; bestAt = time; }
      assert.ok(time - bestAt < 8, `seed ${seed}: s ${Math.round(s)} で止まった`);
      if (s >= t.marks.FIN) break;
    }
    assert.ok(t.samples[kart.seg].s >= t.marks.FIN, `seed ${seed}: s ${Math.round(t.samples[kart.seg].s)} / ${Math.round(t.marks.FIN)}`);
  }
});

test('軽さ: ステージごとに見える景色（そのステージと前後）の三角は 17万まで（道・トンネルを足して 30万まで）', async () => {
  const { buildTerrain } = await import('../src/render/terrain.js');
  const { buildFuji } = await import('../src/render/world/fuji.js');
  const { buildLaunchRail } = await import('../src/render/world/space.js');
  const tri = (o) => { let n = 0; o.traverse((m) => { if (m.isMesh) n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; }); return n; };
  const groups = [];
  const { buildClouds } = await import('../src/render/world/clouds.js');
  for (const b of [buildTokyo, buildFuji, buildKyoto, buildLaunchRail, buildSpace, buildHongKong, buildSea, buildNewYork, buildWarp, buildKL, buildClouds]) for (const g of b(t).children) groups.push([g.userData.stages, tri(g)]);
  groups.push([[0, 1, 2], tri(buildTerrain(t))]);
  // 見えるのは、今のステージと、さかいめの近くでは次か前のステージ（stageWindow）。いちばん多いときで数える
  for (let cur = 0; cur < 7; cur++) {
    for (const win of [{ cur, next: true, prev: false }, { cur, next: false, prev: true }]) {
      const n = groups.filter(([st]) => stageVisible(st, cur, null, win)).reduce((a, [, k]) => a + k, 0);
      assert.ok(n <= 170000, `ステージ ${cur}${win.next ? '（次も）' : '（前も）'}: ${n}`);
    }
  }
});

// ---- 最後のレビュー（2026-10-20）----
import { mergeMeshes } from '../src/render/mergeMeshes.js';
import { roadDrawn } from '../src/render/trackMesh.js';
import { viewStage } from '../src/game/world.js';

test('最後のレビュー: 宇宙のいん石と月のクレーターは、まとめられても動かせる（景色にくっついたまま）', () => {
  const g = buildSpace(t).children[0];
  mergeMeshes(g);
  const meteors = g.userData.meteors;
  assert.ok(meteors.every((m) => { let o = m; while (o && o !== g) o = o.parent; return o === g; }), 'いん石がはずれた');
  let craters = 0;
  g.traverse((o) => { if (o.userData.ahead && o.children.length) craters = Math.max(craters, o.children.length); });
  assert.ok(craters >= 9, `月 ${craters}`);
});

test('最後のレビュー: 香港へ下りてくる後半は、香港の空と景色（京都の青空が一瞬出ない）', () => {
  const sp = t.autos.find((a) => a.id === 'space');
  const late = { auto: { id: 'space', leg: 0, t: sp.legs[0].time * 0.95 }, y: 60 };
  assert.equal(viewStage(t, late, 2), 3);
  assert.equal(viewStage(t, { auto: { id: 'space', leg: 0, t: 0.2 }, y: 60 }, 2), 2);
  assert.equal(viewStage(t, { auto: null, y: 0 }, 4), 4);
});

test('最後のレビュー: 輪っかの間（R1〜R3、地面の高さ）の道は描く。空の道すじは描かない', () => {
  assert.ok(roadDrawn(at('R2')), 'R2');
  assert.ok(!roadDrawn(t.samples[Math.round((t.marks.AJ + t.marks.FL) / 2)]), '大ジャンプの弧');
  assert.ok(!roadDrawn(t.samples[Math.round((t.marks.R3 + t.marks.KL) / 2)]), 'ワープの弧');
});

test('最後のレビュー: ピンクモスクの建物は、道の回廊にはみ出さない', () => {
  const g = buildKL(t);
  g.updateMatrixWorld(true);
  const s0 = t.marks.PM - 8;
  const s1 = t.marks.PM + (t.marks.BC - t.marks.PM) * 0.08 + 8;
  let bad = 0;
  g.traverse((o) => {
    if (!o.isMesh) return;
    const a = o.geometry.attributes.position;
    for (let k = 0; k < a.count; k += 3) {
      const x = a.getX(k), y = a.getY(k), z = a.getZ(k);
      const e = o.matrixWorld.elements;
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
      const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
      const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      const loc = locate(t, wx, wz, null, 40);
      if (loc.s < s0 || loc.s > s1) continue;
      const p = t.samples[loc.i ?? Math.round(loc.s)];
      if (Math.abs(loc.lateral) < p.wall + 0.3 && wy > (p.y ?? 0) + 0.05 && wy < (p.y ?? 0) + 7.5) bad++; // 道より下の湖の水は数えない
    }
  });
  assert.equal(bad, 0, `はみ出した点 ${bad}`);
});

test('皇居の宮殿・砂利の広場・松は、道の上に出ない（2026-10-21 のユーザー依頼「コース上に壁のようになっていて先が見えない」）', () => {
  const g = buildTokyo(t);
  g.updateMatrixWorld(true);
  const m = landmarks(g);
  const pal = m.get('palace');
  let bad = 0;
  g.traverse((o) => {
    if (!o.isMesh) return;
    const a = o.geometry.attributes.position;
    const e = o.matrixWorld.elements;
    for (let k = 0; k < a.count; k += 3) {
      const x = a.getX(k), y = a.getY(k), z = a.getZ(k);
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
      const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
      const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      if (Math.hypot(wx - pal.x, wz - pal.z) > 130) continue;
      const loc = locate(t, wx, wz, null, 40);
      const p = t.samples[loc.i];
      if (Math.abs(loc.lateral) < p.half && wy > (p.y ?? 0) + 0.05 && wy < (p.y ?? 0) + 7.5) bad++;
    }
  });
  assert.equal(bad, 0, `道の上に出た点 ${bad}`);
});

test('皇居と東京駅には英語の看板（2026-10-21 のユーザー依頼）', () => {
  const m = landmarks(buildTokyo(t));
  assert.ok(m.has('palaceSign'), 'IMPERIAL PALACE');
  assert.ok(m.has('stationSign'), 'TOKYO STATION');
  // 皇居の看板は、最初の門（櫓門）の正面の上（道ばたに立てると、石垣に埋まった。2026-10-21 のユーザー依頼）
  const s = m.get('palaceSign');
  const gate = t.samples.findIndex((p) => p.s >= markS(t, ['NJ', 'MRN', 0.08]));
  assert.ok(Math.hypot(s.x - t.samples[gate].x, s.z - t.samples[gate].z) < 8, '門のところ');
  assert.ok(s.y >= 10, '道の上の高い所');
});

import { shinkansenCars, SHINKANSEN_CAR } from '../src/game/world.js';

test('新幹線は1両ずつ線路にそって曲がる（2026-10-21 のユーザー依頼「真っすぐなままカーブして、レールの外に突き出ている」）', () => {
  const line = { from: t.marks.SK, to: t.marks.KT, off: 40, y: 10, t0: 0, lead: 300 };
  for (const time of [3, 7, 11, 20]) {
    const cars = shinkansenCars(t, line, time, 30, 16);
    assert.equal(cars.length, 16);
    assert.ok(cars.some((c) => c.visible) || time > 15, `time ${time}: 見えない`);
    for (const c of cars.filter((c) => c.visible)) {
      // 両の前と後ろのはしが、線路（道の横 off m の線）から 1.5m 以内
      for (const end of [-1, 1]) {
        const ex = c.x + Math.cos(c.heading) * end * SHINKANSEN_CAR / 2;
        const ez = c.z + Math.sin(c.heading) * end * SHINKANSEN_CAR / 2;
        const loc = locate(t, ex, ez, null, 40);
        const p = sampleAt(t, loc.s);
        const rx = p.x - Math.sin(p.h) * line.off;
        const rz = p.z + Math.cos(p.h) * line.off;
        let best = Infinity;
        for (let ds = -40; ds <= 40; ds += 0.5) {
          const q = sampleAt(t, loc.s + ds);
          best = Math.min(best, Math.hypot(q.x - Math.sin(q.h) * line.off - ex, q.z + Math.cos(q.h) * line.off - ez));
        }
        assert.ok(best < 1.5, `time ${time}: ${best.toFixed(2)}m はみ出し`);
      }
    }
  }
});

test('道は、上と下に重なる所で 6m 以上はなれる（2026-10-21 のユーザー依頼「上のコースに頭が突き出ている」）', () => {
  const S = t.samples;
  const ok = (p) => p.y !== null && !p.void && !p.auto && !p.ghost;
  let worst = null;
  for (let i = 0; i < t.length; i += 3) {
    if (!ok(S[i])) continue;
    for (let j = i + 80; j < t.length; j += 3) {
      if (!ok(S[j]) || t.length - (j - i) < 80) continue; // スタートの後ろは、同じ道のつづき
      if (Math.hypot(S[i].x - S[j].x, S[i].z - S[j].z) >= S[i].wall + S[j].wall) continue;
      const dy = Math.abs(S[i].y - S[j].y);
      if (S[j].s > t.finish && dy < 1) continue; // ゴールのあとの周回の道が、同じ高さでゴールへ向かう道に合流する所
      if (!worst || dy < worst.dy) worst = { dy, i, j };
    }
  }
  assert.ok(!worst || worst.dy >= 6, JSON.stringify(worst));
});

test('芝浦のループは、右に回りながらゆるやかに上る。橋からお台場へもゆるやかに下る（坂は 12% まで）。HX0 はループの始まり', () => {
  const a = Math.round(t.marks.SHIN);
  const b = Math.round(t.marks.ODA);
  let steep = 0;
  for (let i = a; i < b; i++) steep = Math.max(steep, Math.abs(t.samples[i + 1].y - t.samples[i].y) / (t.samples[i + 1].s - t.samples[i].s));
  assert.ok(steep <= 0.12, `坂 ${(steep * 100).toFixed(1)}%`);
  assert.ok(t.marks.HX0 < t.marks.HX1 && t.marks.HX1 < t.marks.RB, `${t.marks.HX0} ${t.marks.HX1} ${t.marks.RB}`);
});

test('お台場の道の下は海ではない（2026-10-21 のユーザー依頼「下もアスファルト」）', async () => {
  const THREE = await import('../vendor/three.module.min.js');
  const g = buildTokyo(t);
  g.updateMatrixWorld(true);
  const water = [];
  g.traverse((o) => { if (o.userData.water) water.push(new THREE.Box3().setFromObject(o)); });
  assert.ok(water.length > 0, '水の板に userData.water');
  let under = 0;
  for (let s = t.marks.RBE + 30; s < t.marks.AJ; s += 5) {
    const p = t.samples[Math.round(s)];
    if (water.some((b) => p.x > b.min.x - p.wall && p.x < b.max.x + p.wall && p.z > b.min.z - p.wall && p.z < b.max.z + p.wall)) under++;
  }
  assert.equal(under, 0, `お台場の道の下に海 ${under}`);
});

test('海の底: もぐる所に入口の門と、コンクリートのトンネル（そのあとガラス）。出口も（2026-10-21 のユーザー依頼「潜るトンネルの入り口を作って」）', () => {
  const m = landmarks(buildSea(t));
  assert.ok(m.has('seaPortal'), '入口の門');
  assert.ok(m.has('seaExit'), '出口の門');
  const lib = t.marks.LIB;
  assert.equal(t.samples[Math.round(t.marks.SD) + 5].tunnelLook, 'concrete');
  assert.equal(t.samples[Math.round(lib) - 5].tunnelLook, 'concrete');
  // 入口から出口まで、トンネルがとぎれない
  for (let s = Math.round(t.marks.SD) + 1; s < lib - 1; s++) assert.ok(t.samples[s].tunnelLook, `s ${s}`);
});

test('海の底: 魚の群れや大きな生き物がたくさん。Soki Forest の巨大怪獣も泳ぐ（2026-10-21 のユーザー依頼）', () => {
  const g = buildSea(t);
  let swim = 0;
  g.traverse((o) => { if (o.userData.swim) swim++; });
  assert.ok(swim >= 24, `泳ぐもの ${swim}`);
  const m = landmarks(g);
  for (const name of ['monster', 'turtle', 'manta']) assert.ok(m.has(name), name);
});

test('富士山のふもとの道は、左右にカーブが続く（2026-10-21 のユーザー依頼「直線で単調。もっとカーブをつけて」）', () => {
  const a = Math.round(t.marks.FL);
  const b = Math.round(t.marks.KT);
  let total = 0;
  let flips = 0;
  let prevSign = 0;
  for (let i = a; i < b; i += 10) {
    let d = t.samples[i + 10].h - t.samples[i].h;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    total += Math.abs(d);
    const sg = Math.abs(d) > 0.02 ? Math.sign(d) : 0;
    if (sg && prevSign && sg !== prevSign) flips++;
    if (sg) prevSign = sg;
  }
  assert.ok((total * 180) / Math.PI > 400, `曲がる角度の合計 ${Math.round((total * 180) / Math.PI)}度`);
  assert.ok(flips >= 5, `左右の切りかえ ${flips}回`);
});

import { createShinkansenModel } from '../src/render/models.js';

test('新幹線は「のぞみ」の形: 先頭と最後尾に長い鼻、屋根は丸い（2026-10-21 のユーザー依頼「牛乳パックのように四角」）', async () => {
  const THREE = await import('../vendor/three.module.min.js');
  const m = createShinkansenModel(4);
  const cars = m.userData.cars;
  const box = (o) => new THREE.Box3().setFromObject(o);
  assert.ok(box(cars[0]).max.x >= 12.5 + 9, `先頭の鼻 ${box(cars[0]).max.x}`);
  assert.ok(box(cars[3]).min.x <= -12.5 - 9, `最後尾の鼻 ${box(cars[3]).min.x}`);
  // 屋根は丸い: 車体の上の角（横のはし・高いところ）に形がない
  let corner = 0;
  cars[1].updateMatrixWorld(true);
  cars[1].traverse((o) => {
    if (!o.isMesh) return;
    const a = o.geometry.attributes.position;
    for (let k = 0; k < a.count; k++) if (a.getY(k) > 3.7 && Math.abs(a.getZ(k)) > 1.5) corner++;
  });
  assert.equal(corner, 0, '屋根の角が四角');
});

test('新幹線は、自分が近づいてから走り出し、線路の終わりまで行っても始まりへ戻らない（2026-10-21 のユーザー依頼「突然新幹線が消えた」）', () => {
  const line = { from: t.marks.SK, to: t.marks.KT, off: -28, y: 10, t0: 100, lead: -100 };
  let prev = -Infinity;
  for (let time = 100; time < 160; time += 0.5) {
    const cars = shinkansenCars(t, line, time, 30, 16);
    // 先頭の s（見えている両の中でいちばん前）は、もどらない
    const head = cars[0];
    const s = locate(t, head.x - Math.sin(0) * 0, head.z, null, 40).s;
    if (cars.some((c) => c.visible)) {
      assert.ok(s >= prev - 1, `time ${time}: ${Math.round(prev)} → ${Math.round(s)}`);
      prev = s;
    }
  }
  // 走り出す前は見えない
  assert.ok(shinkansenCars(t, { ...line, t0: null }, 50, 30, 16).every((c) => !c.visible));
});

// 景色が道の上（車の高さ 5m まで）に出ていないか。数えるのは道の点の近く（from〜to の s）。
// 道の点を 20m のます目に分けて、近くの点だけ見る（全部の点を探すと遅かった）。道の点ごとの高さで見る（下を通る道・上を通る道もそれぞれ）
const roadGrid = (() => {
  const grid = new Map();
  for (let i = 0; i < t.samples.length; i++) {
    const p = t.samples[i];
    if (p.y === null || p.void || p.ghost) continue;
    const key = `${Math.floor(p.x / 20)},${Math.floor(p.z / 20)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(p);
  }
  return grid;
})();
function intrusions(g, from, to) {
  g.updateMatrixWorld(true);
  let bad = 0;
  g.traverse((o) => {
    if (!o.isMesh) return;
    const a = o.geometry.attributes.position;
    const e = o.matrixWorld.elements;
    for (let k = 0; k < a.count; k += 3) {
      const x = a.getX(k), y = a.getY(k), z = a.getZ(k);
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
      const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
      const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      const cx = Math.floor(wx / 20);
      const cz = Math.floor(wz / 20);
      let hit = false;
      for (let gx = cx - 1; gx <= cx + 1 && !hit; gx++) for (let gz = cz - 1; gz <= cz + 1 && !hit; gz++) {
        for (const p of roadGrid.get(`${gx},${gz}`) ?? []) {
          if (p.s < from || p.s > to) continue;
          const lat = -(wx - p.x) * Math.sin(p.h) + (wz - p.z) * Math.cos(p.h);
          const fwd = (wx - p.x) * Math.cos(p.h) + (wz - p.z) * Math.sin(p.h);
          if (Math.abs(fwd) < 1.2 && Math.abs(lat) < p.half - 0.5 && wy > p.y + 0.05 && wy < p.y + 5) { hit = true; break; }
        }
      }
      if (hit) bad++;
    }
  });
  return bad;
}

test('京都の景色は道の上に出ない（2026-10-21 のユーザー依頼「鳥居の出口に何か埋まっている」）', () => {
  assert.equal(intrusions(buildKyoto(t), t.marks.FI, t.marks.LP), 0);
});

test('清水寺は巨大で、道は本堂の中を通りぬける。仁王門もくぐる。京都の名所には英語の看板（2026-10-21 のユーザー依頼）', () => {
  const m = landmarks(buildKyoto(t));
  for (const name of ['kiyomizuHall', 'nioGate', 'signKinkaku', 'signFushimi', 'signGinkaku', 'signArashiyama']) assert.ok(m.has(name), name);
  assert.ok(!m.has('signKiyomizu'), '清水寺の看板は撤去（2026-10-22 のユーザー依頼「視認性が悪い」）');
  const h = m.get('kiyomizuHall');
  const loc = locate(t, h.x, h.z, null, 40);
  assert.ok(Math.abs(loc.lateral) < 2, '本堂は道の上にまたがる');
});

import { stageWindow } from '../src/game/world.js';

test('ほかの都市は遠くから見えない: 次のステージは入る 150m 手前から、前のステージは出て 250m まで（2026-10-21 のユーザー依頼）', () => {
  const st = t.stages;
  const ny = st[5].s;
  const kl = st[6].s;
  const mid = (ny + kl) / 2;
  let w = stageWindow(t, mid);
  assert.equal(w.cur, 5);
  assert.ok(!stageVisible([6], w.cur, null, w), 'ニューヨークの真ん中からクアラルンプールは見えない');
  assert.ok(!stageVisible([4], w.cur, null, w), 'ニューヨークの真ん中から海の底は見えない');
  assert.ok(stageVisible([4, 5], w.cur, null, w), '自由の女神（4・5）は見える');
  w = stageWindow(t, kl - 100);
  assert.ok(stageVisible([6], w.cur, null, w), '入る少し手前から次の都市が見える');
  w = stageWindow(t, ny + 100);
  assert.ok(stageVisible([4], w.cur, null, w), '出たすぐあとは、前のステージも見える');
  assert.ok(stageVisible([6], 5, null), '窓がないときは今までどおり');
});

test('クアラルンプールはゴールのあと周回できる: 道の終わりに着くとゴールの手前へ（2026-10-21 のユーザー依頼「コースの端にぶつかっている」）', () => {
  const kart = createKart(t, Math.round(t.marks.FIN) + 5, 0);
  const cpu = createCpu(1, 0);
  let passes = 0;
  let prev = t.samples[kart.seg].s;
  let time = 0;
  for (let f = 0; f < 60 * 150 && passes < 2; f++) {
    stepKart(kart, cpuControl(cpu, kart, t, time), t, cpuParams(params, 1), 1 / 60);
    time += 1 / 60;
    const s = t.samples[kart.seg].s;
    if (prev > t.marks.FIN + 100 && s <= t.marks.FIN + 2) passes++;
    prev = s;
    assert.ok(!t.samples[kart.seg].void, '無い道に入った');
  }
  assert.ok(passes >= 2, `周回 ${passes}`);
  // 合流で元の道と重なる所は描かない
  assert.ok(t.samples.some((p) => p.ghost), '重なる所');
  assert.ok(t.samples.filter((p) => p.ghost).every((p) => !roadDrawn(p)));
});

test('ゴールはペトロナスツインタワーの2本の間（2026-10-21 のユーザー依頼）', () => {
  const g = buildKL(t);
  const m = landmarks(g);
  const f = t.samples[Math.round(t.marks.FIN)];
  assert.ok(m.has('petronasA') && m.has('petronasB'));
  const a = m.get('petronasA');
  const b = m.get('petronasB');
  // ゴールの点から見た前後（fwd）と横（lat）
  const rel = (o) => ({ fwd: (o.x - f.x) * Math.cos(f.h) + (o.z - f.z) * Math.sin(f.h), lat: -(o.x - f.x) * Math.sin(f.h) + (o.z - f.z) * Math.cos(f.h) });
  const ra = rel(a);
  const rb = rel(b);
  assert.ok(Math.sign(ra.lat) !== Math.sign(rb.lat), '道の両がわ');
  assert.ok(Math.abs(ra.fwd) < 15 && Math.abs(rb.fwd) < 15, 'ゴールの横');
  assert.ok(Math.abs(ra.lat) > f.wall + 15 && Math.abs(rb.lat) > f.wall + 15, '道にかからない');
  // ほかの道（ゴールのあとの周回の道）にもかからない（タワーの半径 20m）
  for (const o of [a, b]) for (const q of t.samples) if (q.y !== null && !q.void) assert.ok(Math.hypot(q.x - o.x, q.z - o.z) > q.wall + 20, `タワーが道 s ${Math.round(q.s)} にかかる`);
});

test('香港・海の底・ニューヨーク・クアラルンプールの景色も、道の上に出ない（コースを右に左に曲げたあと。2026-10-21）', () => {
  const r = {
    hk: intrusions(buildHongKong(t), t.marks.HL, t.marks.SD),
    sea: intrusions(buildSea(t), t.marks.SD, t.marks.LIB),
    ny: intrusions(buildNewYork(t), t.marks.NY, t.marks.R3),
    kl: intrusions(buildKL(t), t.marks.KL, t.marks.R0 - 5) + intrusions(buildKL(t), t.marks.LND, t.marks.END), // 最後のジャンプ台の矢印は、わざと道の上に描く
  };
  assert.deepEqual(r, { hk: 0, sea: 0, ny: 0, kl: 0 });
});

test('香港は中国語のネオン看板であふれる（道の上へ突き出す縦の看板。2026-10-21 のユーザー依頼）', () => {
  const g = buildHongKong(t);
  const signs = [];
  g.traverse((o) => { if (o.userData.landmark === 'hkSign') signs.push(o.userData.text); });
  assert.ok(signs.length >= 50, `看板 ${signs.length}`);
  assert.ok(signs.every((s) => /[一-鿿]/.test(s)), '漢字');
  assert.ok(new Set(signs).size >= 12, `種類 ${new Set(signs).size}`);
});

import { warpLook } from '../src/render/world/warp.js';
import { spaceLook } from '../src/render/world/space.js';

test('クアラルンプールへのワープは約10秒で壮大に: 色が変わり、速くなり、最後は白く光る（2026-10-21 のユーザー依頼）', () => {
  const w = t.autos.find((a) => a.id === 'warp');
  const total = w.legs.reduce((a, l) => a + l.time, 0);
  assert.ok(total >= 9.5 && total <= 11, `${total}秒`);
  const a = warpLook(0.1);
  const b = warpLook(0.6);
  const c = warpLook(0.97);
  assert.ok(b.speed > a.speed && c.speed > b.speed, '速くなる');
  assert.notEqual(a.hue, b.hue, '色が変わる');
  assert.ok(c.flash > 0.5 && a.flash === 0, '最後に白く光る');
});

test('宇宙から香港へ: 宇宙に飛び出す → 地球が見える → 地球に突っこむ → 画面を切りかえて香港に着地（地図はなし。2026-10-21 のユーザー依頼）', () => {
  const p = [0.1, 0.35, 0.6, 0.8, 0.97].map(spaceLook);
  assert.ok(p[0].earth < p[1].earth && p[1].earth < p[2].earth && p[2].earth < p[3].earth, '地球が大きくなる');
  assert.equal(p[0].flash, 0);
  assert.ok(p[4].flash > 0.8, '最後に画面を切りかえる');
  assert.ok(!('map' in p[0]), '地図はなし');
});

test('海の底へ行くトンネルに水面はない。自由の女神の足もとから先は、ふつうの空（青い空間を通らない。2026-10-21 のユーザー依頼）', () => {
  let surface = 0;
  buildSea(t).traverse((o) => { if (o.userData.surface) surface++; });
  assert.equal(surface, 0);
  const above = skyFor(t, 4, { y: 0, auto: null });
  assert.equal(above.sky, skyFor(t, 5, { y: 0, auto: null }).sky);
  assert.equal(skyFor(t, 4, { y: -30, auto: null }).mode, 'sea');
});

import { autoProgress } from '../src/game/world.js';

test('自動の区間の進み（0〜1）: 区間ごとの時間を足して数える', () => {
  const w = t.autos.find((a) => a.id === 'warp');
  const total = w.legs.reduce((a, l) => a + l.time, 0);
  assert.equal(autoProgress(t, { auto: null }), 0);
  assert.ok(Math.abs(autoProgress(t, { auto: { id: 'warp', leg: 0, t: 0 } })) < 1e-9);
  assert.ok(Math.abs(autoProgress(t, { auto: { id: 'warp', leg: 2, t: 1 } }) - (w.legs[0].time + w.legs[1].time + 1) / total) < 1e-9);
});

import { padRush } from '../src/game/world.js';

test('京都へ向かう加速板（新幹線と並走）では、特別なスピードの演出（2026-10-21 のユーザー依頼）', () => {
  const mid = t.samples.findIndex((p) => p.s >= (t.marks.SK + t.marks.KT) / 2);
  assert.equal(padRush(t, { seg: mid, boost: 1 }), true);
  assert.equal(padRush(t, { seg: mid, boost: 0 }), false);
  assert.equal(padRush(t, { seg: t.samples.findIndex((p) => p.s >= t.marks.TT), boost: 1 }), false);
});

import { buildClouds } from '../src/render/world/clouds.js';

test('空に雲（昼・夕方のステージ）。京都の銀閣寺〜嵐山とクアラルンプールにも町なみ（2026-10-21 のユーザー依頼「殺風景」）', () => {
  const g = buildClouds(t);
  const per = {};
  for (const c of g.children) {
    let n = 0;
    c.traverse((o) => { if (o.userData.landmark === 'cloud') n++; });
    per[c.userData.stages.join()] = n;
  }
  for (const k of ['0', '1', '2', '5', '6']) assert.ok(per[k] >= 10, `ステージ ${k}: ${per[k]}`);
  let town = 0;
  buildKyoto(t).traverse((o) => { if (o.userData.landmark === 'kyotoTown') town++; });
  assert.ok(town >= 20, `京都の町家 ${town}`);
  let kl = 0;
  buildKL(t).traverse((o) => { if (o.userData.landmark === 'klTower') kl++; });
  assert.ok(kl >= 12, `クアラルンプールのビル ${kl}`);
});

test('宇宙へ行く発射台の手前に、加速板が3つ（2026-10-21 のユーザー依頼）', () => {
  let runs = 0;
  for (let i = Math.round(t.marks.AR); i < Math.round(t.marks.LP); i++) if (t.samples[i].boost && !t.samples[i - 1].boost) runs++;
  assert.equal(runs, 3);
});

test('スタートの後ろ（車が並ぶ所）から走り出しても、クアラルンプールへ飛ばない（2026-10-21 のユーザー依頼「スタート直後にKLに飛ぶ」）', () => {
  for (const back of [5, 20, 40]) {
    const kart = createKart(t, (L - back) % L, 0);
    for (let f = 0; f < 120; f++) {
      stepKart(kart, full, t, params, 1 / 60);
      const s = t.samples[kart.seg].s;
      assert.ok(s < 300 || s > t.marks.END, `後ろ ${back}m: s ${Math.round(s)} へ飛んだ`);
    }
  }
});

test('スタートの桜並木の道の上に、お堀の水が出ない（2026-10-21 のユーザー依頼「海のように青い床が出ている」）', async () => {
  const THREE = await import('../vendor/three.module.min.js');
  const g = buildTokyo(t);
  g.updateMatrixWorld(true);
  const moats = [];
  g.traverse((o) => { if (o.userData.moat) moats.push(o); });
  assert.ok(moats.length > 0, 'お堀に userData.moat');
  let bad = 0;
  const v = new THREE.Vector3();
  for (let s = 0; s < t.marks.NJ; s += 4) {
    const p = t.samples[Math.round(s)];
    for (const m of moats) {
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox;
      // 道の幅の分も見る（道のはしの点）
      for (const lat of [-p.wall, 0, p.wall]) {
        v.set(p.x - Math.sin(p.h) * lat, 0, p.z + Math.cos(p.h) * lat);
        m.worldToLocal(v);
        if (v.x > bb.min.x && v.x < bb.max.x && v.z > bb.min.z && v.z < bb.max.z) bad++;
      }
    }
  }
  assert.equal(bad, 0, `道の下にお堀 ${bad}`);
});

test('東京の景色（レインボーブリッジの柱など）は、道の上に出ない（2026-10-21 のユーザー依頼「支柱がコース上にある」）', () => {
  assert.equal(intrusions(buildTokyo(t), t.marks.SHIN, t.marks.JP - 5), 0); // 巨大ジャンプ台（JP〜AJ）の上の矢印は、わざと道の上に描く
});

import { chunkStages } from '../src/render/trackMesh.js';

test('道や柵も、ステージごとに分けて見せる（遠くのステージの道が見えた。2026-10-21 のユーザー依頼）', () => {
  const at0 = t.samples[Math.round(t.marks.TT)];
  assert.deepEqual(chunkStages(t, at0.x - 30, at0.x + 30, at0.z - 30, at0.z + 30), [0]);
  const ny = t.samples[Math.round(t.marks.TSQ)];
  assert.deepEqual(chunkStages(t, ny.x - 30, ny.x + 30, ny.z - 30, ny.z + 30), [5]);
  const b = t.stages[2].s; // 京都の始まり（KY）
  const p = t.samples[Math.round(b)];
  assert.deepEqual(chunkStages(t, p.x - 40, p.x + 40, p.z - 40, p.z + 40), [1, 2], 'さかいめは両方');
  assert.deepEqual(chunkStages(t, 1e6, 1e6 + 10, 1e6, 1e6 + 10), [], '道のない所');
});

test('名所の名前は、道をまたぐ横断幕（京都・セントラルパーク。2026-10-21 のユーザー依頼「全く読めない」「Central Parkとわかるように」）', () => {
  const banners = (g) => { const n = []; g.traverse((o) => { if (o.userData.banner) n.push(o.userData.banner); }); return n; };
  const k = banners(buildKyoto(t));
  for (const name of ['FUSHIMI INARI', 'GINKAKU-JI', 'KINKAKU-JI', 'ARASHIYAMA']) assert.ok(k.includes(name), name);
  assert.ok(!k.includes('KIYOMIZU-DERA'), '清水寺の看板は撤去（2026-10-22 のユーザー依頼）');
  assert.ok(!banners(buildTokyo(t)).includes('TOKYO STATION'), '東京駅は高い看板だけ（2枚目の横断幕は撤去。2026-10-21 のユーザー依頼）');
  assert.ok(banners(buildNewYork(t)).includes('CENTRAL PARK'));
});

test('京都の桜は、町家に埋まらない（2026-10-21 のユーザー依頼）', () => {
  // 祇園の町家（奥行き 12m）と桜（道から 2m）: 町家の道がわの面は、桜の幹より道から遠い
  const src = readFileSync(new URL('../src/render/world/kyoto.js', import.meta.url), 'utf8');
  const m = src.match(/const c = beside\(p, side \* \(p\.wall \+ (\d+)\)\); \/\/ 町家は奥行き 12m/);
  assert.ok(m && Number(m[1]) - 6 > 2 + 3, '町家の面が桜の花より外');
});

test('フジテレビは、レインボーブリッジの出口の正面に見える（2026-10-21 のユーザー依頼）', () => {
  const m = landmarks(buildTokyo(t));
  const f = m.get('fujiTV');
  const p = t.samples[Math.round(t.marks.RBE)];
  // 橋の出口から見て、前（向き h）に 100〜300m、横は 80m 以内
  const fwd = (f.x - p.x) * Math.cos(p.h) + (f.z - p.z) * Math.sin(p.h);
  const lat = -(f.x - p.x) * Math.sin(p.h) + (f.z - p.z) * Math.cos(p.h);
  assert.ok(fwd > 100 && fwd < 300 && Math.abs(lat) < 80, `前 ${Math.round(fwd)} 横 ${Math.round(lat)}`);
  // 道にかからない（建物の半分のはば 45m）
  for (const q of t.samples) if (q.y !== null && !q.void && !q.auto) assert.ok(Math.hypot(q.x - f.x, q.z - f.z) > q.wall + 45, `道 s ${Math.round(q.s)}`);
});

test('コースを作る時間は短い（ならせない急なカーブがない。名前・コース選びの画面が重かった。2026-10-21 のユーザー依頼）', () => {
  // このテストが使った CPU の時間で見る（テストを全部いっしょに流すと、パソコンが混んで、時計の時間はのびる）
  // 3回作っていちばん短い時間（全部いっしょに流すと、ほかのテストのごみ集めの時間が入って、たまに長くなる）
  let ms = Infinity;
  for (let k = 0; k < 3; k++) {
    const c0 = process.cpuUsage();
    buildTrack(COURSE5);
    ms = Math.min(ms, process.cpuUsage(c0).user / 1000);
  }
  // ひとつで約 0.3秒（前は 10秒をこえた）
  assert.ok(ms < 1500, `${Math.round(ms)}ms`);
});

test('クアラルンプールの最後は大ジャンプで自動ゴール（ツインタワーの間を飛ぶ）。ジャンプ台の手前に加速板の代わりの坂、着いた順がそのまま順位（2026-10-21 のユーザー依頼）', () => {
  const gj = t.autos.find((a) => a.id === 'goalJump');
  assert.ok(gj, '自動の区間 goalJump');
  // ゴールラインの少し手前（30〜80m）に着地して、走ってゴールラインを越える（2026-10-21 のユーザー依頼）
  const land = gj.legs[gj.legs.length - 1].to;
  assert.ok(land < t.finish && t.finish - land > 30 && t.finish - land < 80, `着地からゴールまで ${Math.round(t.finish - land)}m`);
  assert.ok(!t.samples[Math.round(t.finish)].auto, 'ゴールラインは走って越える');
});

test('ワープの輪っかの間隔は前の2倍。レインボーブリッジの上に加速板3枚（2026-10-21 のユーザー依頼）', () => {
  assert.ok(t.marks.R2 - t.marks.R1 > 220 && t.marks.R3 - t.marks.R2 > 220, `${Math.round(t.marks.R2 - t.marks.R1)} ${Math.round(t.marks.R3 - t.marks.R2)}`);
  let runs = 0;
  for (let i = Math.round(t.marks.RB); i < Math.round(t.marks.RBE); i++) if (t.samples[i].boost && !t.samples[i - 1].boost) runs++;
  assert.equal(runs, 3, 'レインボーブリッジの上に加速板3枚（2026-10-21 のユーザー依頼）');
});

test('locate（ヒントなし）は、点を全部調べたときと同じ点を返す（速くしたあとも）', () => {
  const brute = (x, z, y = null) => {
    let best = 0;
    let bd = Infinity;
    t.samples.forEach((p, i) => {
      const dy = y !== null && p.y !== null ? 3 * (p.y - y) : 0;
      const d = (x - p.x) ** 2 + (z - p.z) ** 2 + dy * dy;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  };
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const xs = t.samples.map((p) => p.x);
  const zs = t.samples.map((p) => p.z);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  for (let k = 0; k < 300; k++) {
    const x = x0 - 200 + rnd() * (x1 - x0 + 400);
    const z = z0 - 200 + rnd() * (z1 - z0 + 400);
    const y = k % 3 ? null : rnd() * 60;
    assert.equal(locate(t, x, z, null, 40, y).i, brute(x, z, y), `${x},${z},${y}`);
  }
  const c0 = process.cpuUsage();
  for (let k = 0; k < 2000; k++) locate(t, x0 + rnd() * (x1 - x0), z0 + rnd() * (z1 - z0), null, 40);
  const ms = process.cpuUsage(c0).user / 1000; // このテストが使った CPU の時間（テストを全部いっしょに流すと、時計の時間はのびる）
  assert.ok(ms < 400, `2000回で ${Math.round(ms)}ms`);
});

test('コース選びの背景（クアラルンプールだけ）は軽く作れる（名前・コース選びの画面が重かった。2026-10-21 のユーザー依頼）', async () => {
  const { buildShowcase } = await import('../src/render/trackMesh.js');
  const c0 = process.cpuUsage();
  const g = buildShowcase(t);
  const ms = process.cpuUsage(c0).user / 1000; // このテストが使った CPU の時間
  assert.ok(ms < 1500, `${Math.round(ms)}ms`);
  const m = landmarks(g);
  assert.ok(m.has('petronas') && m.has('pinkMosque'));
});

test('地球は本物らしく: でこぼこのかたまりではなく、なめらかな球に陸と海の絵、雲と大気（2026-10-21 のユーザー依頼「凹凸がありすぎる」）', () => {
  const g = buildSpace(t).children[0];
  const earth = g.userData.earth;
  const spheres = [];
  earth.traverse((o) => { if (o.isMesh) spheres.push(o); });
  assert.ok(spheres.length <= 3, `形の数 ${spheres.length}（地面・雲・大気）`);
  for (const m of spheres) assert.ok(m.geometry.parameters.widthSegments >= 48, 'なめらか');
});

test('海の底の怪獣は泳がず、トンネルの横で、通るカートの方を向いて口を開け閉めする（2026-10-21 のユーザー依頼「食べたそうに見ている」）', async () => {
  const { updateSea } = await import('../src/render/world/sea.js');
  const THREE = await import('../vendor/three.module.min.js');
  const g = buildSea(t);
  let mon = null;
  g.traverse((o) => { if (o.userData.watch) mon = o; });
  assert.ok(mon && !mon.userData.swim, '泳がない');
  const before = mon.position.clone();
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(mon.position.x + 50, -25, mon.position.z);
  updateSea(g.children[0], 1, cam);
  assert.ok(mon.position.distanceTo(before) < 1e-6, '動かない');
  // 前（+z）がカメラの方を向く
  const f = new THREE.Vector3(0, 0, 1).applyQuaternion(mon.quaternion);
  assert.ok(f.x > 0.9, `向き ${f.x.toFixed(2)}`);
});

import { createKartModel, createTramModel, createTaxiModel } from '../src/render/models.js';
import { nightStage } from '../src/game/world.js';

test('夜の香港とクアラルンプールでは、カートとバス・タクシーのライトがつく（2026-10-21 のユーザー依頼）', () => {
  for (const m of [createKartModel(), createTramModel()]) assert.ok(m.userData.lights, 'ライト');
  assert.ok(!createTaxiModel().userData.lights, 'タクシー（昼のニューヨーク）はライトなし（2026-10-21 のユーザー依頼「不要」）');
  // Kampar のスクールバス（昼）はライトなし（2026-10-22 のユーザー依頼「ライトは消して」）。バスは文字を canvas で描くので、作り方の中身で見る
  const src = readFileSync(new URL('../src/render/models.js', import.meta.url), 'utf8');
  const from = src.indexOf('export function createBusModel');
  const bus = src.slice(from, src.indexOf('export function', from + 10));
  assert.ok(bus.length > 100 && !bus.includes('addHeadlights'), 'スクールバスはライトなし');
  assert.equal(nightStage(t, 3), true);
  assert.equal(nightStage(t, 6), true);
  assert.equal(nightStage(t, 0), false);
  assert.equal(nightStage(t, 5), false);
});

test('富士山へ飛ぶジャンプ台（と最後の大ジャンプ）は、乗った所から加速し、飛び出したあとも少しずつ速くなる（2026-10-21 のユーザー依頼「飛び出す瞬間に急に加速」）', () => {
  // ジャンプ台の上は加速板
  let boost = 0;
  let n = 0;
  for (let i = Math.round(t.marks.JP) + 2; i < Math.round(t.marks.AJ) - 2; i++) { n++; if (t.samples[i].boost) boost++; }
  assert.ok(boost / n > 0.8, `加速板 ${boost}/${n}`);
  // 飛び出した直後の速さは、入る前の速さに近い（いきなり何倍にもならない）
  const kart = createKart(t, Math.round(t.marks.AJ) - 30, 0);
  kart.speed = 40;
  let first = null;
  for (let f = 0; f < 120 && first === null; f++) {
    stepKart(kart, full, t, params, 1 / 60);
    if (kart.auto) first = kart.speed;
  }
  assert.ok(first !== null && first < 90, `飛び出した直後 ${first}`);
});

test('乗り物の走る側: ニューヨーク（右側通行）は向かってくるタクシーが左、同じ向きのタクシーは右。香港（左側通行）は向かってくる電車が右、同じ向きは左（2026-10-21 のユーザー依頼）', () => {
  const kinds = (kind, dir) => t.buses.filter((b) => b.kind === kind && (b.dir ?? -1) === dir);
  assert.ok(kinds('taxi', -1).length > 0 && kinds('taxi', 1).length > 0, 'タクシーは両方の向き');
  assert.ok(kinds('tram', -1).length > 0 && kinds('tram', 1).length > 0, '電車は両方の向き');
  const pose = (b) => busPose(t, b, 3);
  for (const b of kinds('taxi', -1)) assert.ok(pose(b).lateral < 0, 'NY 向かってくる車は左');
  for (const b of kinds('taxi', 1)) assert.ok(pose(b).lateral > 0, 'NY 同じ向きは右');
  for (const b of kinds('tram', -1)) assert.ok(pose(b).lateral > 0, '香港 向かってくる車は右');
  for (const b of kinds('tram', 1)) assert.ok(pose(b).lateral < 0, '香港 同じ向きは左');
  const same = kinds('taxi', 1)[0];
  const p = pose(same);
  const q = t.samples[Math.floor(p.s)];
  assert.ok(Math.cos(p.heading - q.h) > 0.9, '同じ向き');
  // タクシーはジョージ・ワシントン・ブリッジの上で消えない（範囲は NY育英学園の門の手前まで）
  assert.ok(kinds('taxi', -1)[0].to > t.marks.GWB + 50);
});

test('信号機: ニューヨークは直角の角の右側、香港は左側（青と赤。2026-10-21 のユーザー依頼）', () => {
  const lights = (g) => { const r = []; g.traverse((o) => { if (o.userData.landmark === 'trafficLight') r.push(o); }); return r; };
  const side = (o) => { const loc = locate(t, o.position.x, o.position.z, null, 40); return Math.sign(loc.lateral); };
  const ny = lights(buildNewYork(t));
  const hk = lights(buildHongKong(t));
  assert.ok(ny.length >= 8 && hk.length >= 6, `${ny.length} ${hk.length}`);
  assert.ok(ny.every((o) => side(o) > 0), 'NY は右');
  assert.ok(hk.every((o) => side(o) < 0), '香港は左');
  assert.ok(new Set([...ny, ...hk].map((o) => o.userData.color)).size === 2, '青と赤');
});

test('東京の新幹線は東京駅から走り出す（線路は東京駅の横から。2026-10-21 のユーザー依頼「途中から湧き出てきている」）', () => {
  const line = GLOBAL_SCENERY.tokyo.shinkansenLine;
  assert.equal(line.from, 'TS');
  assert.ok(line.lead >= line.cars * 25.5, '走り出すとき、全部の両が線路の上');
  const tr = { from: t.marks[line.from], to: t.marks[line.to], off: line.off, y: line.y, t0: 0, lead: line.lead, speed: line.speed };
  const cars = shinkansenCars(t, tr, 0.01, 30, line.cars);
  assert.ok(cars.every((c) => c.visible), '走り出すときに全部見える');
  // いちばん後ろの両は、東京駅の横
  const st = t.samples[Math.round(t.marks.TS)];
  const last = cars[line.cars - 1];
  assert.ok(Math.hypot(last.x - st.x, last.z - st.z) < 80, `${Math.round(Math.hypot(last.x - st.x, last.z - st.z))}m`);
});

test('ジョージ・ワシントン・ブリッジへは、左回りで1回転のらせんで上る（2026-10-21 のユーザー依頼）', () => {
  assert.ok(t.marks.GX0 !== undefined && t.marks.GX1 !== undefined, 'らせんの印');
  assert.ok(t.marks.CPN < t.marks.GX0 && t.marks.GX1 < t.marks.GWB);
  // 左回り: 向きがだんだん左（マイナス）へ。1周で約 -360度
  let turn = 0;
  for (let i = Math.round(t.marks.GX0); i < Math.round(t.marks.GX1); i += 4) {
    let d = t.samples[i + 4].h - t.samples[i].h;
    turn += Math.atan2(Math.sin(d), Math.cos(d));
  }
  assert.ok(turn < -5.5, `${Math.round((turn * 180) / Math.PI)}度`);
  assert.ok(t.samples[Math.round(t.marks.GX1)].y - t.samples[Math.round(t.marks.GX0)].y > 12, '上る');
});

test('富士山のふもとに着地したら、そのまま富士山の中のトンネルへ（右に左に曲がる、長いトンネル。上は山）（2026-10-21 のユーザー依頼）', () => {
  const a = Math.round(t.marks.FL);
  const b = Math.round(t.marks.SK);
  let run = 0;
  let best = 0;
  let mid = null;
  for (let i = a; i < b; i++) {
    if (t.samples[i].tunnel && t.samples[i].tunnelLook === 'rock') { run++; if (run > best) { best = run; mid = i - Math.floor(run / 2); } } else run = 0;
  }
  assert.ok(best > 400, `トンネル ${best}m`);
  const p = t.samples[mid];
  assert.ok(terrainHeight(t, p.x, p.z) > p.y + 8, '上は山');
});

test('富士山のコースの左側にも木（殺風景だった。2026-10-21 のユーザー依頼）', async () => {
  const { buildFuji } = await import('../src/render/world/fuji.js');
  let left = 0;
  buildFuji(t).traverse((o) => { if (o.userData.landmark === 'fujiTree') left++; });
  assert.ok(left >= 30, `${left}`);
});

test('東京の新幹線は、自分が来るまで東京駅の横で待ち、駅を通るころに走り出して、並んで走れる（2026-10-21 のユーザー依頼「発見できなかった」）', () => {
  const line = GLOBAL_SCENERY.tokyo.shinkansenLine;
  const tr = { from: t.marks[line.from], to: t.marks[line.to], off: line.off, y: line.y, t0: null, lead: line.lead, wait: line.wait, speed: line.speed };
  const waiting = shinkansenCars(t, tr, 30, 30, line.cars);
  assert.ok(waiting.every((c) => c.visible), '待っている間も見える');
  const st = t.samples[Math.round(t.marks.TS)];
  assert.ok(waiting.some((c) => Math.hypot(c.x - st.x, c.z - st.z) < 60), '東京駅の横');
  assert.ok(line.speed < 1, '自分より少し遅い');
  // 走り出して 8秒たっても、まだ線路の上に見える
  const moving = shinkansenCars(t, { ...tr, t0: 0 }, 8, 30, line.cars);
  assert.ok(moving.some((c) => c.visible), '8秒あとも見える');
});

test('フジテレビの球体は、レインボーブリッジから2つの塔の間に見える（2026-10-21 のユーザー依頼「90度ほど回転」）', () => {
  const m = landmarks(buildTokyo(t));
  const f = m.get('fujiTV');
  const p = t.samples[Math.round((t.marks.RB + t.marks.RBE) / 2)];
  const towers = [];
  buildTokyo(t).traverse((o) => { if (o.userData.landmark === 'fujiTVTower') towers.push(o.position); });
  assert.equal(towers.length, 2);
  // 橋から球体を見る線の、左と右に1本ずつ
  const dx = f.x - p.x;
  const dz = f.z - p.z;
  const side = (q) => Math.sign(dx * (q.z - p.z) - dz * (q.x - p.x));
  assert.notEqual(side(towers[0]), side(towers[1]));
});

import { splitByStage } from '../src/render/trackMesh.js';

test('道の形は、三角ごとに、いちばん近い道のステージに分ける（富士山の着地点の近くを通るニューヨークの道が、富士山で見えた。2026-10-21 のユーザー依頼「途切れた道」）', async () => {
  const THREE = await import('../vendor/three.module.min.js');
  const fl = t.samples[Math.round(t.marks.FL) + 5];
  const ny = t.samples[Math.round(t.marks.R2)];
  const tri = (p) => [p.x, p.y + 0.02, p.z, p.x + 1, p.y + 0.02, p.z, p.x, p.y + 0.02, p.z + 1];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([...tri(fl), ...tri(ny)], 3));
  const pieces = splitByStage(new THREE.Mesh(geo, new THREE.MeshBasicMaterial()), t);
  const st = pieces.map((m) => m.userData.stages.join()).sort();
  assert.deepEqual(st, ['1', '5']);
});

test('大ジャンプ台は一定の角度で上り、その角度のまま放物線で飛ぶ（ジャンプ台の角度と高さが合わなかった。2026-10-21 のユーザー依頼）', () => {
  for (const [ramp, off, land] of [['JP', 'AJ', 'FL'], ['R0', 'GJ', 'LND']]) {
    const y = (s) => t.samples[Math.round(s)].y;
    const a = t.marks[off];
    const before = (y(a) - y(a - 6)) / 6;
    const after = (y(a + 6) - y(a)) / 6;
    assert.ok(before > 0.25, `${ramp}: ジャンプ台の坂 ${before.toFixed(2)}`);
    assert.ok(Math.abs(after - before) < 0.06, `${ramp}: 飛び出す角度 ${before.toFixed(2)} → ${after.toFixed(2)}`);
    // ジャンプ台の途中も同じ角度（まっすぐな坂）
    const mid = (t.marks[ramp] + a) / 2;
    assert.ok(Math.abs((y(mid + 3) - y(mid - 3)) / 6 - before) < 0.06, `${ramp}: 坂の途中`);
    // 放物線のいちばん高い所
    let top = 0;
    for (let s = a; s < t.marks[land]; s += 5) top = Math.max(top, y(s));
    assert.ok(top > 60, `${ramp}: 高さ ${Math.round(top)}m`);
  }
});

test('富士山のトンネルの中と入口の前に、地面の面が入りこまない（描く三角で見る。2026-10-21 のユーザー依頼「山がトンネル内に突き出している」「入口が山で塞がれている」）', async () => {
  const { buildTerrain } = await import('../src/render/terrain.js');
  const g = buildTerrain(t);
  const tris = [];
  g.traverse((o) => {
    if (!o.isMesh || !o.geometry.index || o.userData.portal) return;
    const a = o.geometry.attributes.position;
    const idx = o.geometry.index.array;
    for (let k = 0; k < idx.length; k += 3) {
      const [i0, i1, i2] = [idx[k], idx[k + 1], idx[k + 2]];
      tris.push([(a.getX(i0) + a.getX(i1) + a.getX(i2)) / 3, (a.getY(i0) + a.getY(i1) + a.getY(i2)) / 3, (a.getZ(i0) + a.getZ(i1) + a.getZ(i2)) / 3]);
    }
  });
  const grid = new Map();
  for (const c of tris) { const key = `${Math.floor(c[0] / 20)},${Math.floor(c[2] / 20)}`; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(c); }
  let start = -1;
  let end = -1;
  for (let i = Math.round(t.marks.FL); i < Math.round(t.marks.SK); i++) { if (t.samples[i].tunnel && start < 0) start = i; if (t.samples[i].tunnel) end = i; }
  const bad = [];
  for (let i = start - 25; i <= end + 25; i += 2) {
    const p = t.samples[i];
    const gx = Math.floor(p.x / 20);
    const gz = Math.floor(p.z / 20);
    for (let ix = gx - 1; ix <= gx + 1; ix++) for (let iz = gz - 1; iz <= gz + 1; iz++) for (const c of grid.get(`${ix},${iz}`) ?? []) {
      const fwd = (c[0] - p.x) * Math.cos(p.h) + (c[2] - p.z) * Math.sin(p.h);
      const lat = -(c[0] - p.x) * Math.sin(p.h) + (c[2] - p.z) * Math.cos(p.h);
      if (Math.abs(fwd) < 1.5 && Math.abs(lat) < p.half && c[1] > p.y + 0.3 && c[1] < p.y + 8.3) bad.push(Math.round(p.s));
    }
  }
  assert.equal(bad.length, 0, `地面が入りこむ s ${[...new Set(bad)].slice(0, 8).join(',')}`);
});

import { curveArrowSpots } from '../src/render/snow/signs.js';
test('富士山のトンネルの中に、Kyugo Mountain のようなカーブの矢印（2026-10-21 のユーザー依頼）', () => {
  const spots = curveArrowSpots(t).filter((sp) => t.samples[sp.i].s > t.marks.FL && t.samples[sp.i].s < t.marks.SK);
  assert.ok(spots.length >= 6, `${spots.length}`);
});

test('清水の舞台は一目で舞台と分かる: 板張りの床と、飛び降りる所以外の手すり。横断幕も（2026-10-21 のユーザー依頼）', () => {
  const g = buildKyoto(t);
  const m = landmarks(g);
  assert.ok(m.has('kiyomizuDeck') && m.has('kiyomizuRail'), '床と手すり');
  const banners = [];
  g.traverse((o) => { if (o.userData.banner) banners.push(o.userData.banner); });
  assert.ok(banners.includes('KIYOMIZU STAGE'));
  // 手すりは、飛び降りる所（KM の前後 4m）にはない
  let railAtJump = false;
  g.traverse((o) => { if (o.userData.landmark === 'kiyomizuRailPost' && Math.abs(o.userData.s - t.marks.KM) < 4) railAtJump = true; });
  assert.ok(!railAtJump);
});

test('宇宙へ行く発射台: 急に上る路面に、超加速の光る矢印。手前にアーチと「LAUNCH PAD」（2026-10-21 のユーザー依頼）', () => {
  const g = buildLaunchRail(t);
  const m = landmarks(g);
  assert.ok(m.has('launchArch'), 'アーチ');
  const banners = [];
  g.traverse((o) => { if (o.userData.banner) banners.push(o.userData.banner); });
  assert.ok(banners.includes('LAUNCH PAD'));
  let chevrons = 0;
  g.traverse((o) => { if (o.userData.landmark === 'launchChevron') chevrons++; });
  assert.ok(chevrons >= 10, `${chevrons}`);
  // アーチは、坂の手前（LP の前）
  const a = m.get('launchArch');
  const loc = locate(t, a.x, a.z, null, 40);
  assert.ok(loc.s < t.marks.LP && loc.s > t.marks.LP - 60);
});

test('地球に近づいても、地球の中（大気もふくむ）に入らない。突きぬける前に白くフェードアウト（2026-10-21 のユーザー依頼「地球を貫通してまた宇宙に出ている」）', async () => {
  const { earthPlace } = await import('../src/render/world/space.js');
  for (let p = 0; p <= 1.0001; p += 0.02) {
    const e = earthPlace(p);
    const dist = Math.hypot(e.ahead[0], e.ahead[1], e.ahead[2]);
    assert.ok(530 * e.scale < dist * 0.98, `p ${p.toFixed(2)}: 半径 ${Math.round(530 * e.scale)} / 距離 ${Math.round(dist)}`);
  }
  assert.ok(spaceLook(0.9).flash > 0.9, 'いちばん近づく前に白く');
});

import { groundShown } from '../src/game/world.js';

test('海の底の区間（もぐる所〜自由の女神の足もと）では、灰色の平らな地面を見せない（道が地面の下へもぐるので、地面の板が道をふさいで見えた。2026-10-21 のユーザー依頼）', () => {
  assert.equal(groundShown(t, t.marks.SD + 20, 'normal'), false);
  assert.equal(groundShown(t, (t.marks.SD + t.marks.LIB) / 2, 'sea'), false);
  assert.equal(groundShown(t, t.marks.LIB - 10, 'normal'), false);
  assert.equal(groundShown(t, t.marks.HL + 50, 'normal'), true);
  assert.equal(groundShown(t, t.marks.NY + 20, 'normal'), true);
  assert.equal(groundShown(t, t.marks.HL + 50, 'space'), false);
});

test('信号の灯は、走ってくるカートの方を向く（反対を向いていた。2026-10-21 のユーザー依頼）', async () => {
  const { trafficLight } = await import('../src/render/world/kit.js');
  const { createBuilder } = await import('../src/render/town/builder.js');
  const THREE = await import('../vendor/three.module.min.js');
  const s = t.marks.TSQ - 14;
  const g = new THREE.Group();
  const b = createBuilder();
  const glow = createBuilder({ glow: true });
  trafficLight(g, b, glow, t, s, 1, 'green');
  const p = t.samples[Math.round(s)];
  // 灯（光る形）の点の、道の向きでの前後の位置: 箱の真ん中より、走ってくる方（うしろ）
  const lamps = glow.build();
  const box = b.build();
  const fwd = (o) => { let sum = 0; let n = 0; o.traverse((m) => { if (!m.isMesh) return; const a = m.geometry.attributes.position; for (let k = 0; k < a.count; k++) { sum += (a.getX(k) - p.x) * Math.cos(p.h) + (a.getZ(k) - p.z) * Math.sin(p.h); n++; } }); return sum / n; };
  assert.ok(fwd(lamps) < fwd(box) - 0.1, `灯 ${fwd(lamps).toFixed(2)} / 箱 ${fwd(box).toFixed(2)}`);
});

test('タクシーは道の高さを走る（ジョージ・ワシントン・ブリッジの下の道のない所を走っていた。2026-10-21 のユーザー依頼）', () => {
  const taxi = t.buses.find((b) => b.kind === 'taxi');
  let checked = 0;
  for (let time = 0; time < 200; time += 0.5) {
    const p = busPose(t, taxi, time);
    const q = t.samples[Math.floor(p.s)];
    assert.ok(Math.abs(p.y - q.y) < 0.6, `s ${Math.round(p.s)}: タクシー ${p.y?.toFixed?.(1)} / 道 ${q.y.toFixed(1)}`);
    if (q.y > 10) checked++;
  }
  assert.ok(checked > 0, '橋の上も通る');
});

test('ワープ地点（輪っか）のまわりに高層ビルがたくさん（殺風景だった。2026-10-21 のユーザー依頼）', () => {
  let n = 0;
  buildNewYork(t).traverse((o) => { if (o.userData.landmark === 'ringTower') n++; });
  assert.ok(n >= 25, `${n}`);
  assert.equal(intrusions(buildNewYork(t), t.marks.IG, t.marks.R3), 0);
});

test('クアラルンプールのゴールにゴールライン（白黒の線）（2026-10-21 のユーザー依頼）', () => {
  const m = landmarks(buildKL(t));
  assert.ok(m.has('finishLine'));
  const f = m.get('finishLine');
  const p = t.samples[Math.round(t.finish)];
  assert.ok(Math.hypot(f.x - p.x, f.z - p.z) < 3);
});

test('ワープのあとは、最高速度のまま走りだす（2026-10-21 のユーザー依頼「最高速度を維持したまま」）', () => {
  const kart = createKart(t, Math.round(t.marks.R1) - 20, 0);
  kart.speed = 15; // ゆっくり輪っかに入っても
  let out = null;
  let was = false;
  for (let f = 0; f < 60 * 15 && out === null; f++) {
    stepKart(kart, full, t, params, 1 / 60);
    if (kart.auto?.id === 'warp') was = true;
    else if (was) out = kart.speed;
  }
  assert.ok(out !== null && out >= params.topSpeed - 0.5, `ワープのあと ${out} / 最高 ${params.topSpeed}`);
});

test('バトゥ洞窟: ジャンプ台から虹色の階段を飛びこえて、高い所の洞窟の入口に着地。洞窟を抜けたら元の道へ飛び降りる（2026-10-21 のユーザー依頼）', () => {
  const bj = t.autos.find((a) => a.id === 'batuJump');
  assert.ok(bj, '洞窟へのジャンプ');
  const land = t.samples[Math.round(bj.legs[0].to)];
  assert.ok(land.y >= 15, `洞窟の入口の高さ ${land.y}`);
  assert.ok(at('BC').tunnel && at('BC').y >= 15, '洞窟の中は高い所');
  // 洞窟を抜けたら、自動で元の道（高さ 0）へ飛び降りる（caveDrop。下の別のテスト）
  const drop = t.autos.find((a) => a.id === 'caveDrop');
  assert.ok(Math.abs(t.samples[Math.round(drop.legs[0].to)].y) < 0.5, '元の道の高さ');
  // 虹色の階段は、ジャンプの下（道の上）にあり、洞窟の入口の高さまで上る
  const m = landmarks(buildKL(t));
  const st = m.get('rainbowStairs');
  const loc = locate(t, st.x, st.z, null, 40);
  assert.ok(loc.s > t.marks.BJ && loc.s < bj.legs[0].to, '階段はジャンプの下');
});

test('TOKYO STATION の看板は、駅の手前のカーブに入る前から正面に見える（2026-10-21 のユーザー依頼）', () => {
  const m = landmarks(buildTokyo(t));
  const sg = m.get('stationSign');
  // カーブの手前（MRN と TS の間の角の 60m 手前）から見て、前に 40〜200m、横 40m 以内
  const cw = t.toWorld(400, -60);
  const corner = locate(t, cw.x, cw.z, null, 40);
  const p = t.samples[Math.round(corner.s - 60)];
  const fwd = (sg.x - p.x) * Math.cos(p.h) + (sg.z - p.z) * Math.sin(p.h);
  const lat = -(sg.x - p.x) * Math.sin(p.h) + (sg.z - p.z) * Math.cos(p.h);
  assert.ok(fwd > 40 && fwd < 200 && Math.abs(lat) < 40, `前 ${Math.round(fwd)} 横 ${Math.round(lat)}`);
  // 道にはかからない
  const loc = locate(t, sg.x, sg.z, null, 40);
  assert.ok(Math.abs(loc.lateral) > t.samples[loc.i].wall + 2);
});

test('金閣寺は道の近く（池は建物のすぐ前、松は池の両わき）（2026-10-21 のユーザー依頼）', () => {
  const m = landmarks(buildKyoto(t));
  const k = m.get('kinkaku');
  const loc = locate(t, k.x, k.z, null, 40);
  const gap = Math.abs(loc.lateral) - t.samples[loc.i].wall;
  assert.ok(gap > 30 && gap < 50, `道から ${Math.round(gap)}m`);
  assert.equal(intrusions(buildKyoto(t), t.marks.GK, t.marks.AR), 0);
});

test('スタートの後ろ（車が並ぶ所）の道は、東京のステージとして見せる（スタート地点のアスファルトが欠けた。2026-10-21 のユーザー依頼）', async () => {
  const THREE = await import('../vendor/three.module.min.js');
  const back = t.samples[(L - 25) % L];
  const tri = [back.x, back.y + 0.02, back.z, back.x + 1, back.y + 0.02, back.z, back.x, back.y + 0.02, back.z + 1];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  const pieces = splitByStage(new THREE.Mesh(geo, new THREE.MeshBasicMaterial()), t);
  assert.deepEqual(pieces.map((m) => m.userData.stages), [[0]]);
  assert.deepEqual(chunkStages(t, back.x - 5, back.x + 5, back.z - 5, back.z + 5), [0]);
});

test('芝浦のループの柱は、下を通る道の上に立てない（道の上に橋脚があった。2026-10-21 のユーザー依頼）', async () => {
  const { loopPillars } = await import('../src/render/world/tokyo.js');
  const ps = loopPillars(t);
  assert.ok(ps.length > 0, '柱はある');
  for (const c of ps) {
    for (const q of t.samples) {
      if (q.y === null || q.void || q.auto || q.y >= c.top - 1) continue;
      assert.ok(Math.hypot(q.x - c.x, q.z - c.z) > q.wall + 2.5, `柱 (${Math.round(c.x)}, ${Math.round(c.z)}) の下に道 s ${Math.round(q.s)}`);
    }
  }
});

test('皇居の宮殿は、道ばたの石垣（10m）より高い台の上（見えなかった。2026-10-21 のユーザー依頼）', () => {
  const m = landmarks(buildTokyo(t));
  assert.ok(m.get('palace').y >= 10, `宮殿の床の高さ ${m.get('palace').y}`);
});

test('フジテレビ: 看板は橋から見える1枚、前のビルはなし、球体は少し下げ、左右の建物をはなす（2026-10-21 のユーザー依頼）', () => {
  const g = buildTokyo(t);
  const m = landmarks(g);
  const f = m.get('fujiTV');
  let signs = 0;
  g.traverse((o) => { if (o.userData.landmark === 'fujiTVSign') signs++; });
  assert.equal(signs, 1);
  const towers = [];
  g.traverse((o) => { if (o.userData.landmark === 'fujiTVTower') towers.push(o.position); });
  assert.ok(Math.hypot(towers[0].x - towers[1].x, towers[0].z - towers[1].z) >= 76, '左右をはなす');
  assert.ok(m.get('fujiTVSphere').y < 100, '球体を少し下げる');
  // 橋の真ん中から球体までの間（道の外）に、ビルがない
  const rb = t.samples[Math.round((t.marks.RB + t.marks.RBE) / 2)];
  let blocking = 0;
  g.traverse((o) => {
    if (o.userData.landmark !== 'cityTower') return;
    const ax = f.x - rb.x;
    const az = f.z - rb.z;
    const len = Math.hypot(ax, az);
    const u = ((o.position.x - rb.x) * ax + (o.position.z - rb.z) * az) / (len * len);
    const d = Math.abs((o.position.x - rb.x) * az - (o.position.z - rb.z) * ax) / len;
    if (u > 0.2 && u < 0.95 && d < 50) blocking++;
  });
  assert.equal(blocking, 0, '前のビル');
});

test('フジテレビを過ぎた所に加速板。富士山のトンネルの出口の近くに加速板、出た所に加速板と小さなジャンプ台（2026-10-21 のユーザー依頼）', () => {
  const runsIn = (a, b) => { let n = 0; for (let i = Math.round(a); i < Math.round(b); i++) if (t.samples[i].boost && !t.samples[i - 1].boost) n++; return n; };
  assert.ok(runsIn(t.marks.FTV, t.marks.JP) >= 1, 'フジテレビの先');
  let end = -1;
  for (let i = Math.round(t.marks.FL); i < Math.round(t.marks.SK); i++) if (t.samples[i].tunnel) end = i;
  assert.ok(runsIn(end - 80, end) >= 1, 'トンネルの出口の近く');
  assert.ok(runsIn(end, end + 150) >= 1, 'トンネルを出た所');
  let ramp = false;
  for (let i = end; i < end + 200; i++) if (t.samples[i].ramp) ramp = true;
  assert.ok(ramp, '小さなジャンプ台');
});

import { rushFovStep } from '../src/game/world.js';

test('京都へ向かう加速板の広い角度は、なめらかに広がり、なめらかに戻る（カメラが急に変わって、カートが瞬間移動して見えた。2026-10-21 のユーザー依頼）', () => {
  let k = 0;
  k = rushFovStep(k, true, 1 / 60);
  assert.ok(k > 0 && k < 0.1, `1コマで ${k.toFixed(3)}（一気に広げない）`);
  for (let f = 0; f < 120; f++) k = rushFovStep(k, true, 1 / 60);
  assert.ok(k > 0.95, '2秒でほぼ広がる');
  const before = k;
  k = rushFovStep(k, false, 1 / 60);
  assert.ok(before - k < 0.1, '一気に戻さない');
});

test('銀閣寺は道の近くに大きく。銀閣寺と金閣寺の間に加速板2枚、奥の方に小さなジャンプ台（2026-10-21 のユーザー依頼）', () => {
  const m = landmarks(buildKyoto(t));
  const g = m.get('ginkaku');
  const loc = locate(t, g.x, g.z, null, 40);
  const gap = Math.abs(loc.lateral) - t.samples[loc.i].wall;
  assert.ok(gap > 20 && gap < 50, `道から ${Math.round(gap)}m`);
  let pads = 0;
  for (let i = Math.round(t.marks.GK); i < Math.round(t.marks.KK); i++) if (t.samples[i].boost && !t.samples[i - 1].boost) pads++;
  assert.ok(pads >= 2, `加速板 ${pads}`);
  let ramp = -1;
  for (let i = Math.round(t.marks.GK); i < Math.round(t.marks.KK); i++) if (t.samples[i].ramp) ramp = i;
  assert.ok(ramp > (t.marks.GK + t.marks.KK) / 2, '奥の方に小さなジャンプ台');
  assert.equal(intrusions(buildKyoto(t), t.marks.GI, t.marks.AR), 0);
});

test('香港のカーブを曲がった直後に加速板1枚（2026-10-21 のユーザー依頼）', () => {
  let found = false;
  for (let i = Math.round(t.marks.CEN); i < Math.round(t.marks.SD); i++) {
    if (!t.samples[i].boost || t.samples[i - 1].boost) continue;
    const d = Math.atan2(Math.sin(t.samples[i - 15].h - t.samples[i - 45].h), Math.cos(t.samples[i - 15].h - t.samples[i - 45].h));
    if (Math.abs(d) > 0.5) found = true; // すぐ手前で大きく曲がっている
  }
  assert.ok(found);
});

import { cowPose as turtlePose, cowContact as turtleContact, COW_RADIUS as TURTLE_R } from '../src/game/hazards.js';
import { createKart as makeKart, PHYS as KPHYS } from '../src/game/kart.js';
import { bannerStageAt } from '../src/game/track.js';

test('海の底の道に、ゆっくり歩く亀が7匹（2026-10-21 のユーザー依頼）', () => {
  const turtles = t.cows.filter((c) => c.kind === 'turtle');
  assert.equal(turtles.length, 7);
  assert.equal(t.cows.length, 7); // 牛はいない
  for (const c of turtles) {
    const p = t.samples[Math.round(c.s)];
    assert.ok(c.s > t.marks.SD && c.s < t.marks.LIB, `${c.s}`);
    assert.ok(p.y < -20, `海の底 y=${p.y}`);
    // ゆっくり: 横に動く速さは 1.5 m/s まで（牛より遅い）
    let fast = 0;
    for (let time = 0; time < 120; time += 0.25) {
      const a = turtlePose(t, c, time).lateral;
      const b = turtlePose(t, c, time + 0.25).lateral;
      fast = Math.max(fast, Math.abs(b - a) / 0.25);
    }
    assert.ok(fast < 1.5, `${fast} m/s`);
    assert.ok(Math.abs(turtlePose(t, c, 7).y - p.y) < 1e-6, '高さは道の高さ');
  }
});

test('亀にぶつかったときは牛と同じ（メーター150以上でスピン、遅いと跳ね返る）', () => {
  const c = t.cows[0];
  const hit = (speed) => {
    const p = turtlePose(t, c, 5);
    const i = Math.round(c.s) - 1;
    const kart = makeKart(t, i, p.lateral);
    kart.x = p.x - Math.cos(kart.heading) * (TURTLE_R + 0.5);
    kart.z = p.z - Math.sin(kart.heading) * (TURTLE_R + 0.5);
    kart.y = p.y;
    kart.speed = speed;
    return turtleContact(kart, t, 5, KPHYS);
  };
  assert.equal(hit(30), 'spin');
  assert.equal(hit(15), 'bounce');
});

test('NEW YORK の表示は、海の底のトンネルを抜けてすぐ（NY より3秒くらい早く。2026-10-21 のユーザー依頼）', () => {
  const ny = t.stages.findIndex((st) => st.name === 'NEW YORK');
  const b = t.stages[ny].bannerS;
  assert.ok(b >= t.marks.LIB && b <= t.marks.LIB + 30, `${b} / LIB ${t.marks.LIB}`);
  assert.ok(t.marks.NY - b >= 60, '3秒（約 60m 以上）早い');
  assert.equal(bannerStageAt(t, b + 1), ny);
  assert.equal(bannerStageAt(t, b - 5), ny - 1);
  assert.equal(stageAt(t, b + 1), ny - 1, '景色の切りかえ（ステージ）はそのまま');
});

test('バトゥ洞窟の出口から飛び降りると、ふつうに走れば道の真ん中に着地する（2026-10-22 のユーザー依頼「コースをはみ出す勢い」）', () => {
  const drop = t.autos.find((a) => a.id === 'caveDrop');
  assert.ok(drop, '洞窟の出口からの飛び降り（自動）');
  assert.ok(Math.abs(drop.from - t.marks.BX) < 3, '洞窟の出口から');
  const land = drop.legs[drop.legs.length - 1].to;
  assert.ok(land > t.marks.M + 10 && land < t.marks.MRG, '合流の少しあと');
  // 落ちる所は、洞窟の高さから下がり続ける（途中で上がらない）
  let prev = Infinity;
  for (let s = Math.round(drop.from); s <= Math.round(land); s++) {
    const y = t.samples[s].y;
    assert.ok(y !== null && y <= prev + 1e-6, `s ${s}: ${y}`);
    prev = y;
  }
  for (const steer of [0, 1, -1]) {
    const kart = createKart(t, Math.round(t.marks.BX - 60), 0);
    kart.speed = 30;
    let landed = null;
    let was = false;
    for (let f = 0; f < 60 * 8 && !landed; f++) {
      stepKart(kart, { ...full, steer: was ? steer : 0 }, t, params, 1 / 60);
      if (kart.auto?.id === 'caveDrop') was = true;
      else if (was) landed = locate(t, kart.x, kart.z, kart.seg, 40, kart.y);
    }
    assert.ok(landed, '着地した');
    assert.ok(Math.abs(landed.lateral) < 3, `ハンドル ${steer}: 着地の横 ${landed.lateral.toFixed(1)}m`);
    assert.ok(kart.speed > 25, `着地のあとの速さ ${kart.speed}`);
  }
});

test('バトゥ洞窟の出口と入口には、壁のような岩のかたまりがない（岩のふたは山の中のトンネルだけ。2026-10-22 のユーザー依頼）', async () => {
  const { buildTerrain } = await import('../src/render/terrain.js');
  const g = buildTerrain(t);
  const near = (o, m) => Math.hypot(o.x - at(m).x, o.z - at(m).z) < 60;
  let batu = 0;
  let fuji = 0;
  const fl = at('FL');
  g.traverse((o) => {
    if (!o.isMesh || !o.userData.portal) return;
    const pos = o.geometry.attributes.position;
    for (let k = 0; k < pos.count; k += 24) {
      const v = { x: pos.getX(k), z: pos.getZ(k) };
      if (near(v, 'BX') || near(v, 'BC')) batu++;
      if (Math.hypot(v.x - fl.x, v.z - fl.z) < 1200) fuji++;
    }
  });
  assert.equal(batu, 0);
  assert.ok(fuji > 0, '富士山のトンネルの岩のふたはそのまま');
});

import { attachStage, applyStageVisibility as applyVis } from '../src/render/world/stages.js';
import { stageWindow as winAt } from '../src/game/world.js';
import { Group as TGroup } from '../vendor/three.module.min.js';

test('動く乗り物（NY のタクシー・香港の電車・海の亀）は、そのステージの近くでだけ見える（お台場から NY のタクシーが見えた。2026-10-22 のユーザー依頼）', () => {
  const root = new TGroup();
  root.userData.stageGroups = [];
  const taxis = t.buses.filter((b) => b.kind === 'taxi').map((b) => { const m = new TGroup(); attachStage(root, t, m, b.from); root.add(m); return m; });
  const turtles = t.cows.map((c) => { const m = new TGroup(); attachStage(root, t, m, c.s); root.add(m); return m; });
  const look = (mark) => {
    const rel = t.marks[mark] + 1;
    const w = winAt(t, rel);
    applyVis(root, w.cur, null, w);
  };
  look('ODA');
  assert.ok(taxis.every((m) => !m.visible), 'お台場から NY のタクシーは見えない');
  assert.ok(turtles.every((m) => !m.visible), 'お台場から海の亀は見えない');
  look('TSQ');
  assert.ok(taxis.every((m) => m.visible), 'NY ではタクシーが見える');
  look('SD');
  assert.ok(turtles.every((m) => m.visible), '海の底では亀が見える');
});

test('皇居の道に加速板3枚（加速が落ち着くくらいあける）、東京の新幹線と並ぶ道に2枚（2026-10-22 のユーザー依頼）', () => {
  const runs = (a, b) => {
    const out = [];
    for (let s = Math.round(t.marks[a]); s < t.marks[b]; s++) if (t.samples[s].boost && !t.samples[s - 1].boost) out.push(s);
    return out;
  };
  const palace = runs('NJ', 'MRN');
  assert.equal(palace.length, 3, `${palace}`);
  for (let k = 1; k < palace.length; k++) assert.ok(palace[k] - palace[k - 1] >= 120, `間 ${palace[k] - palace[k - 1]}m`);
  const train = runs('TS', 'SL');
  assert.equal(train.length, 2, `${train}`);
  assert.ok(train[1] - train[0] >= 120, `間 ${train[1] - train[0]}m`);
});

import { klLampSpots } from '../src/render/world/kl.js';

test('クアラルンプールの街灯は地面に立つ（ジャンプ台の坂・空中の区間には立てない。ゴール直前に空中にライトが浮かんでいた。2026-10-22 のユーザー依頼）', () => {
  const spots = klLampSpots(t);
  assert.ok(spots.length > 20, `${spots.length}`);
  for (const c of spots) {
    assert.ok(Math.abs(c.y) < 1, `高さ ${c.y.toFixed(1)} (s ${Math.round(c.s)})`);
    assert.ok(!t.samples[Math.round(c.s) % t.length].auto, `自動の区間 s ${Math.round(c.s)}`);
  }
  // ゴールの手前（大ジャンプ台の坂から着地まで）には立てない
  assert.ok(!spots.some((c) => c.s > t.marks.R0 && c.s < t.marks.LND));
});

test('ワープの手前に加速板2枚（十分あける）、東京駅の看板のあたりに1枚（2026-10-22 のユーザー依頼）', () => {
  const runs = (a, b) => {
    const out = [];
    for (let s = Math.round(a); s < b; s++) if (t.samples[s].boost && !t.samples[s - 1].boost) out.push(s);
    return out;
  };
  const warp = runs(t.marks.GWB, t.marks.R1);
  assert.equal(warp.length, 2, `${warp}`);
  assert.ok(warp[1] - warp[0] >= 120, `間 ${warp[1] - warp[0]}m`);
  assert.ok(t.marks.R1 - warp[1] < 80, 'ワープのすぐ手前');
  const station = runs(t.marks.MRN, t.marks.TS + 20);
  assert.equal(station.length, 1, `${station}`);
});

import { buildWarp as makeWarp, updateWarp as stepWarp } from '../src/render/world/warp.js';
import { PerspectiveCamera } from '../vendor/three.module.min.js';

test('同じコースを2回目に走っても、ワープの光の線と輪は見える（前のレースの時刻が残っていて、遠くへ消えていた。2026-10-22 のユーザー依頼）', () => {
  const g = makeWarp().children[0];
  const cam = new PerspectiveCamera();
  // 1回目のレース: 420秒でワープを通る
  for (let time = 410; time < 420; time += 1 / 30) stepWarp(g, cam, time, 0.5);
  // 2回目のレース: 時刻は 0 からやり直し。ワープは 300秒ごろ
  for (let time = 300; time < 301; time += 1 / 30) stepWarp(g, cam, time, 0.3);
  const a = g.userData.lines.geometry.attributes.position.array;
  for (let i = 2; i < a.length; i += 3) assert.ok(a[i] <= 0 && a[i] >= -900, `線 z ${a[i]}`);
  for (const r of g.userData.rings) assert.ok(r.position.z <= 0 && r.position.z >= -700, `輪 z ${r.position.z}`);
});

import { rampSupports, rampArrows } from '../src/render/world/kit.js';

test('大ジャンプ台（お台場・クアラルンプール）は階段に見えない: 下の台は道より上に出ず、光る矢印は坂にそって傾く（2026-10-22 のユーザー依頼）', () => {
  for (const [a, b] of [['JP', 'AJ'], ['R0', 'GJ']]) {
    const from = t.marks[a];
    const to = t.marks[b];
    const sup = rampSupports(t, from, to);
    assert.ok(sup.length > 5, `${a}: 台 ${sup.length}`);
    for (const c of sup) {
      for (const d of [-c.depth / 2, 0, c.depth / 2]) {
        const y = sampleAt(t, c.s + d).y;
        assert.ok(c.h <= y - 0.2 + 1e-6, `${a}: 台の上 ${c.h.toFixed(2)} / 道 ${y.toFixed(2)}（s ${Math.round(c.s + d)}）`);
      }
    }
    for (const r of rampArrows(t, from, to)) {
      const y0 = sampleAt(t, r.s - 0.8).y;
      const y1 = sampleAt(t, r.s + 0.8).y;
      const slope = Math.atan2(y1 - y0, 1.6);
      assert.ok(Math.abs(r.pitch - slope) < 0.05, `${a}: 矢印の傾き ${r.pitch.toFixed(2)} / 坂 ${slope.toFixed(2)}`);
    }
  }
});

import { TUNNEL_HEIGHT } from '../src/render/snow/tunnel.js';

test('バトゥ洞窟の入口の上に、英語の名前「BATU CAVES」（ジャンプで入るときに見える。2026-10-22 のユーザー依頼）', () => {
  const g = buildKL(t);
  let sign = null;
  g.traverse((o) => { if (o.userData.banner === 'BATU CAVES') sign = o; });
  assert.ok(sign, '名前の看板がある');
  const pos = sign.getWorldPosition(sign.position.clone());
  const bc = at('BC');
  assert.ok(Math.hypot(pos.x - bc.x, pos.z - bc.z) < 14, '入口のところ');
  assert.ok(pos.y > bc.y + TUNNEL_HEIGHT && pos.y < bc.y + TUNNEL_HEIGHT + 8, `入口の上 ${(pos.y - bc.y).toFixed(1)}m`);
});

test('富士山のあとの新幹線は、山のトンネルから出てくる（何もない所から出てこない。2026-10-22 のユーザー依頼「せめて山の影から出す」）', async () => {
  const { buildFuji } = await import('../src/render/world/fuji.js');
  const sh = GLOBAL_SCENERY.fuji.shinkansen;
  assert.equal(sh.portal, true);
  const from = t.marks[sh.from];
  // 線路の始まりに、山のトンネルの出口
  const m = landmarks(buildFuji(t));
  const portal = m.get('shinkansenPortal');
  assert.ok(portal, 'トンネルの出口がある');
  const p = t.samples[from];
  const rail = { x: p.x - Math.sin(p.h) * sh.off, z: p.z + Math.cos(p.h) * sh.off };
  assert.ok(Math.hypot(portal.x - rail.x, portal.z - rail.z) < 3, '線路の始まりの所');
  // 先頭の両は、うしろがまだトンネルの中でも、出口から顔を出したら見える（山の中で生まれて、出口から出てくる）
  const line = { from, to: t.marks[sh.to], off: sh.off, y: sh.y, t0: 0, lead: 5, portal: true };
  const cars = shinkansenCars(t, line, 0, 30, 4);
  assert.equal(cars[0].visible, true, '出口から出かけた先頭');
  assert.equal(cars[1].visible, false, 'まだ山の中の両');
});

test('香港から海にもぐるトンネルの中に、香港の物（ビクトリア湾の水など）がつき出ない（2026-10-22 のユーザー依頼「オブジェクトのかけらで先が見えない」）', async () => {
  const THREE = await import('../vendor/three.module.min.js');
  const hk = buildHongKong(t);
  hk.updateMatrixWorld(true);
  let tried = 0;
  for (let i = t.marks.SD - 60; i < t.marks.LIB; i += 3) {
    const p = t.samples[i];
    if (p.y === null || p.y > -0.3) continue; // 地面より下の所（トンネルの中）
    for (const lat of [-(p.wall - 1), 0, p.wall - 1]) {
      const x = p.x - Math.sin(p.h) * lat;
      const z = p.z + Math.cos(p.h) * lat;
      const ray = new THREE.Raycaster(new THREE.Vector3(x, p.y + 0.3, z), new THREE.Vector3(0, 1, 0), 0, 6);
      const hit = ray.intersectObject(hk, true)[0];
      assert.ok(!hit, `点 ${i} 横 ${lat}: 道の上 ${hit && (hit.point.y - p.y).toFixed(1)}m に香港の物`);
      tried++;
    }
  }
  assert.ok(tried > 30);
});
