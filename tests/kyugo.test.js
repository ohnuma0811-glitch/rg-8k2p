import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, markS, locate, span, between } from '../src/game/track.js';
import { COURSE4, COURSES } from '../src/data/tracks.js';
import { buildBridge } from '../src/render/forest/bridge.js';

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
