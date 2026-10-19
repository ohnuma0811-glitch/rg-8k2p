import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, markS, locate, span, between, expandHelix, GRIP_SNOW, GRIP_ICE } from '../src/game/track.js';
import { createCpu, cpuControl, cpuParams, trapLap } from '../src/game/cpu.js';
import { createRace, raceTick, updateProgress, ranking, gridSlot, progress } from '../src/game/race.js';
import { pushApart } from '../src/game/collide.js';
import { slowContact, SLOW_PULL, snowmanPose, snowmanContact, mogulContact, MOGUL_HOP_VY, SNOWMAN_HEIGHT, SNOWMAN_HOP } from '../src/game/hazards.js';
import { COURSE4, COURSES } from '../src/data/tracks.js';
import { buildBridge } from '../src/render/forest/bridge.js';
import { fenceSides, bridgeSlab, landingEdges } from '../src/render/trackMesh.js';
import { buildTunnel, TUNNEL_HEIGHT, tunnelLight, TUNNEL_BLACK, tunnelLook, touchOnly, snowMound, MOUND_ABOVE } from '../src/render/snow/tunnel.js';
import { terrainHeight, buildTerrain } from '../src/render/terrain.js';
import { buildSnowScenery } from '../src/render/snow/kit.js';
import { createKart, stepKart, PHYS } from '../src/game/kart.js';
import { kartParams } from '../src/game/stats.js';

const params = kartParams({ accel: 3, top: 3, handling: 3 });
const full = { throttle: 1, brake: 0, steer: 0, drift: false };
// 点 i から、道の真ん中をまっすぐ走らせる（道の向きへハンドル）。返すのは毎フレームの車の写し
function drive(i, seconds, speed = 30) {
  const kart = createKart(t, i, 0);
  kart.speed = speed;
  const frames = [];
  for (let f = 0; f < seconds * 60; f++) {
    const p = t.samples[kart.seg];
    const d = Math.atan2(Math.sin(p.h - kart.heading), Math.cos(p.h - kart.heading));
    stepKart(kart, { ...full, steer: Math.max(-1, Math.min(1, d * 3)) }, t, params, 1 / 60);
    frames.push({ ...kart });
  }
  return frames;
}

const t = buildTrack(COURSE4);
const L = t.length;
const at = (ref) => t.samples[Math.round(markS(t, typeof ref === 'string' ? [ref, ref, 0] : ref)) % L];

test('Kyugo Mountain は4つ目のコース。大会は4レース（2026-10-18 のユーザー依頼）', () => {
  assert.equal(COURSES.length, 4);
  assert.equal(COURSES[3], COURSE4);
  assert.equal(COURSE4.name, 'Kyugo Mountain');
  assert.equal(COURSE4.theme, 'snow');
});

test('本線の印は走る順: スタート → GS → UB → X1 → FK → SP → XJ → MG → BZ → TI → HX → TO', () => {
  const names = ['GS', 'UB', 'X1', 'FK', 'SP', 'XJ', 'MG', 'BZ', 'TI', 'HX', 'TO'];
  const order = names.map((m) => markS(t, [m, m, 0]));
  for (let k = 1; k < order.length; k++) assert.ok(order[k] > order[k - 1], names[k]);
});

test('スタートは左の道で、北（地図の上）へ向かう。そのあと右へ曲がって、上の道は東へ', () => {
  const p = t.samples[t.startIndex];
  assert.ok(Math.sin(p.h) < -0.9, `${p.h}`); // z が減る向き
  assert.ok(Math.cos(at(['GS', 'UB', 0.5]).h) > 0.9);
});

const B = t.paths.find((p) => p.id === 'B');
const onB = (f) => t.samples[B.start + Math.round(f * (B.count - 1))];
// 本線（A を含む）と B が、上から見て重なる所（1.5m 以内）の組。dy は本線 − B
function crossings() {
  const out = [];
  for (let i = B.start; i < B.start + B.count; i++) {
    const q = t.samples[i];
    for (let j = 0; j < L; j++) {
      const p = t.samples[j];
      if (p.y === null || Math.hypot(p.x - q.x, p.z - q.z) > 1.5) continue;
      if (Math.abs(i - B.start) < 30 || Math.abs(B.start + B.count - 1 - i) < 30) continue; // 分かれる所・合流する所
      if (!out.some((c) => Math.abs(c.j - j) < 40)) out.push({ i, j, dy: p.y - q.y });
    }
  }
  return out;
}

test('分かれ道 B は FK から MG まで。B のほうが長い', () => {
  assert.ok(B);
  assert.ok(Math.abs(t.samples[t.samples[B.start].prev].s - t.marks.FK) < 3);
  assert.ok(B.len > span(t, t.marks.FK, t.marks.MG));
});

test('B との立体交差は4か所（②③④⑤）。どこも上と下の差が 7m 以上。③ だけ B が上', () => {
  const cs = crossings();
  assert.equal(cs.length, 4, JSON.stringify(cs));
  for (const c of cs) assert.ok(Math.abs(c.dy) >= 7, `${c.j}: ${c.dy}`);
  assert.equal(cs.filter((c) => c.dy < 0).length, 1); // ③
});

test('高さ: スタートの前後 100m は 0、分かれ道 FK は 40m 以上、合流 MG は 20m くらい', () => {
  for (let d = -100; d <= 100; d++) assert.equal(t.samples[(t.startIndex + d + L) % L].y, 0);
  assert.ok(at('FK').y >= 40);
  assert.ok(Math.abs(at('MG').y - 20) < 2);
});

test('どの立体交差でも、上の道にいる車は上の道に、下の道にいる車は下の道にいると分かる', () => {
  for (const c of crossings()) {
    const [iu, id] = c.dy > 0 ? [c.j, c.i] : [c.i, c.j];
    const up = t.samples[iu];
    const down = t.samples[id];
    assert.equal(locate(t, up.x, up.z, up.prev, 40, up.y).i, iu);
    assert.equal(locate(t, down.x, down.z, down.prev, 40, down.y).i, id);
    // ヒントなし（コースに戻したときなど）でも、高さで分かる
    assert.equal(t.samples[locate(t, up.x, up.z, null, 40, up.y).i].path, up.path);
    assert.equal(t.samples[locate(t, down.x, down.z, null, 40, down.y).i].path, down.path);
  }
});

test('橋は上の道に（③ は B が橋）。Kyugo Mountain には、道の上の橋脚はない', () => {
  const c3 = crossings().find((c) => c.dy < 0);
  assert.ok(t.samples[c3.i].bridge);
  assert.ok(!t.samples[c3.j].bridge);
  assert.equal(t.bridgePiers.length, 0);
});

test('橋の形は、上の道（③ は B）の下に作る（坂にそった板）', () => {
  const a = bridgeSlab(t).children[0].geometry.attributes.position;
  for (const c of crossings()) {
    const up = t.samples[c.dy > 0 ? c.j : c.i];
    let deck = false;
    for (let k = 0; k < a.count && !deck; k++) {
      if (Math.hypot(a.getX(k) - up.x, a.getZ(k) - up.z) > up.wall + 2) continue;
      const y = a.getY(k);
      if (y < up.y + 0.01 && y > up.y - 2) deck = true;
    }
    assert.ok(deck, `${c.dy > 0 ? c.j : c.i} の橋の板がない`);
  }
});

test('① A は、上の道（X1）の上をジャンプで飛ぶ（地面のない所の下に上の道）', () => {
  const xj = Math.round(t.marks.XJ);
  const gap = [];
  for (let d = -20; d <= 20; d++) if (t.samples[(xj + d) % L].y === null) gap.push((xj + d) % L);
  assert.ok(gap.length > 20, `${gap.length}`);
  const x1 = at('X1');
  assert.ok(gap.some((i) => Math.hypot(t.samples[i].x - x1.x, t.samples[i].z - x1.z) < 6));
});

