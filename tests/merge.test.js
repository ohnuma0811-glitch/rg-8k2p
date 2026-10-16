import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKartModel, createBoarModel, createDinoModel, mergeStatic } from '../src/render/models.js';

const meshes = (o) => {
  let n = 0;
  let tri = 0;
  o.traverse((x) => {
    if (!x.isMesh) return;
    n++;
    tri += (x.geometry.index ? x.geometry.index.count : x.geometry.attributes.position.count) / 3;
  });
  return { n, tri };
};

test('動かない部品をまとめると、描く形の数がへる。三角の数と、動く部品（タイヤ・頭・あご）はそのまま（2026-10-16 のタブレットのカクつき）', () => {
  for (const make of [() => createKartModel({}), () => createBoarModel(0, 1), () => createDinoModel()]) {
    const before = meshes(make());
    const m = mergeStatic(make());
    const after = meshes(m);
    assert.ok(after.n <= before.n * 0.5, `${before.n} → ${after.n}`); // 足（4本）は動くので、イノシシは半分まで
    assert.equal(after.tri, before.tri);
    for (const v of Object.values(m.userData)) for (const o of Array.isArray(v) ? v : [v]) if (o && o.isObject3D) {
      let inside = false;
      m.traverse((x) => { if (x === o) inside = true; });
      assert.ok(inside, '動く部品が消えた');
    }
  }
});
