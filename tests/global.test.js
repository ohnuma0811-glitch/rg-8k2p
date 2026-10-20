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
  const s = m.get('palaceSign');
  const loc = locate(t, s.x, s.z, null, 40);
  assert.ok(Math.abs(loc.lateral) > t.samples[loc.i].wall, '看板は道の外');
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

// 景色が道の上（車の高さ 5m まで）に出ていないか。数えるのは道の点の近く（from〜to の s）
function intrusions(g, from, to) {
  g.updateMatrixWorld(true);
  let bad = 0;
  g.traverse((o) => {
    if (!o.isMesh) return;
    const a = o.geometry.attributes.position;
    const e = o.matrixWorld.elements;
    for (let k = 0; k < a.count; k += 5) {
      const x = a.getX(k), y = a.getY(k), z = a.getZ(k);
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
      const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
      const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      const loc = locate(t, wx, wz, null, 40);
      if (loc.s < from || loc.s > to) continue;
      const p = t.samples[loc.i];
      if (p.y === null) continue;
      if (Math.abs(loc.lateral) < p.half - 0.5 && wy > p.y + 0.05 && wy < p.y + 5) bad++;
    }
  });
  return bad;
}

test('京都の景色は道の上に出ない（2026-10-21 のユーザー依頼「鳥居の出口に何か埋まっている」）', () => {
  assert.equal(intrusions(buildKyoto(t), t.marks.FI, t.marks.LP), 0);
});

test('清水寺は巨大で、道は本堂の中を通りぬける。仁王門もくぐる。京都の名所には英語の看板（2026-10-21 のユーザー依頼）', () => {
  const m = landmarks(buildKyoto(t));
  for (const name of ['kiyomizuHall', 'nioGate', 'signKiyomizu', 'signKinkaku', 'signFushimi', 'signGinkaku', 'signArashiyama']) assert.ok(m.has(name), name);
  const h = m.get('kiyomizuHall');
  const loc = locate(t, h.x, h.z, null, 40);
  assert.ok(Math.abs(loc.lateral) < 2, '本堂は道の上にまたがる');
});

import { stageWindow } from '../src/game/world.js';

test('ほかの都市は遠くから見えない: 次のステージは入る 400m 手前から、前のステージは出て 250m まで（2026-10-21 のユーザー依頼）', () => {
  const st = t.stages;
  const ny = st[5].s;
  const kl = st[6].s;
  const mid = (ny + kl) / 2;
  let w = stageWindow(t, mid);
  assert.equal(w.cur, 5);
  assert.ok(!stageVisible([6], w.cur, null, w), 'ニューヨークの真ん中からクアラルンプールは見えない');
  assert.ok(!stageVisible([4], w.cur, null, w), 'ニューヨークの真ん中から海の底は見えない');
  assert.ok(stageVisible([4, 5], w.cur, null, w), '自由の女神（4・5）は見える');
  w = stageWindow(t, kl - 200);
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
    kl: intrusions(buildKL(t), t.marks.KL, t.marks.END),
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