test('① ジャンプは、どの速さで来ても上の道の向こう側に着く', () => {
  for (const v of [12, 25, 41]) {
    const fr = drive(Math.round(t.marks.XJ) - 60, 6, v);
    assert.ok(fr.some((k) => k.launched), `${v}`);
    assert.ok(fr.every((k) => !(k.respawn > 0)), `${v}: 落ちた`);
    const after = fr.find((k, n) => n > 0 && fr[n - 1].airborne && !k.airborne);
    assert.equal(t.samples[after.seg].path, 0, `${v}`);
    const d = span(t, t.marks.XJ, t.samples[after.seg].s);
    assert.ok(d > 10 && d < 60, `${v}: ${d}`);
  }
});

test('観客席の前の小さなジャンプ: 飛んで（雪だるまの上を越えて）、平らな所に着地して走り続ける', () => {
  const kick = t.kicks[0];
  const fr = drive((kick.top - 40 + L) % L, 4);
  const k0 = fr.findIndex((k) => k.airborne && k.launched); // ジャンプ台から飛んだ所（坂の頂上で浮いたのはのぞく）
  assert.ok(k0 > 0, "飛ばない");
  const air = fr.slice(k0).filter((k, n, a) => a.slice(0, n + 1).every((q) => q.airborne));
  assert.ok(air.length > 20, `${air.length}`); // 0.33秒より長く飛ぶ
  const top = Math.max(...air.map((k) => k.y - t.samples[k.seg].y));
  assert.ok(top > SNOWMAN_HEIGHT + SNOWMAN_HOP && top < 8, `${top}`); // 雪だるま（高さ 約4.6m）の頭の上まで上がるが、高すぎない
  const land = k0 + air.length;
  assert.ok(land > 0);
  assert.ok(fr.slice(land, land + 60).every((k) => !k.airborne), '跳ね続けた');
  assert.ok(fr[land + 59].speed > 20);
});

test('加速板: スタート付近の直線と、観客席の前と、B の最後の直線にある', () => {
  const n = t.samples.length;
  const boostNear = (i, d, path) => {
    for (let k = -d; k <= d; k++) {
      const q = t.samples[(i + k + n) % n];
      if (q.boost && q.path === path) return true;
    }
    return false;
  };
  assert.ok(boostNear((t.startIndex + 60) % L, 50, 0));
  assert.ok(boostNear(t.kicks[0].top, 30, 0));
  assert.ok(boostNear(B.start + B.count - 40, 30, 1));
});

test('らせん: 右に曲がり続けて3周。上と下の段の差は、どこも 7m 以上', () => {
  const { from, to, r } = t.helix;
  let turn = 0;
  for (let i = from; i < to; i++) turn += Math.atan2(Math.sin(t.samples[i + 1].h - t.samples[i].h), Math.cos(t.samples[i + 1].h - t.samples[i].h));
  assert.ok(Math.abs(turn - 6 * Math.PI) < 0.5, `${turn}`); // 右（h がふえる向き）に3周
  assert.ok(t.samples[to].y - t.samples[from].y >= 23);
  for (let i = from; i <= to; i += 2) {
    for (let j = i + 60; j <= to; j += 2) {
      const p = t.samples[i];
      const q = t.samples[j];
      if (Math.hypot(p.x - q.x, p.z - q.z) < 3) assert.ok(q.y - p.y >= 7, `${i} ${j}: ${q.y - p.y}`);
    }
  }
  assert.ok(r > 20 && r < 45, `${r}`);
});

test('らせんは、ドリフトなしで右いっぱいにハンドルを切っておくだけで、ちょうど曲がれる（万能タイプと、曲がりやすい車）', () => {
  for (const stats of [{ accel: 3, top: 3, handling: 3 }, { accel: 5, top: 1, handling: 5 }]) {
    const p = kartParams(stats);
    const kart = createKart(t, t.helix.from + 8, 0);
    kart.speed = p.topSpeed * 0.9;
    let worst = 0;
    for (let f = 0; f < 60 * 25 && kart.seg < t.helix.to - 20; f++) {
      stepKart(kart, { throttle: 1, brake: 0, steer: 1, drift: false }, t, p, 1 / 60);
      const loc = locate(t, kart.x, kart.z, kart.seg, 40, kart.y);
      if (loc.i > t.helix.from + 20) worst = Math.max(worst, Math.abs(loc.lateral));
    }
    assert.ok(kart.seg >= t.helix.to - 20, `${JSON.stringify(stats)}: とちゅうで止まった ${kart.seg - t.helix.from}`);
    assert.ok(worst < t.samples[t.helix.from].half, `${JSON.stringify(stats)}: ${worst}`);
  }
});

test('らせんの3段を続けて走っても、段がかわらない（車の点は、いつも前へ少しずつ進む）', () => {
  const kart = createKart(t, t.helix.from - 30, 0);
  kart.speed = 25;
  let prev = kart.seg;
  for (let f = 0; f < 60 * 40 && kart.seg < t.helix.to + 10; f++) {
    const p = t.samples[kart.seg];
    const loc = locate(t, kart.x, kart.z, kart.seg, 40, kart.y);
    const d = Math.atan2(Math.sin(p.h - kart.heading), Math.cos(p.h - kart.heading));
    stepKart(kart, { throttle: 0.8, brake: 0, steer: Math.max(-1, Math.min(1, d * 3 - loc.lateral * 0.1)), drift: false }, t, params, 1 / 60);
    assert.ok(kart.seg >= prev - 2 && kart.seg - prev < 15, `${prev} → ${kart.seg}`);
    prev = kart.seg;
  }
  assert.ok(kart.seg >= t.helix.to);
});

test('らせんの点は stacked。ほかのコースの点に stacked はない', () => {
  assert.ok(t.samples[t.helix.from + 100].stacked);
  for (const c of COURSES.slice(0, 3)) assert.ok(!buildTrack(c).samples.some((p) => p.stacked), c.name);
});

test('らせんがないコースは、expandHelix で変わらない', () => {
  for (const c of COURSES.slice(0, 3)) assert.equal(expandHelix(c), c);
});

test('曲がりにくい車も、右いっぱいでらせんを止まらずに上りきる（柵にこすっても）', () => {
  const p = kartParams({ accel: 2, top: 5, handling: 1 });
  const kart = createKart(t, t.helix.from + 8, 0);
  kart.speed = p.topSpeed * 0.9;
  for (let f = 0; f < 60 * 40 && kart.seg < t.helix.to; f++) stepKart(kart, { throttle: 1, brake: 0, steer: 1, drift: false }, t, p, 1 / 60);
  assert.ok(kart.seg >= t.helix.to, `${kart.seg - t.helix.from}`);
});

test('らせんの段の上と下で、柵が消えない（ほかの段の道を「ほかの道」と見ない）', () => {
  const f = fenceSides(t);
  for (let i = t.helix.from + 30; i < t.helix.to - 30; i++) assert.ok(f[i][-1] && f[i][1], `${i}`);
});

test('すべりやすさ: スタート〜観客席の先とトンネルはアスファルト（1）、雪の道は 0.6、A の凍った所（3か所、40m。2026-10-19 に 25m から）は 0.05', () => {
  assert.equal(t.samples[t.startIndex].grip, 1);
  assert.equal(at('GS').grip, 1);
  assert.equal(at(['TI', 'TO', 0.5]).grip, 1);
  assert.equal(at(['X1', 'FK', 0.5]).grip, GRIP_SNOW);
  assert.equal(onB(0.5).grip, GRIP_SNOW);
  assert.equal(t.ices.length, 3);
  for (const ice of t.ices) {
    assert.ok(between(t, t.samples[ice.from].s, t.marks.XJ, t.marks.MG));
    assert.ok(Math.abs(span(t, t.samples[ice.from].s, t.samples[ice.to].s) - 40) < 2);
    assert.equal(t.samples[(ice.from + 10) % L].grip, GRIP_ICE);
  }
});

