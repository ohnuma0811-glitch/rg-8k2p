import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, stageAt, markS, span } from '../src/game/track.js';
import { COURSES } from '../src/data/tracks.js';
import { rowSpots, rowBoxes, createBoxes, stepBoxes, touchBoxes, BOX_RESPAWN, ROW_CLEAR } from '../src/game/itemBoxes.js';

const tracks = COURSES.map((c) => buildTrack(c));

test('箱の列: 周回のあるコースは1周に1列（Soki Forest は内側の道にもう1列、Kampar Town は ECONSAVE の前、Soki Forest はマップの下にもう1列）。World Cities は5列', () => {
  assert.deepEqual(tracks.map((t) => rowSpots(t).length), [1, 2, 3, 1, 5]);
});

test('Kampar Town: ECONSAVE の横断幕の手前 30m 以内に1列（2026-10-22 のユーザー依頼）', () => {
  const t = tracks[1];
  const banner = markS(t, ['B', 'C', 0.66]);
  assert.ok(rowSpots(t).some((i) => { const d = span(t, t.samples[i].s, banner); return d > 0 && d < 30; }));
});

test('列の前後 15m は、地面があり、ジャンプ台・加速板・橋・自動の区間・無い道・小さなジャンプ台でない', () => {
  for (const t of tracks) {
    for (const i of rowSpots(t)) {
      let a = i;
      let b = i;
      for (let k = 0; k <= ROW_CLEAR; k++) {
        for (const j of [a, b]) {
          const p = t.samples[j];
          assert.ok(p.y !== null && !p.ramp && !p.boost && !p.bridge && !p.auto && !p.void && !p.kick && !(p.median > 0), `${t.def.name} 点 ${j}`);
        }
        a = t.samples[a].next;
        b = t.samples[b].prev;
      }
    }
  }
});

test('周回のあるコースの本線の列は、スタートから 0.35〜0.65 周の所（場所を決めたコースはのぞく）', () => {
  for (const t of tracks.slice(0, 4).filter((t) => !t.def.itemRows)) {
    const main = rowSpots(t).filter((i) => t.samples[i].path === 0);
    assert.equal(main.length, 1, t.def.name);
    const rel = (t.samples[main[0]].s - t.samples[t.startIndex].s + t.length) % t.length;
    assert.ok(rel > 0.35 * t.length && rel < 0.65 * t.length, `${t.def.name}: ${rel}`);
  }
});

test('Kenta Circuit: 列はコースマップの左下（2026-10-22 のユーザー依頼）', () => {
  const t = tracks[0];
  const spots = rowSpots(t);
  assert.equal(spots.length, 1);
  const xs = t.samples.map((p) => p.x);
  const zs = t.samples.map((p) => p.z);
  const p = t.samples[spots[0]];
  const fx = (p.x - Math.min(...xs)) / (Math.max(...xs) - Math.min(...xs));
  const fz = (p.z - Math.min(...zs)) / (Math.max(...zs) - Math.min(...zs));
  assert.ok(fx < 0.3 && fz > 0.7, `左 ${fx.toFixed(2)} / 下 ${fz.toFixed(2)}`);
});

test('Soki Forest: コースマップの下（スタートのあとの直線）にも1列（2026-10-22 のユーザー依頼）', () => {
  const t = tracks[2];
  const zs = t.samples.map((p) => p.z);
  const z0 = Math.min(...zs);
  const z1 = Math.max(...zs);
  assert.ok(rowSpots(t).some((i) => t.samples[i].path === 0 && (t.samples[i].z - z0) / (z1 - z0) > 0.9));
});

test('Soki Forest: 本線の列を通らない内側の道（inner）にも1列', () => {
  const t = tracks[2];
  const ids = rowSpots(t).map((i) => t.paths[t.samples[i].path].id);
  assert.deepEqual(ids.sort(), ['inner', 'main', 'main']);
});

test('World Cities の列は、東京・富士山・京都・海底・ニューヨーク', () => {
  const t = tracks[4];
  const names = rowSpots(t).map((i) => t.stages[stageAt(t, t.samples[i].s)].name);
  assert.deepEqual(names, ['TOKYO', 'MT. FUJI', 'KYOTO', 'UNDER THE SEA', 'NEW YORK']);
});

test('1列は道幅に合わせて4〜6個、柵の内側に横一列', () => {
  for (const t of tracks) {
    for (const i of rowSpots(t)) {
      const p = t.samples[i];
      const row = rowBoxes(t, i);
      assert.ok(row.length >= 4 && row.length <= 6, `${t.def.name}: ${row.length}`);
      for (const b of row) {
        const lat = -(b.x - p.x) * Math.sin(p.h) + (b.z - p.z) * Math.cos(p.h);
        const along = (b.x - p.x) * Math.cos(p.h) + (b.z - p.z) * Math.sin(p.h);
        assert.ok(Math.abs(lat) <= p.half - 1, `${t.def.name}: 横 ${lat}`);
        assert.ok(Math.abs(along) < 0.01);
      }
    }
  }
  assert.equal(createBoxes(tracks[0]).length, rowBoxes(tracks[0], rowSpots(tracks[0])[0]).length);
});

test('触れた箱は消え、2秒たつと同じ場所に戻る。離れていれば取らない', () => {
  const boxes = createBoxes(tracks[1]);
  const b = boxes[0];
  const kart = { x: b.x + 200, z: b.z, y: b.y };
  assert.equal(touchBoxes(boxes, kart), false);
  kart.x = b.x + 1;
  assert.equal(touchBoxes(boxes, kart), true);
  assert.equal(b.gone, BOX_RESPAWN);
  assert.equal(touchBoxes(boxes, kart), false, '消えている箱は取れない');
  stepBoxes(boxes, 1.9);
  assert.ok(b.gone > 0);
  stepBoxes(boxes, 0.2);
  assert.equal(b.gone, 0);
  assert.equal(touchBoxes(boxes, kart), true);
});

test('高さがちがう（ジャンプで上を飛んでいる）車は、箱を取らない', () => {
  const boxes = createBoxes(tracks[1]);
  const b = boxes[0];
  assert.equal(touchBoxes(boxes, { x: b.x, z: b.z, y: b.y + 4 }), false);
});
