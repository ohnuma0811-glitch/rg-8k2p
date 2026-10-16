import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { COURSE3 } from '../src/data/tracks.js';
import { terrainHeight } from '../src/render/terrain.js';
import { buildScenery } from '../src/render/town/scenery.js';
import { SOKI_SCENERY } from '../src/data/soki.js';
import { locate } from '../src/game/track.js';
import { jungleSpots } from '../src/render/town/jungle.js';

const t = buildTrack(COURSE3);

test('道のすぐ外の地面は、道とほぼ同じ高さ（道が浮いたり埋まったりしない）', () => {
  for (let i = 0; i < t.samples.length; i += 7) {
    const p = t.samples[i];
    if (p.y === null || p.bridge || p.ramp) continue;
    for (const side of [-1, 1]) {
      const d = p.wall + 1;
      const y = terrainHeight(t, p.x - Math.sin(p.h) * side * d, p.z + Math.cos(p.h) * side * d);
      assert.ok(y <= p.y + 0.05 && y > p.y - 1.5, `点 ${i}: 地面 ${y.toFixed(2)} 道 ${p.y.toFixed(2)}`);
    }
  }
});

test('道の上の地面は、道より下（橋の下の道は、橋の高さに引っぱられない）', () => {
  for (let i = 0; i < t.samples.length; i += 5) {
    const p = t.samples[i];
    if (p.y === null || p.bridge) continue;
    assert.ok(terrainHeight(t, p.x, p.z) <= p.y + 0.01, `点 ${i}`);
  }
});

test('川の上は、まわりより低い（水が見える）', () => {
  for (const [x, z] of COURSE3.river.slice(1, -1)) {
    // データの座標を、コースの座標に直す（buildTrack と同じ倍率）
    const p = t.toWorld(x, z);
    assert.ok(terrainHeight(t, p.x, p.z) < -1, `${x},${z}`);
  }
});

test('スタートの丸太の門に「Soki Forest」（小文字もまぜる）。森の名前の看板はない', () => {
  const gate = SOKI_SCENERY.find((i) => i.part === 'logGate');
  assert.equal(gate.text, 'Soki Forest');
  assert.ok(!SOKI_SCENERY.some((i) => (i.text ?? '').includes('ブリッジ')));
});

test('見どころ: 大きな丘の大きな木、きのこと岩の広場、道ばたの花と切り株', () => {
  for (const part of ['bigTree', 'mushroom', 'rock', 'flowers', 'stump']) assert.ok(SOKI_SCENERY.some((i) => i.part === part), part);
});

test('地面に立つ景色は、走れる所に置かない。置く高さは地面の高さ', () => {
  const group = buildScenery(t, SOKI_SCENERY, (x, z) => terrainHeight(t, x, z));
  assert.ok(group.userData.spots.some((sp) => sp.path > 0), '分かれ道の道ばたにも置く');
  for (const sp of group.userData.spots) {
    if (sp.side === 0) continue;
    const loc = locate(t, sp.x, sp.z);
    assert.equal(loc.surface, 'out', `${sp.part}（s=${sp.s.toFixed(0)}）`);
    assert.ok(Math.abs(sp.y - terrainHeight(t, sp.x, sp.z)) < 0.01, `${sp.part} の高さ`);
  }
});

test('外周はジャングル、森の中（コースに囲まれた所）はブロッコリーの木。どちらも道にかからない', () => {
  const outside = jungleSpots(t, [], { inside: false });
  const inside = jungleSpots(t, [], { inside: true });
  assert.ok(outside.length > 200 && inside.length > 100, `${outside.length} ${inside.length}`);
  for (const p of [...outside, ...inside]) assert.equal(locate(t, p.x, p.z).surface, 'out');
});