test('ほかのコースは、どこもすべらない（grip 1）', () => {
  for (const c of COURSES.slice(0, 3)) assert.ok(buildTrack(c).samples.every((p) => p.grip === 1), c.name);
});

test('すべる道では、同じハンドルでも外へふくらむ（進む向きが車の向きにそろうのが遅い）', () => {
  const run = (grip) => {
    const kart = createKart(t, t.startIndex, 0);
    kart.speed = 30;
    const save = t.samples.map((p) => p.grip);
    t.samples.forEach((p) => { p.grip = grip; });
    for (let f = 0; f < 60; f++) stepKart(kart, { throttle: 1, brake: 0, steer: 1, drift: false }, t, params, 1 / 60);
    t.samples.forEach((p, i) => { p.grip = save[i]; });
    return Math.abs(Math.atan2(Math.sin(kart.heading - kart.move), Math.cos(kart.heading - kart.move)));
  };
  assert.ok(run(GRIP_ICE) > run(GRIP_SNOW) * 3, '氷は雪よりずっとすべる（2026-10-19 のユーザー依頼「凍結路面の滑り方があまり変化がない」）');
  assert.ok(run(GRIP_SNOW) > run(1) * 1.2);
});

test('CPU が雪と氷の道で3周を走りきる。動けなくならない（6秒で 15m 以上進む）', () => {
  for (let seed = 0; seed < 3; seed++) {
    const kart = createKart(t, t.startIndex, 0);
    const cpu = createCpu(1, seed);
    const hist = [];
    let laps = 0;
    let prevS = t.samples[kart.seg].s;
    let odo = 0; // 走った道のり（らせんでは1周で上から見て同じ場所にもどるので、場所ではなく道のりで見る）
    for (let f = 0; f < 60 * 300 && laps < 3; f++) {
      const [x0, z0] = [kart.x, kart.z];
      stepKart(kart, cpuControl(cpu, kart, t, f / 60), t, cpuParams(params, 1), 1 / 60);
      odo += Math.hypot(kart.x - x0, kart.z - z0);
      const s = t.samples[kart.seg].path === 0 ? t.samples[kart.seg].s : prevS;
      if (prevS > L - 200 && s < 200) laps++;
      prevS = s;
      if (f % 30) continue;
      hist.push(odo);
      if (hist.length < 13) continue;
      assert.ok(odo - hist[hist.length - 13] > 15, `seed ${seed}: 点 ${kart.seg} で止まった`);
    }
    assert.equal(laps, 3, `seed ${seed}`);
  }
});

test('スローの板: A に3枚、長さ 30m、はば 道の30%、道の真ん中（2026-10-18 のユーザー依頼）。凍った所とは重ならない', () => {
  assert.equal(t.slows.length, 3);
  assert.deepEqual(t.slows.map((q) => q.lateral), [0, 0, 0]);
  for (const q of t.slows) {
    assert.ok(between(t, t.samples[q.from].s, t.marks.XJ, t.marks.MG));
    assert.ok(Math.abs(span(t, t.samples[q.from].s, t.samples[q.to].s) - 30) < 2);
    assert.ok(Math.abs(q.half * 2 - 0.3 * 2 * t.roadHalf) < 0.5);
    for (let i = q.from; i !== q.to; i = (i + 1) % L) assert.notEqual(t.samples[i].grip, GRIP_ICE);
  }
});

test('板に乗っている間は、うしろへ引っぱられる。板のない所は変わらない', () => {
  const q = t.slows[0];
  const i = (q.from + 10) % L;
  const kart = createKart(t, i, q.lateral);
  kart.speed = 30;
  assert.equal(slowContact(kart, t, 0.1), true);
  assert.ok(Math.abs(kart.speed - (30 - SLOW_PULL * 0.1)) < 1e-6);
  const other = createKart(t, i, q.half + 2);
  other.speed = 30;
  assert.equal(slowContact(other, t, 0.1), false);
  assert.equal(other.speed, 30);
});

test('板の上でも止まりはしない（8 m/s より遅くはしない）', () => {
  const q = t.slows[1];
  const kart = createKart(t, (q.from + 5) % L, q.lateral);
  kart.speed = 9;
  for (let k = 0; k < 30; k++) slowContact(kart, t, 1 / 60);
  assert.ok(kart.speed >= 8);
});

test('ほかのコースには、スローの板はない', () => {
  for (const c of COURSES.slice(0, 3)) assert.deepEqual(buildTrack(c).slows, []);
});

test('CPU は、なるべくスローの板のない所を通る（3枚とも、乗るのは半分より少ない）', () => {
  let on = 0;
  let runs = 0;
  for (let seed = 0; seed < 12; seed++) {
    const kart = createKart(t, (Math.round(t.marks.XJ) + 40) % L, 0);
    kart.speed = 25;
    const cpu = createCpu(seed % 4, seed);
    if (trapLap(cpu, 0)) continue; // うっかりの周（3割）は、わざと乗る
    const hit = new Set();
    for (let f = 0; f < 60 * 25 && !between(t, t.samples[kart.seg].s, t.marks.MG, t.marks.MG + 20); f++) {
      stepKart(kart, cpuControl(cpu, kart, t, f / 60), t, cpuParams(params, 1), 1 / 60);
      const loc = locate(t, kart.x, kart.z, kart.seg, 40, kart.y);
      t.slows.forEach((q, k) => { if (loc.i < L && (loc.i - q.from + L) % L < 30 && Math.abs(loc.lateral - q.lateral) <= q.half) hit.add(k); });
    }
    on += hit.size;
    runs += 3;
  }
  assert.ok(on < runs / 2, `${on} / ${runs}`);
});

test('雪だるまは15体（共通7、A 4、B 4）。スタートの前後 100m・コブゾーン・トンネルにはいない', () => {
  assert.equal(t.snowmen.length, 15);
  const main = t.snowmen.filter((m) => m.path === 0);
  assert.equal(main.filter((m) => between(t, m.s, t.marks.FK, t.marks.MG)).length, 4);
  assert.equal(t.snowmen.filter((m) => m.path !== 0).length, 4);
  const s0 = t.samples[t.startIndex].s;
  for (const m of main) {
    assert.ok(Math.min(span(t, m.s, s0), span(t, s0, m.s)) > 100, `${m.s}`);
    assert.ok(!between(t, m.s, t.marks.MG + 15, t.marks.TO + 5), `${m.s}`); // コブゾーンとトンネル
  }
});

test('雪だるまは、跳ねながら道を左右に行ったり来たりする（道の中だけ）', () => {
  const m = t.snowmen[0];
  let minL = Infinity;
  let maxL = -Infinity;
  let maxHop = 0;
  for (let time = 0; time < 12; time += 0.05) {
    const p = snowmanPose(t, m, time);
    minL = Math.min(minL, p.lateral);
    maxL = Math.max(maxL, p.lateral);
    maxHop = Math.max(maxHop, p.hop);
    assert.ok(p.hop >= 0);
  }
  assert.ok(minL < -6 && maxL > 6 && maxL < t.roadHalf);
  assert.ok(maxHop > 0.6 && maxHop <= SNOWMAN_HOP + 0.01);
});

test('雪だるまにぶつかる: メーター150以上（30 m/s）でスピン、遅い（20 m/s）と跳ね返る。ドリフト解除。1.5秒は通りぬけられる', () => {
  const m = t.snowmen[2];
  for (const [speed, want] of [[20, 'bounce'], [30, 'spin']]) {
    const p = snowmanPose(t, m, 3);
    const kart = createKart(t, m.i, 0);
    kart.x = p.x;
    kart.z = p.z + 0.5;
    kart.y = p.y;
    kart.speed = speed;
    kart.drift = { active: true, dir: 1, stage: 1, counter: false, flicks: 0, time: 0 };
    assert.equal(snowmanContact(kart, t, 3, PHYS), want, `${speed}`);
    assert.equal(kart.drift.active, false);
    kart.x = p.x;
    kart.z = p.z + 0.5;
    assert.equal(snowmanContact(kart, t, 3.5, PHYS), null);
  }
});

