import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { releaseTrack, tracksToRelease, TRACK_CACHES } from '../src/render/release.js';

// タイトル・名前・コース選びが重い（2026-10-22 のユーザー依頼）: 作ったコースの形を全部取っておくと、タブレットのメモリが足りなくなる。
// 取っておくのは、タイトルのコースと、今のコースだけ
function fakeTrack() {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const tex = new THREE.Texture();
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const mesh = new THREE.Group();
  mesh.add(new THREE.Mesh(geo, mat));
  const disposed = { geo: 0, tex: 0, mat: 0 };
  geo.addEventListener('dispose', () => disposed.geo++);
  tex.addEventListener('dispose', () => disposed.tex++);
  mat.addEventListener('dispose', () => disposed.mat++);
  return { track: { mesh, busModels: [1], cowModels: [2], trainModels: [3], samples: [] }, disposed };
}

test('コースの形を手放すと、形・材質・絵を片づけて、もう一度作れるように消す（道の計算はそのまま）', () => {
  const { track, disposed } = fakeTrack();
  releaseTrack(track);
  assert.deepEqual(disposed, { geo: 1, tex: 1, mat: 1 });
  for (const key of TRACK_CACHES) assert.equal(track[key], undefined, key);
  assert.deepEqual(track.samples, [], '道の計算（samples）は残す');
  releaseTrack(track); // 2回目は何もしない
  assert.deepEqual(disposed, { geo: 1, tex: 1, mat: 1 });
});

test('新しいコースを作るときは、タイトルのコースと、そのコースのほかは手放す', () => {
  const a = { id: 'title' };
  const b = { id: 'b' };
  const c = { id: 'c' };
  const built = new Map([[a, { mesh: {} }], [b, { mesh: {} }], [c, {}]]);
  assert.deepEqual(tracksToRelease(built, [a, c]), [built.get(b)]);
  assert.deepEqual(tracksToRelease(built, [a, b]), [], '形のないコースは手放すものがない');
});
