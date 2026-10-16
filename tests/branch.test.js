import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, locate, ahead, behind, markS, span } from '../src/game/track.js';
import { COURSE1, COURSE2, COURSE3 } from '../src/data/tracks.js';

const t = buildTrack(COURSE3);
const L = t.length;

test('分かれ道が2本（真ん中の道・内の道）。本線の点の番号は今までと同じ 0〜1周の長さ', () => {
  assert.deepEqual(t.paths.map((p) => p.id), ['main', 'middle', 'inner']);
  for (let i = 0; i < L; i++) assert.equal(t.samples[i].path, 0);
  assert.ok(t.samples.length > L);
});

test('分かれ道の点は、分かれる所から合流する所へつながり、s は本線の場所で、なめらかに増える', () => {
  for (const path of t.paths.slice(1)) {
    const first = t.samples[path.start];
    const last = t.samples[path.start + path.count - 1];
    assert.ok(Math.hypot(first.x - t.samples[path.fork].x, first.z - t.samples[path.fork].z) < 3, `${path.id} の分かれる所`);
    assert.ok(Math.hypot(last.x - t.samples[path.join].x, last.z - t.samples[path.join].z) < 3, `${path.id} の合流する所`);
    assert.equal(last.next, path.join);
    assert.equal(first.prev, path.fork);
    for (let k = 1; k < path.count; k++) {
      const a = t.samples[path.start + k - 1];
      const b = t.samples[path.start + k];
      assert.ok(span(t, a.s, b.s) > 0 && span(t, a.s, b.s) < 3, `${path.id} ${k}`);
      assert.ok(Math.hypot(b.x - a.x, b.z - a.z) < 1.6, `${path.id} の点の間が広い`);
    }
  }
  // 内の道は真ん中の道から分かれ、本線の合流②へ
  const inner = t.paths[2];
  assert.equal(t.samples[inner.fork].path, 1);
  assert.ok(Math.abs(t.samples[inner.join].s - markS(t, ['M2', 'M2', 0])) < 2);
});

test('長さ: 外の道（本線）＞ 真ん中の道 ＞ 内の道（近道）', () => {
  const lenMain = span(t, markS(t, ['F1', 'F1', 0]), markS(t, ['M2', 'M2', 0]));
  const lenMiddle = t.paths[1].len + span(t, markS(t, ['M1', 'M1', 0]), markS(t, ['M2', 'M2', 0]));
  const f2 = t.samples[t.paths[2].fork];
  const lenInner = f2.along - t.samples[t.paths[1].fork].along + t.paths[2].len;
  assert.ok(lenMain > lenMiddle && lenMiddle > lenInner, `${lenMain} ${lenMiddle} ${lenInner}`);
});

test('ahead / behind: 分かれる所で選んだ道を進み、合流する所でつながる', () => {
  const f1 = t.paths[1].fork;
  assert.equal(t.samples[ahead(t, f1, 5, () => null)].path, 0); // 選ばなければ本線
  assert.equal(t.samples[ahead(t, f1, 5, (i, paths) => paths[0])].path, 1); // 真ん中の道へ
  const last = t.paths[1].start + t.paths[1].count - 1;
  assert.equal(t.samples[ahead(t, last, 3, () => null)].path, 0); // 合流して本線
  assert.equal(behind(t, t.paths[1].start, 1), f1);
});

test('locate: 分かれ道の上にいるときは分かれ道の点、本線の上にいるときは本線の点（ワープしない）', () => {
  for (const path of t.paths) {
    const from = path.id === 'main' ? 0 : path.start;
    const to = path.id === 'main' ? L : path.start + path.count;
    for (let i = from; i < to; i += 37) {
      const p = t.samples[i];
      const loc = locate(t, p.x, p.z, i);
      assert.equal(t.samples[loc.i].path, p.path, `${path.id} ${i}`);
      assert.ok(Math.abs(loc.lateral) < 0.5);
    }
  }
});

test('分かれる所の近くでは、locate はとなりの道の点も探す（分かれ道へ入ったら、分かれ道の点になる）', () => {
  const mid = t.paths[1];
  const p = t.samples[mid.start + 30];
  const loc = locate(t, p.x, p.z, mid.fork);
  assert.equal(t.samples[loc.i].path, 1);
});

test('分かれ道がないコースでは、locate と点のつながりは今までと同じ', () => {
  for (const def of [COURSE1, COURSE2]) {
    const c = buildTrack(def);
    assert.equal(c.samples.length, c.length);
    assert.equal(c.samples[c.length - 1].next, 0);
    assert.equal(ahead(c, c.length - 2, 3), 1);
    assert.equal(behind(c, 1, 3), c.length - 2);
  }
});

test('分かれる所・合流する所では、柵がほかの道の上に立たない（道がふさがらない）', async () => {
  const { fenceSides } = await import('../src/render/trackMesh.js');
  const fences = fenceSides(t);
  for (const [i, p] of t.samples.entries()) {
    for (const side of [-1, 1]) {
      if (!fences[i][side]) continue;
      const x = p.x - Math.sin(p.h) * side * p.wall;
      const z = p.z + Math.cos(p.h) * side * p.wall;
      for (const q of t.samples) {
        if (q.path === p.path) continue;
        assert.ok(Math.hypot(q.x - x, q.z - z) > q.half - 0.5, `道 ${p.path} の柵が道 ${q.path} の上（点 ${i}）`);
      }
    }
  }
});

test('ミニマップは3本の道をどれも描く', async () => {
  const { minimapPaths } = await import('../src/render/minimap.js');
  const paths = minimapPaths(t);
  assert.equal(paths.length, 3);
  assert.ok(paths.every((ps) => ps.length > 50));
});