test('空を飛んでいる車（観客席の前の小さなジャンプ）は、雪だるまに当たらない', () => {
  const m = t.snowmen[0];
  const p = snowmanPose(t, m, 1);
  const kart = createKart(t, m.i, 0);
  kart.x = p.x;
  kart.z = p.z;
  kart.airborne = true;
  kart.speed = 28;
  assert.equal(snowmanContact(kart, t, 1, PHYS), null);
  // 観客席の前の雪だるまは、小さなジャンプで飛んでいる所にいる
  const fr = drive((t.kicks[0].top - 40 + L) % L, 3);
  assert.ok(fr.some((k) => k.airborne && k.launched && Math.abs(k.seg - m.i) < 2));
});

test('雪だるまにぶつかっても、CPU がはまって動けなくならない', () => {
  for (let seed = 0; seed < 3; seed++) {
    const karts = [0, 1, 2, 3].map((k) => createKart(t, (t.startIndex - k * 8 + L) % L, k % 2 ? 4 : -4));
    const cpus = karts.map((_, k) => createCpu(k, seed));
    const hist = karts.map(() => []);
    let time = seed * 0.37;
    for (let f = 0; f < 60 * 60; f++) {
      const before = karts.map((kart) => [kart.x, kart.z]);
      karts.forEach((kart, k) => stepKart(kart, cpuControl(cpus[k], kart, t, time), t, cpuParams(params, 1), 1 / 60));
      karts.forEach((kart) => snowmanContact(kart, t, time, PHYS));
      karts.forEach((kart, k) => { kart.odo = (kart.odo ?? 0) + Math.hypot(kart.x - before[k][0], kart.z - before[k][1]); });
      time += 1 / 60;
      if (f % 30) continue;
      karts.forEach((kart, k) => {
        // 走った道のりで見る（らせんでは1周で上から見て同じ場所にもどる）
        const h = hist[k];
        h.push(kart.odo);
        if (h.length < 13) return;
        assert.ok(kart.odo - h[h.length - 13] > 15, `seed ${seed} の CPU ${k} が 6秒動けない（点 ${kart.seg}）`);
      });
    }
  }
});

test('CPU は雪だるまをよける（スピンするのは、ときどきだけ）', () => {
  let spins = 0;
  for (let seed = 0; seed < 3; seed++) {
    const karts = [0, 1, 2, 3].map((k) => createKart(t, (t.startIndex - k * 8 + L) % L, k % 2 ? 4 : -4));
    const cpus = karts.map((_, k) => createCpu(k, seed));
    let time = seed * 0.37;
    for (let f = 0; f < 60 * 60; f++) {
      karts.forEach((kart, k) => stepKart(kart, cpuControl(cpus[k], kart, t, time), t, cpuParams(params, 1), 1 / 60));
      karts.forEach((kart) => { if (snowmanContact(kart, t, time, PHYS) === 'spin') spins++; });
      time += 1 / 60;
    }
  }
  assert.ok(spins <= 14, `${spins}`); // よけないと 20回くらい（2026-10-19: 氷を長くして、CPU の走る筋が変わり 13回。氷の上ではスピンしていない）
});

test('コブゾーン: 合流のあと〜トンネルの手前 8m に、半径 1.5m のコブが10個。左右に散らす。トンネルの中にはない（2026-10-18 のユーザー依頼）', () => {
  assert.equal(t.moguls.length, 10);
  for (const m of t.moguls) {
    const loc = locate(t, m.x, m.z, m.i, 40, m.y);
    assert.ok(Math.abs(loc.lateral) < t.roadHalf - 1);
    assert.ok(between(t, t.samples[m.i].s, t.marks.MG + 10, t.marks.TI - 8), `${t.samples[m.i].s}`);
    assert.ok(!t.samples[m.i].tunnel);
  }
  const lats = t.moguls.map((m) => locate(t, m.x, m.z, m.i, 40, m.y).lateral);
  assert.ok(Math.min(...lats) < -6 && Math.max(...lats) > 6);
});

test('コブに正面から当たると跳ねる（上へ）。そのあと着地して走り続ける', () => {
  const m = t.moguls[0];
  const p = t.samples[m.i];
  const kart = createKart(t, m.i, 0);
  kart.x = m.x - Math.cos(p.h) * 2.4;
  kart.z = m.z - Math.sin(p.h) * 2.4;
  kart.heading = kart.move = p.h;
  kart.speed = 30;
  assert.equal(mogulContact(kart, t), 'hop');
  assert.ok(kart.airborne && Math.abs(kart.vy - MOGUL_HOP_VY) < 1e-6 && !kart.launched);
  for (let f = 0; f < 90; f++) stepKart(kart, full, t, params, 1 / 60);
  assert.ok(!kart.airborne && kart.speed > 20);
});

test('コブに横から当たると、横へはじかれて少し遅くなる', () => {
  const m = t.moguls[0];
  const p = t.samples[m.i];
  const kart = createKart(t, m.i, 0);
  // 道にそって走りながら、コブの左横をこする（コブは進む向きから 70度くらい右）
  kart.x = m.x - Math.cos(p.h) * 0.8 + Math.sin(p.h) * 2.3;
  kart.z = m.z - Math.sin(p.h) * 0.8 - Math.cos(p.h) * 2.3;
  kart.heading = kart.move = p.h;
  kart.speed = 20;
  assert.equal(mogulContact(kart, t), 'side');
  assert.ok(Math.hypot(kart.x - m.x, kart.z - m.z) > 3.5);
  assert.ok(Math.abs(kart.speed - 17) < 1e-6);
  assert.ok(!kart.airborne);
});

test('ほかのコースには、コブはない', () => {
  for (const c of COURSES.slice(0, 3)) assert.deepEqual(buildTrack(c).moguls, []);
});

test('CPU はコブゾーンを通りぬけて、トンネルに入る', () => {
  for (let seed = 0; seed < 4; seed++) {
    const kart = createKart(t, (Math.round(t.marks.MG) - 20) % L, (seed % 3) * 4 - 4);
    const cpu = createCpu(seed, seed);
    for (let f = 0; f < 60 * 8; f++) {
      stepKart(kart, cpuControl(cpu, kart, t, f / 60), t, cpuParams(params, 1), 1 / 60);
      mogulContact(kart, t);
    }
    assert.ok(between(t, t.samples[kart.seg].s, t.marks.TI, t.marks.TO), `seed ${seed}: ${kart.seg}`);
  }
});

test('トンネルの点: TI から TO まで（らせんを含む）。ほかの所・ほかのコースにはない', () => {
  assert.ok(at(['TI', 'TO', 0.06]).tunnel);
  assert.ok(t.samples[t.helix.from + 50].tunnel);
  assert.ok(!at(['TO', 'S', 0.5]).tunnel);
  assert.ok(!at('MG').tunnel);
  assert.ok(!t.samples.slice(L).some((p) => p.tunnel));
  for (const c of COURSES.slice(0, 3)) assert.ok(!buildTrack(c).samples.some((p) => p.tunnel), c.name);
});

test('トンネルの上は山（地面がトンネルの天井より高い）。トンネルの外の道は、地面にうまらない', () => {
  for (const f of [0.1, 0.3, 0.5, 0.8, 0.95]) {
    const p = at(['TI', 'TO', f]);
    assert.ok(terrainHeight(t, p.x, p.z) >= p.y + TUNNEL_HEIGHT, `${f}`);
  }
  for (let i = 0; i < t.samples.length; i += 7) {
    const p = t.samples[i];
    if (p.tunnel || p.y === null || p.bridge || p.ramp) continue;
    // まわりにトンネルがない所だけ（トンネルの入口・出口の近くは山のがけ）
    if (t.samples.some((q) => q.tunnel && Math.hypot(q.x - p.x, q.z - p.z) < q.wall + p.wall + 12)) continue;
    assert.ok(terrainHeight(t, p.x, p.z) <= p.y + 0.01, `${i}: ${terrainHeight(t, p.x, p.z)} > ${p.y}`);
  }
});

