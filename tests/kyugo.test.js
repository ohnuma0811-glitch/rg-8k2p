import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, markS, locate, span, between, expandHelix, GRIP_SNOW, GRIP_ICE } from '../src/game/track.js';
import { createCpu, cpuControl, cpuParams } from '../src/game/cpu.js';
import { COURSE4, COURSES } from '../src/data/tracks.js';
import { buildBridge } from '../src/render/forest/bridge.js';
import { fenceSides } from '../src/render/trackMesh.js';
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

test('橋の形は、上の道（③ は B）の下に作る', () => {
  const g = buildBridge(t, { snow: true });
  const a = g.children[0].geometry.attributes.position;
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
  assert.ok(top > 2.2 && top < 4, `${top}`); // 雪だるま（高さ 約2.4m）の頭を越えるが、① ほど高くない
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

test('すべりやすさ: スタート〜観客席の先とトンネルはアスファルト（1）、雪の道は 0.6、A の凍った所（3か所、25m）は 0.25', () => {
  assert.equal(t.samples[t.startIndex].grip, 1);
  assert.equal(at('GS').grip, 1);
  assert.equal(at(['TI', 'TO', 0.5]).grip, 1);
  assert.equal(at(['X1', 'FK', 0.5]).grip, GRIP_SNOW);
  assert.equal(onB(0.5).grip, GRIP_SNOW);
  assert.equal(t.ices.length, 3);
  for (const ice of t.ices) {
    assert.ok(between(t, t.samples[ice.from].s, t.marks.XJ, t.marks.MG));
    assert.ok(Math.abs(span(t, t.samples[ice.from].s, t.samples[ice.to].s) - 25) < 2);
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
    for (let f = 0; f < 30; f++) stepKart(kart, { throttle: 1, brake: 0, steer: 1, drift: false }, t, params, 1 / 60);
    t.samples.forEach((p, i) => { p.grip = save[i]; });
    return Math.abs(Math.atan2(Math.sin(kart.heading - kart.move), Math.cos(kart.heading - kart.move)));
  };
  assert.ok(run(GRIP_ICE) > run(GRIP_SNOW) * 1.5);
  assert.ok(run(GRIP_SNOW) > run(1) * 1.2);
});

test('CPU が雪と氷の道で3周を走りきる。動けなくならない（6秒で 15m 以上進む）', () => {
  for (let seed = 0; seed < 3; seed++) {
    const kart = createKart(t, t.startIndex, 0);
    const cpu = createCpu(1, seed);
    const hist = [];
    let laps = 0;
    let prevS = t.samples[kart.seg].s;
    for (let f = 0; f < 60 * 300 && laps < 3; f++) {
      stepKart(kart, cpuControl(cpu, kart, t, f / 60), t, cpuParams(params, 1), 1 / 60);
      const s = t.samples[kart.seg].path === 0 ? t.samples[kart.seg].s : prevS;
      if (prevS > L - 200 && s < 200) laps++;
      prevS = s;
      if (f % 30) continue;
      hist.push({ x: kart.x, z: kart.z });
      if (hist.length < 13) continue;
      const a = hist[hist.length - 13];
      assert.ok(Math.hypot(a.x - kart.x, a.z - kart.z) > 15, `seed ${seed}: 点 ${kart.seg} で止まった`);
    }
    assert.equal(laps, 3, `seed ${seed}`);
  }
});
