// コースの動かない形を、同じ材質ごと・区画ごとに1つの形にまとめる（描く回数を減らす。2026-10-16 のユーザー依頼「タブレットでカクつく」）
// 区画（chunk m）に分けるのは、画面に映らない区画を描かないため
import * as THREE from '../../vendor/three.module.min.js?v=bdab420';

// まとめてよい形か: 動かない（onBeforeRender なし・userData.keep なし）、ふつうの三角の形
function mergeable(m) {
  return m.isMesh && !m.isInstancedMesh && !m.isSkinnedMesh && m.onBeforeRender === THREE.Object3D.prototype.onBeforeRender && !m.userData.keep && !Array.isArray(m.material);
}

// 材質の中身（同じなら、別々に作った材質でも同じに描ける）
function matKey(mat) {
  return [mat.type, mat.color?.getHex(), mat.map?.uuid ?? '', mat.transparent, mat.opacity, mat.side, mat.vertexColors, mat.depthWrite, mat.depthTest, mat.alphaTest, mat.fog].join(':');
}

export function mergeMeshes(root, chunk = 250) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const center = new THREE.Vector3();
  root.traverse((m) => {
    if (!mergeable(m) || !m.visible) return;
    const geo = m.geometry;
    const names = Object.keys(geo.attributes).sort().join(',');
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    center.copy(geo.boundingSphere.center).applyMatrix4(m.matrixWorld);
    const key = `${matKey(m.material)}|${names}|${Math.floor(center.x / chunk)},${Math.floor(center.z / chunk)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(m);
  });
  let before = 0;
  let after = 0;
  for (const list of buckets.values()) {
    before += list.length;
    if (list.length < 2) {
      after++;
      continue;
    }
    const names = Object.keys(list[0].geometry.attributes);
    const arrays = Object.fromEntries(names.map((n) => [n, []]));
    const sizes = Object.fromEntries(names.map((n) => [n, list[0].geometry.attributes[n].itemSize]));
    for (const m of list) {
      const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      for (const n of names) {
        const a = geo.attributes[n].array;
        const out = arrays[n];
        for (let i = 0; i < a.length; i++) out.push(a[i]);
      }
      m.parent.remove(m);
    }
    const geo = new THREE.BufferGeometry();
    for (const n of names) geo.setAttribute(n, new THREE.Float32BufferAttribute(arrays[n], sizes[n]));
    const merged = new THREE.Mesh(geo, list[0].material);
    merged.renderOrder = list[0].renderOrder;
    root.add(merged);
    after++;
  }
  return { before, after };
}