test('雪山がある（コースのまわりに、高さ 60m 以上の所）', () => {
  let top = 0;
  for (const pk of t.peaks) top = Math.max(top, terrainHeight(t, pk.x, pk.z));
  assert.ok(top >= 60, `${top}`);
});

test('トンネルの壁と天井は、道（車の通る所）の中に出ない', () => {
  const g = buildTunnel(t);
  const a = g.children[0].geometry.attributes.position;
  let n = 0;
  for (let k = 0; k < a.count; k += 5) {
    const x = a.getX(k);
    const y = a.getY(k);
    const z = a.getZ(k);
    for (const p of t.samples) {
      if (!p.tunnel || Math.abs(p.x - x) > 16 || Math.abs(p.z - z) > 16) continue;
      const lat = -Math.sin(p.h) * (x - p.x) + Math.cos(p.h) * (z - p.z);
      const fwd = Math.cos(p.h) * (x - p.x) + Math.sin(p.h) * (z - p.z);
      if (Math.abs(fwd) > 0.5) continue;
      n++;
      const inside = Math.abs(lat) < p.half && y > p.y + 0.1 && y < p.y + 4;
      assert.ok(!inside, `${x.toFixed(1)} ${y.toFixed(1)} ${z.toFixed(1)}`);
    }
  }
  assert.ok(n > 100, `${n}`);
});

test('トンネルに入ると、一度まっくら（0.25秒）、そのあと暗いまま。出たら明るさがもとに戻る', () => {
  assert.equal(TUNNEL_BLACK, 0.25);
  let st = { dark: 0, black: 0 };
  st = tunnelLight(st, true, 1 / 60);
  assert.ok(st.black > 0.9);
  for (let f = 0; f < 14; f++) st = tunnelLight(st, true, 1 / 60);
  assert.ok(st.black > 0, '0.25秒より前に明るくなった');
  for (let f = 0; f < 46; f++) st = tunnelLight(st, true, 1 / 60);
  assert.equal(st.black, 0);
  assert.equal(st.dark, 1);
  for (let f = 0; f < 120; f++) st = tunnelLight(st, false, 1 / 60);
  assert.deepEqual(st, { dark: 0, black: 0 });
});

test('トンネルの外を走っているだけなら、暗くならない', () => {
  let st = { dark: 0, black: 0 };
  for (let f = 0; f < 600; f++) st = tunnelLight(st, false, 1 / 60);
  assert.deepEqual(st, { dark: 0, black: 0 });
});

test('トンネルを出てすぐ（まだ少し暗い）にまた入っても、まっくらにはならない（らせんの出口など）', () => {
  let st = { dark: 1, black: 0 };
  for (let f = 0; f < 10; f++) st = tunnelLight(st, false, 1 / 60);
  st = tunnelLight(st, true, 1 / 60);
  assert.equal(st.black, 0);
});

test('タブレット・スマホ（指で操作する端末）は、トンネルの中を PC より明るく（2026-10-19 のユーザー依頼）', () => {
  const pc = tunnelLook(false);
  const touch = tunnelLook(true);
  assert.equal(pc.dim, 0.35); // PC はいまのまま
  assert.ok(touch.dim >= 0.65, `${touch.dim}`);
  assert.ok(touch.vignette <= 0.3, `${touch.vignette}`);
  assert.ok(touch.headlight > pc.headlight);
  assert.ok(touch.fogFar >= 2 * pc.fogFar, '奥まで見える');
  const lum = (hex) => ((hex >> 16) & 255) + ((hex >> 8) & 255) + (hex & 255);
  assert.ok(lum(touch.fog) > lum(pc.fog) * 3, '霧が黒すぎない');
});

test('B の道に、半径 20m より急なカーブがない（前は 11m で、柵 13m より小さかった）（2026-10-19 のユーザー依頼「道路が切れて下におちる」）', () => {
  for (let k = 5; k < B.count - 5; k++) {
    const a = t.samples[B.start + k - 5];
    const b = t.samples[B.start + k + 5];
    const turn = Math.abs(Math.atan2(Math.sin(b.h - a.h), Math.cos(b.h - a.h)));
    assert.ok(10 / turn > 20, `B ${(k / (B.count - 1)).toFixed(3)}: 半径 ${(10 / turn).toFixed(1)}m`);
  }
});

test('B の道のはしを走っても、車の高さが急に落ちない', () => {
  for (const target of [-11, 11]) {
    const kart = createKart(t, B.start + 5, 0);
    kart.speed = 35;
    let lastY = kart.y;
    for (let f = 0; f < 60 * 12 && t.samples[kart.seg].path === t.samples[B.start].path; f++) {
      const p = t.samples[kart.seg];
      const lat = (kart.x - p.x) * -Math.sin(p.h) + (kart.z - p.z) * Math.cos(p.h);
      const want = p.h + Math.max(-0.5, Math.min(0.5, (target - lat) * 0.08));
      const d = Math.atan2(Math.sin(want - kart.heading), Math.cos(want - kart.heading));
      kart.boost = 1;
      stepKart(kart, { ...full, steer: Math.max(-1, Math.min(1, d * 3)) }, t, params, 1 / 60);
      assert.ok(kart.y > lastY - 1, `${target}: B ${((kart.seg - B.start) / (B.count - 1)).toFixed(3)} で ${(lastY - kart.y).toFixed(1)}m 落ちた`);
      lastY = kart.y;
    }
  }
});

test('坂道でスピン・転がっても、車は地面にうまらない（Kyugo Mountain と Soki Forest。2026-10-19 のユーザー依頼）', () => {
  for (const def of [COURSE4, COURSES[2]]) {
    const tr = buildTrack(def);
    // いちばん急な上り坂の手前
    let i0 = 0;
    let steep = 0;
    for (let i = 0; i < tr.length; i++) {
      const p = tr.samples[i];
      const q = tr.samples[(i + 10) % tr.length];
      if (p.y === null || q.y === null || p.ramp || q.ramp || p.tunnel) continue;
      if (q.y - p.y > steep) [steep, i0] = [q.y - p.y, i];
    }
    for (const hit of ['spin', 'tumble']) {
      const kart = createKart(tr, i0, 0);
      kart.speed = 35;
      kart[hit] = hit === 'spin' ? PHYS.SPIN_TIME : 2;
      for (let f = 0; f < 40; f++) {
        stepKart(kart, full, tr, params, 1 / 60);
        const ground = locate(tr, kart.x, kart.z, kart.seg, 40, kart.y).ground;
        assert.ok(kart.y > ground - 0.1, `${def.name} ${hit}: ${f}: 車 ${kart.y.toFixed(2)} 地面 ${ground.toFixed(2)}`);
      }
    }
  }
});

test('明るめのトンネルは、マウスやタッチパッドのない、指だけで操作する端末だけ（タッチ画面つきの PC は PC の暗さ。2026-10-19 のユーザー依頼）', () => {
  const media = (on) => (q) => ({ matches: on.includes(q) });
  assert.equal(touchOnly(media(['(pointer: coarse)'])), true); // タブレット・スマホ
  assert.equal(touchOnly(media(['(pointer: coarse)', '(any-pointer: fine)'])), false); // タッチ画面つきの PC
  assert.equal(touchOnly(media(['(pointer: fine)', '(any-pointer: fine)'])), false); // PC
  assert.equal(touchOnly(undefined), false);
});

