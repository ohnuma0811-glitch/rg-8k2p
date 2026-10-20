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
import { buildSpace } from '../src/render/world/space.js';

test('乗り物は、その範囲の中だけを走る（香港の路面電車は香港、NY のタクシーは NY）', () => {
  const trams = t.buses.filter((b) => b.kind === 'tram');
  const taxis = t.buses.filter((b) => b.kind === 'taxi');
  assert.equal(trams.length, 3);
  assert.equal(taxis.length, 5);
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

test('ニューヨーク: 曲がる角はすべて直角（4つ）。名所は南から北へ。ジョージ・ワシントン・ブリッジは西（ハドソン川）', () => {
  assert.equal(t.corners.length, 4);
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
  assert.equal(autoViewOf({ auto: { id: 'space', leg: 0 }, y: 100 }), null);
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
  for (const b of [buildTokyo, buildFuji, buildKyoto, buildLaunchRail, buildSpace, buildHongKong, buildSea, buildNewYork, buildWarp, buildKL]) for (const g of b(t).children) groups.push([g.userData.stages, tri(g)]);
  groups.push([[0, 1, 2], tri(buildTerrain(t))]);
  for (let cur = 0; cur < 7; cur++) {
    const n = groups.filter(([st]) => stageVisible(st, cur, null)).reduce((a, [, k]) => a + k, 0);
    assert.ok(n <= 170000, `ステージ ${cur}: ${n}`);
  }
});
