import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, locate, respawnIndex } from '../src/game/track.js';
import { COURSE1 } from '../src/data/tracks.js';

const track = buildTrack(COURSE1);
const { samples, cross } = track;
const J = COURSE1.jump;
const n = samples.length;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} != ${b}`);
const indexAt = (s) => ((Math.ceil(s) % n) + n) % n; // s より先で一番近い点
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const deg = (a) => (Math.abs(a) * 180) / Math.PI;

test('1周は1300m で、1mごとに点がある', () => {
  assert.equal(track.length, 1300);
  assert.equal(n, 1300);
  for (let i = 0; i < n; i++) {
    const q = samples[(i + 1) % n];
    near(Math.hypot(q.x - samples[i].x, q.z - samples[i].z), 1, 0.05, `点${i}の間隔`);
  }
});

test('コースは閉じていて、つなぎ目で向きが急に変わらない', () => {
  const last = samples[n - 1];
  near(Math.hypot(last.x - samples[0].x, last.z - samples[0].z), 1, 0.05, 'つなぎ目の間隔');
  assert.ok(deg(wrap(samples[0].h - last.h)) < 10);
});

test('交わる所はちょうど1か所。斜めの道（先に通る方）が手前、横の道があと', () => {
  assert.ok(cross.sA < 100, `${cross.sA}`);
  assert.ok(cross.sB > cross.sA + 500, `${cross.sB}`);
  const angle = deg(wrap(samples[Math.round(cross.sA)].h - samples[Math.round(cross.sB)].h));
  assert.ok(angle > 50 && angle < 130, `交わる角度 ${angle}`);
});

test('加速板からジャンプの着地までは、ほぼまっすぐ（向きの変わり15度未満）', () => {
  const a = samples[indexAt(cross.sA + J.boost.from)];
  const b = samples[indexAt(cross.sA + J.gap.to + 20)];
  assert.ok(deg(wrap(b.h - a.h)) < 15);
});

test('交わる所のほかは、道どうしが柵2つ分より離れている（重ならない）', () => {
  const minGap = 2 * (COURSE1.roadHalf + COURSE1.dirt) + 4;
  for (let i = 0; i < n; i += 3) {
    for (let j = i + 80; j < n; j += 3) {
      if (n - (j - i) < 80) continue;
      const a = samples[i];
      const b = samples[j];
      if (Math.hypot(a.x - cross.x, a.z - cross.z) < 60) continue;
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > minGap, `点${i}と点${j}が近い`);
    }
  }
});

test('ジャンプ台はだんだん高くなり、その先の地面がない所の下を、横の道が通る', () => {
  const r0 = samples[indexAt(cross.sA + J.ramp.from)];
  const r1 = samples[indexAt(cross.sA + J.ramp.to) - 1];
  assert.ok(r0.ramp && r1.ramp);
  near(r0.y, 0, 0.2, 'ジャンプ台の始まり');
  near(r1.y, J.ramp.height, 0.2, 'ジャンプ台の終わり');
  assert.equal(samples[indexAt(cross.sA)].y, null);
  assert.equal(samples[indexAt(cross.sA + J.gap.to) + 1].y, 0);
  assert.equal(samples[Math.round(cross.sB)].y, 0);
  assert.ok(samples[indexAt(cross.sA + J.boost.from)].boost);
});

test('交わる所の近くでは、hint があれば自分の道の点を返す（もう一方の道に飛ばない）', () => {
  const iA = Math.round(cross.sA);
  const locA = locate(track, cross.x, cross.z, iA - 2);
  assert.ok(Math.abs(locA.i - iA) <= 2, `斜めの道: ${locA.i} / ${iA}`);
  const iB = Math.round(cross.sB);
  const locB = locate(track, cross.x, cross.z, iB + 2);
  assert.ok(Math.abs(locB.i - iB) <= 2, `横の道: ${locB.i} / ${iB}`);
  assert.equal(locA.ground, null);
  assert.equal(locB.ground, 0);
});

test('道・ダート・コースの外を、中心線からの距離で分ける（右が正）', () => {
  const i = 400;
  const p = samples[i];
  const at = (lat) => locate(track, p.x - Math.sin(p.h) * lat, p.z + Math.cos(p.h) * lat, i);
  assert.equal(at(0).surface, 'road');
  assert.equal(at(8.9).surface, 'road');
  assert.equal(at(-11).surface, 'dirt');
  assert.equal(at(14).surface, 'out');
  near(at(5).lateral, 5, 1e-6, '右へ5m');
  near(at(-5).lateral, -5, 1e-6, '左へ5m');
});

test('ジャンプ台の上にはダートがない（道の外はすぐ柵）', () => {
  const i = indexAt(cross.sA + J.ramp.from + 10);
  const p = samples[i];
  const loc = locate(track, p.x - Math.sin(p.h) * 10, p.z + Math.cos(p.h) * 10, i);
  assert.equal(loc.surface, 'out');
});

test('交わる所で落ちたら、加速板より手前の平らな所に戻る', () => {
  const j = respawnIndex(track, Math.round(cross.sA));
  const d = ((samples[j].s - cross.sA) % n + n) % n - n;
  assert.ok(d < J.boost.from - 5 && d > J.boost.from - 30, `${d}`);
  assert.equal(samples[j].y, 0);
});

test('交わる所のまわりは柵を描かない（ジャンプ台・地面がない所は除く）', () => {
  assert.ok(samples[Math.round(cross.sB)].noWall);
  assert.ok(!samples[400].noWall);
  assert.ok(!samples[Math.round(cross.sA)].noWall);
});

test('スタートラインは横の道の、交わる所の手前', () => {
  const p = samples[track.startIndex];
  near(cross.sB - p.s, COURSE1.startBeforeCross, 1.5, 'スタートから交わる所まで');
});

test('きついカーブ（20mで60度以上曲がる所）はちょうど3か所で、どれも大きく（80度以上）曲がる', () => {
  const curves = [];
  let start = null;
  for (let i = 0; i < n; i++) {
    const turn = deg(wrap(samples[(i + 20) % n].h - samples[i].h));
    if (turn >= 60 && start === null) start = i;
    if (turn < 40 && start !== null) {
      curves.push([start, i]);
      start = null;
    }
  }
  assert.equal(curves.length, 3, `${curves.length}か所`);
  for (const [a, b] of curves) {
    const total = deg(wrap(samples[(b + 30) % n].h - samples[(a - 30 + n) % n].h));
    assert.ok(total >= 80, `s=${a} で ${total.toFixed(0)}度`);
  }
});