test('トンネルの外は雪の山でおおう: 天井の上と、壁の外の雪の坂。ほかの道の上にはかからない（2026-10-19 のユーザー依頼）', () => {
  const slopes = snowMound(t);
  const inTunnel = t.samples.slice(0, L).filter((p) => p.tunnel).length;
  assert.ok(slopes.length > inTunnel, `${slopes.length}`); // 両がわ（らせんの下の段の外がわは、上の段の雪の下）
  assert.ok(slopes.filter((m) => m.reach > 10).length > slopes.length * 0.6, '雪の坂が短すぎる');
  assert.ok(MOUND_ABOVE > TUNNEL_HEIGHT && MOUND_ABOVE < TUNNEL_HEIGHT + 1);
  for (const m of slopes) {
    const p = t.samples[m.i];
    const rx = -Math.sin(p.h) * m.side;
    const rz = Math.cos(p.h) * m.side;
    for (const q of t.samples) {
      if (q.tunnel || q.y === null) continue;
      const dx = q.x - p.x;
      const dz = q.z - p.z;
      if (Math.abs(dx * Math.cos(p.h) + dz * Math.sin(p.h)) > 2) continue;
      const l = dx * rx + dz * rz - m.w;
      if (!(l - q.wall < m.reach && l + q.wall > 0)) continue;
      if (l - q.wall < 0 && q.y < p.y) {
        // トンネルの真下を通る道: 雪はその道より 5m 以上上
        assert.ok(m.base >= q.y + 5, `雪（点 ${m.i}）が下の道（点 ${t.samples.indexOf(q)}）に近い`);
        continue;
      }
      const h = m.top - ((m.top - m.base) * Math.max(0, l - q.wall)) / ((m.top - m.base) * 1.2);
      assert.ok(h < q.y - 1, `雪の坂（点 ${m.i}）が道（点 ${t.samples.indexOf(q)}）にかかる`);
    }
  }
});

test('ジャンプの着地の道のはし: 手前の地面は道より 3m 以上低い（崖）。逆走すると、車のうしろの端がはしの所で止まる（2026-10-19 のユーザー依頼）', () => {
  const edges = landingEdges(t);
  assert.equal(edges.length, 1);
  const e = t.samples[edges[0]];
  assert.ok(Math.abs(span(t, t.marks.XJ, e.s) - 26) < 2);
  for (const back of [2, 6, 12]) {
    for (const lat of [-8, 0, 8]) {
      const p = t.samples[(edges[0] - back + L) % L];
      const x = p.x - Math.sin(p.h) * lat;
      const z = p.z + Math.cos(p.h) * lat;
      // 下を通る道（X1）のふちから 4m までは、その道の高さ
      let allow = e.y - 3;
      for (const q of t.samples) if (q.y !== null && Math.abs(q.s - e.s) > 60 && Math.hypot(q.x - x, q.z - z) - q.wall <= 4) allow = Math.max(allow, q.y + 0.01);
      assert.ok(terrainHeight(t, x, z) <= allow, `${back} ${lat}: ${terrainHeight(t, x, z).toFixed(1)}`);
    }
  }
  const kart = createKart(t, (edges[0] + 12) % L, 0);
  kart.heading += Math.PI;
  kart.move = kart.heading;
  kart.speed = 12;
  for (let f = 0; f < 120; f++) stepKart(kart, full, t, params, 1 / 60);
  assert.ok(!kart.airborne && !(kart.respawn > 0));
  const s = (kart.x - e.x) * Math.cos(e.h) + (kart.z - e.z) * Math.sin(e.h); // はしから前へ（m）
  assert.ok(s > 0.85 && s < 1.5, `はしから ${s.toFixed(2)}m`); // うしろの端（1.4m うしろ）が、壁の面（はしの 0.5m 先）の所
});

// 形の三角の数
function triangles(g) {
  let n = 0;
  g.traverse((o) => {
    if (!o.geometry) return;
    const per = o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
    n += per * (o.isInstancedMesh ? o.count : 1);
  });
  return n;
}

test('雪の景色: もみの木は60本以上、どれも道（柵の内がわ）とトンネルの上の山に立たない', () => {
  const g = buildSnowScenery(t);
  const trees = [];
  g.traverse((o) => { if (o.userData.fir) trees.push(o.position); });
  assert.ok(trees.length >= 60, `${trees.length}`);
  for (const p of trees) {
    const loc = locate(t, p.x, p.z, null, 40);
    assert.ok(Math.abs(loc.lateral) > loc.wall + 2, `${p.x} ${p.z}`);
  }
});

test('観客席は GS の左がわ（2026-10-18 のユーザー依頼「右に曲がって、左手に観客席」）。川は道を横切らない', () => {
  assert.deepEqual(COURSE4.grandstand, { at: 'GS', side: -1 });
  const river = COURSE4.river.map(([x, z]) => t.toWorld(x, z));
  for (let k = 0; k + 1 < river.length; k++) {
    for (let u = 0; u <= 10; u++) {
      const x = river[k].x + ((river[k + 1].x - river[k].x) * u) / 10;
      const z = river[k].z + ((river[k + 1].z - river[k].z) * u) / 10;
      const loc = locate(t, x, z, null, 40);
      assert.ok(Math.abs(loc.lateral) > loc.wall + 8, `川が道に近い: ${x} ${z}`);
    }
  }
});

test('三角の数: 雪の景色・トンネル・橋・地面で、20万まで（道の形は別。全部で30万まで）', () => {
  const n = triangles(buildSnowScenery(t)) + triangles(buildTunnel(t)) + triangles(buildBridge(t, { snow: true })) + triangles(buildTerrain(t));
  assert.ok(n < 200000, `${n}`);
});

test('観客席の下とまわりの地面は、道の高さより上がらない（雪山の坂にうまらない）', () => {
  const p = at('GS');
  for (const d of [20, 30, 40]) {
    for (const along of [-25, 0, 25]) {
      const x = p.x + Math.sin(p.h) * d + Math.cos(p.h) * along; // 左がわ
      const z = p.z - Math.cos(p.h) * d + Math.sin(p.h) * along;
      assert.ok(terrainHeight(t, x, z) <= p.y, `${d} ${along}: ${terrainHeight(t, x, z)}`);
    }
  }
});

test('CPU が A のつもりで分かれ道でスピンして B に入っても、ジャンプの地面のない所へワープして落ちない', () => {
  const kart = createKart(t, t.startIndex, 0);
  const cpu = createCpu(1, 1);
  cpu.forceRoute = 'main';
  let time = 0;
  for (let f = 0; f < 60 * 60; f++) {
    stepKart(kart, cpuControl(cpu, kart, t, time), t, cpuParams(params, 1), 1 / 60);
    snowmanContact(kart, t, time, PHYS);
    time += 1 / 60;
    assert.ok(!(kart.respawn > 0), `${time.toFixed(1)}秒: 点 ${kart.seg} で落ちた`);
  }
});


// CPU 1台で、決まった道（'main' は A、'B' は分かれ道）だけを通って1周の時間（秒）。通った道も返す
function lapTime(route, seed) {
  const kart = createKart(t, t.startIndex, 0);
  const cpu = createCpu(1, seed);
  cpu.forceRoute = route;
  let time = 0;
  let half = false;
  const used = new Set();
  for (let f = 0; f < 60 * 200; f++) {
    stepKart(kart, cpuControl(cpu, kart, t, time), t, cpuParams(params, 1), 1 / 60);
    slowContact(kart, t, 1 / 60);
    snowmanContact(kart, t, time, PHYS);
    mogulContact(kart, t);
    time += 1 / 60;
    const s = t.samples[kart.seg];
    used.add(s.path);
    if (s.path === 0 && s.s > L / 2) half = true;
    if (half && s.path === 0 && s.s < 100) return { time, used };
  }
  return { time: Infinity, used };
}

test('A と B の1周の時間の差は 3% 以内（どちらを通っても有利不利が出ない。2026-10-18 のユーザー依頼）。1周は 85秒より短い', () => {
  const a = lapTime('main', 1);
  const b = lapTime('B', 1);
  assert.deepEqual([...a.used], [0], 'A のつもりで B に入った');
  assert.ok(b.used.has(1), 'B に入らない');
  assert.ok(Math.abs(a.time - b.time) / a.time < 0.03, `A ${a.time.toFixed(1)} B ${b.time.toFixed(1)}`);
  assert.ok(a.time < 85 && b.time < 85, `A ${a.time.toFixed(1)} B ${b.time.toFixed(1)}`); // すべりやすくして（2026-10-18）少し遅くなった
});

test('CPU 8台が、押し合い・全部の仕掛けで3周を走りきる。動けなくならない。A と B のどちらも通る', () => {
  for (const seed of [1, 2]) {
    const n = 8;
    const karts = [...Array(n)].map((_, k) => { const slot = gridSlot(t, k); return createKart(t, slot.i, slot.lateral); });
    const cpus = karts.map((_, k) => createCpu(k, seed));
    const race = createRace(n);
    race.t = 0;
    race.phase = 'racing';
    const used = new Set();
    const hist = karts.map(() => []);
    let contacts = new Set();
    let f = 0;
    for (let time = 0; time < 300 && !race.entries.every((e) => e.finished); time += 1 / 60, f++) {
      karts.forEach((kart, k) => {
        stepKart(kart, cpuControl(cpus[k], kart, t, time), t, cpuParams(params, 1), 1 / 60);
        slowContact(kart, t, 1 / 60);
        snowmanContact(kart, t, time, PHYS);
        mogulContact(kart, t);
        updateProgress(race, k, t, kart.seg);
        used.add(t.samples[kart.seg].path);
      });
      contacts = pushApart(karts, contacts);
      raceTick(race, 1 / 60);
      if (f % 30) continue;
      karts.forEach((kart, k) => {
        if (race.entries[k].finished || kart.respawn > 0) return;
        // らせんでは1周（約6秒）で上から見て同じ場所にもどるので、進んだ道のりで見る
        const h = hist[k];
        h.push(progress(race, k, t));
        if (h.length < 13) return;
        assert.ok(h[h.length - 1] - h[h.length - 13] > 15, `seed ${seed} の CPU ${k} が 6秒動けない（点 ${kart.seg}）`);
      });
    }
    race.entries.forEach((e, k) => assert.ok(e.finished, `seed ${seed} の CPU ${k} が3周できない（${e.lap}周）`));
    assert.ok(used.has(0) && used.has(1), 'A と B の両方を通る');
    const order = ranking(race, t);
    const byTime = [...race.entries.keys()].sort((x, y) => race.entries[x].time - race.entries[y].time);
    assert.deepEqual(order, byTime, `seed ${seed}: 順位とゴールの順がちがう`);
  }
});

test('コースのどこでも、道のはしを走っていても、高さのちがう道の点にワープしない（最終レビュー）', () => {
  for (const c of [COURSE4, COURSES[2]]) {
    const tr = c === COURSE4 ? t : buildTrack(c);
    for (let i = 0; i < tr.samples.length; i += 3) {
      const p = tr.samples[i];
      if (p.y === null || p.ramp) continue;
      for (let lat = -p.wall + 0.5; lat <= p.wall - 0.5; lat += 1.5) {
        const loc = locate(tr, p.x - Math.sin(p.h) * lat, p.z + Math.cos(p.h) * lat, i, 40, p.y);
        const q = tr.samples[loc.i];
        assert.ok(q.y !== null && Math.abs(q.y - p.y) <= 1.5, `${c.name} 点 ${i} の横 ${lat.toFixed(1)}m で、点 ${loc.i}（高さ ${q.y} / ${p.y.toFixed(1)}）`);
      }
    }
  }
});

test('道どうしが上から見て重なる所は、道のはしまで含めて、上と下の差が 5m 以上（分かれる所・合流する所はのぞく。最終レビュー）', () => {
  const S = t.samples;
  const bad = [];
  for (let i = 0; i < S.length; i += 2) {
    const p = S[i];
    if (p.y === null) continue;
    for (let j = i + 2; j < S.length; j += 2) {
      const q = S[j];
      if (q.y === null) continue;
      if (p.path === q.path && Math.min(Math.abs(p.s - q.s), L - Math.abs(p.s - q.s)) < 80) continue;
      if (Math.hypot(p.x - q.x, p.z - q.z) >= p.half + q.half) continue;
      const dy = Math.abs(p.y - q.y);
      if (dy <= 1.2) continue; // 分かれる所・合流する所（同じ高さで並ぶ）
      if (dy < 5) bad.push(`${i}/${j}: ${dy.toFixed(1)}`);
    }
  }
  assert.deepEqual(bad.slice(0, 10), []);
});

test('橋の柱や石は、下の道（車の通る所）の中に立たない（最終レビュー）', () => {
  const a = buildBridge(t, { snow: true }).children[0].geometry.attributes.position;
  const grid = new Map();
  for (const q of t.samples) {
    if (q.y === null) continue;
    const key = `${Math.floor(q.x / 20)},${Math.floor(q.z / 20)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(q);
  }
  const bad = new Set();
  for (let k = 0; k < a.count; k++) {
    const x = a.getX(k);
    const y = a.getY(k);
    const z = a.getZ(k);
    for (let gx = Math.floor(x / 20) - 1; gx <= Math.floor(x / 20) + 1; gx++) {
      for (let gz = Math.floor(z / 20) - 1; gz <= Math.floor(z / 20) + 1; gz++) {
        for (const q of grid.get(`${gx},${gz}`) ?? []) {
          if (q.bridge) continue;
          const lat = -Math.sin(q.h) * (x - q.x) + Math.cos(q.h) * (z - q.z);
          const fwd = Math.cos(q.h) * (x - q.x) + Math.sin(q.h) * (z - q.z);
          if (Math.abs(fwd) < 0.6 && Math.abs(lat) < q.half - 0.5 && y > q.y + 0.2 && y < q.y + 3) bad.add(`${t.samples.indexOf(q)}`);
        }
      }
    }
  }
  assert.deepEqual([...bad].slice(0, 10), []);
});

test('観客席の前の小さなジャンプは、跳ねている雪だるまの頭より上を通る（最終レビュー）', () => {
  const m = t.snowmen[0];
  const fr = drive((t.kicks[0].top - 40 + L) % L, 3);
  const over = fr.filter((k) => k.airborne && Math.abs(k.seg - m.i) <= 1);
  assert.ok(over.length > 0, '雪だるまの上を飛んでいない');
  for (const k of over) assert.ok(k.y - t.samples[k.seg].y > SNOWMAN_HEIGHT + SNOWMAN_HOP, `${(k.y - t.samples[k.seg].y).toFixed(2)}`);
});

import { curveArrowSpots, guideBanners } from '../src/render/snow/signs.js';
import { boostRunsAll } from '../src/render/trackMesh.js';

test('トンネルのカーブでは、外がわの壁に曲がる向きの矢印の板がある（らせんも。2026-10-18 のユーザー依頼）', () => {
  const spots = curveArrowSpots(t);
  assert.ok(spots.length >= 20, `${spots.length}`);
  for (const sp of spots) {
    const p = t.samples[sp.i];
    assert.ok(p.tunnel);
    // 右へ曲がる所は左の壁（外がわ）に、右向きの矢印
    const turn = Math.atan2(Math.sin(t.samples[sp.i + 15].h - t.samples[sp.i - 15].h), Math.cos(t.samples[sp.i + 15].h - t.samples[sp.i - 15].h));
    assert.equal(sp.dir, Math.sign(turn));
    assert.equal(sp.side, -sp.dir);
  }
  assert.ok(spots.some((sp) => sp.i > t.helix.from && sp.i < t.helix.to && sp.dir === 1), 'らせんに右向きの矢印');
  assert.deepEqual(curveArrowSpots(buildTrack(COURSES[2])), []);
});

test('分かれ道の手前と、合流の手前（A と B の両方）に横断幕（2026-10-18 のユーザー依頼）', () => {
  const list = guideBanners(t);
  const fork = list.filter((b) => b.kind === 'fork');
  const merge = list.filter((b) => b.kind === 'merge');
  assert.equal(fork.length, 1);
  const toFork = span(t, t.samples[fork[0].i].s, t.marks.FK);
  assert.ok(toFork > 25 && toFork < 70, `${toFork}`);
  assert.match(fork[0].text, /B →/);
  assert.equal(merge.length, 2);
  assert.deepEqual(merge.map((b) => t.samples[b.i].path).sort(), [0, 1]);
});

test('分かれ道（B）の加速板も、地面に描く', () => {
  const runs = boostRunsAll(t);
  const onB = runs.filter((r) => t.samples[r[0]].path === 1);
  assert.equal(onB.length, COURSE4.branches[0].pads.length);
});

// 地面の形（buildTerrain の三角）の、(x, z) の高さ（ます目の三角で補う）
function meshHeight(geo, x, z) {
  const pos = geo.attributes.position.array;
  const x0 = pos[0];
  const z0 = pos[2];
  let nx = 0;
  while (pos[(nx + 1) * 3 + 2] === z0) nx++;
  const G = pos[3] - pos[0];
  const i = Math.floor((x - x0) / G);
  const j = Math.floor((z - z0) / G);
  const u = (x - x0) / G - i;
  const v = (z - z0) / G - j;
  const h = (ii, jj) => pos[(jj * (nx + 1) + ii) * 3 + 1];
  // 三角 a(i,j) c(i,j+1) b(i+1,j) と b c d(i+1,j+1)
  if (u + v <= 1) return h(i, j) + (h(i + 1, j) - h(i, j)) * u + (h(i, j + 1) - h(i, j)) * v;
  return h(i + 1, j + 1) + (h(i, j + 1) - h(i + 1, j + 1)) * (1 - u) + (h(i + 1, j) - h(i + 1, j + 1)) * (1 - v);
}

test('雪山・地面は、トンネルの外のどの道（道はばいっぱい）の上にもかぶらない（トンネルの入口がふさがって見えない。2026-10-18 のユーザー依頼）', () => {
  const geo = buildTerrain(t).children[0].geometry;
  const bad = [];
  for (let i = 0; i < t.samples.length; i += 2) {
    const p = t.samples[i];
    if (p.y === null || p.tunnel || p.bridge || p.ramp) continue;
    for (let lat = -p.half; lat <= p.half; lat += 3) {
      const x = p.x - Math.sin(p.h) * lat;
      const z = p.z + Math.cos(p.h) * lat;
      const y = meshHeight(geo, x, z);
      if (y > p.y + 0.5) bad.push(`${i}(${lat}): ${y.toFixed(1)} > ${p.y.toFixed(1)}`);
    }
  }
  bad.sort((a, b) => parseFloat(b.split(': ')[1]) - parseFloat(b.split(' > ')[1]) - (parseFloat(a.split(': ')[1]) - parseFloat(a.split(' > ')[1])));
  assert.deepEqual(bad.slice(0, 8), [], `${bad.length} か所`);
});

test('トンネルの両がわの壁と天井は、上を別の道が通る所のほかは、いつもある（坂で壁や天井が消えて外が見えない）', () => {
  const a = buildTunnel(t).children[0].geometry.attributes.position;
  // 左右の壁の上のはし（天井の高さ）の頂点がある、トンネルの点
  const tops = { '-1': new Set(), 1: new Set(), ceil: new Set() };
  for (let k = 0; k < a.count; k++) {
    const x = a.getX(k);
    const y = a.getY(k);
    const z = a.getZ(k);
    for (let i = 0; i < L; i += 2) {
      const p = t.samples[i];
      if (!p.tunnel || Math.abs(p.x - x) > 17 || Math.abs(p.z - z) > 17) continue;
      const fwd = Math.cos(p.h) * (x - p.x) + Math.sin(p.h) * (z - p.z);
      const lat = -Math.sin(p.h) * (x - p.x) + Math.cos(p.h) * (z - p.z);
      if (Math.abs(fwd) > 2) continue;
      if (Math.abs(y - (p.y + TUNNEL_HEIGHT + 0.6)) < 0.6 && Math.abs(lat) < 1 + p.wall) tops.ceil.add(i); // 天井
      if (Math.abs(Math.abs(lat) - (p.wall + 0.5)) > 0.6) continue;
      if (Math.abs(y - (p.y + TUNNEL_HEIGHT)) < 0.6) tops[Math.sign(lat)].add(i);
    }
  }
  const missing = [];
  for (let i = 0; i < L; i += 2) {
    if (!t.samples[i].tunnel || t.samples[i].stacked) continue;
    for (const side of ['-1', 1, 'ceil']) if (!tops[side].has(i)) missing.push(`${i}(${side})`);
  }
  assert.ok(missing.length < 80, `${missing.length}: ${missing.join(" ")}`); // らせんに入る所（上の段が天井）だけ
});

test('観客席の前の加速板で速くなったまま、小さなジャンプで飛ぶ（速さが消えない。2026-10-18 のユーザー依頼）', () => {
  const kick = t.kicks[0];
  const fr = drive((kick.top - 40 + L) % L, 2);
  const k0 = fr.findIndex((k) => k.airborne && k.launched);
  assert.ok(fr[k0].speed > 40, `${fr[k0].speed}`);
  assert.ok(fr[k0].speed <= PHYS.KICK_MAX);
});

import { mainBoostRuns } from '../src/render/trackMesh.js';

test('本線の上に描く加速板は、本線の加速板の所だけ（B の加速板を本線に描かない。2026-10-18 のユーザー依頼「反応していない」）', () => {
  for (const [from, to] of mainBoostRuns(t)) {
    const mid = t.samples[Math.round((from + to) / 2) % L];
    assert.ok(mid.boost && mid.path === 0, `${from}〜${to} に本線の加速板がない`);
  }
});

test('トンネルの中（道から天井まで）には、雪山・地面の面が入りこまない（入口・中が白い面でふさがって見えない。2026-10-18 のユーザー依頼）', () => {
  const geo = buildTerrain(t).children[0].geometry;
  const bad = [];
  for (let i = 0; i < L; i += 2) {
    const p = t.samples[i];
    if (!p.tunnel) continue;
    for (let lat = -p.wall; lat <= p.wall; lat += 1.5) { // 道のはしから壁まで
      const y = meshHeight(geo, p.x - Math.sin(p.h) * lat, p.z + Math.cos(p.h) * lat);
      if (y > p.y + 0.2 && y < p.y + TUNNEL_HEIGHT) bad.push(`${i}(${lat}): ${(y - p.y).toFixed(1)}`);
    }
  }
  assert.deepEqual(bad.slice(0, 8), [], `${bad.length} か所`);
});

import { mergeArrowSpots } from '../src/render/trackMesh.js';

test('合流の手前の白い矢印は、スローの板の上に置かない（2026-10-18 のユーザー依頼）', () => {
  for (const p of mergeArrowSpots(t)) {
    const i = t.samples.indexOf(p);
    for (const sl of t.slows) assert.ok(p.path !== 0 || (i - sl.from + L) % L >= 34, `${i}`);
  }
  assert.ok(mergeArrowSpots(t).length >= 2);
});

test('道の横が下の地面より 3m 以上高い所には、いつも柵・手すり・壁がある（橋のつなぎ目から落ちそうに見えない。2026-10-18 のユーザー依頼）', () => {
  const f = fenceSides(t);
  const bad = [];
  t.samples.forEach((p, i) => {
    if (p.y === null) return;
    for (const side of [-1, 1]) {
      if (p.bridge || p.tunnel || p.ramp || f[i][side]) continue;
      const x = p.x - Math.sin(p.h) * side * (p.wall + 3);
      const z = p.z + Math.cos(p.h) * side * (p.wall + 3);
      if (p.y - terrainHeight(t, x, z) >= 3) bad.push(`${i}(${side})`);
    }
  });
  assert.deepEqual(bad.slice(0, 10), [], `${bad.length} か所`);
});
