import { test } from 'node:test';
import assert from 'node:assert/strict';

// 香港が 30fps（2026-10-22 のユーザー依頼）: 中国語のネオン看板は、1枚の絵（字の並んだ絵）にまとめて、少ない回数で描く
// 看板の字の絵は canvas で描くので、何も描かない代わりの canvas を用意する（このファイルだけ）
const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : k === 'measureText' ? () => ({ width: 10 }) : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}), set: (o, k, v) => { o[k] = v; return true; } });
globalThis.document = { createElement: () => ({ width: 1, height: 1, getContext: () => ctx, style: {} }) };

const { buildTrack } = await import('../src/game/track.js');
const { COURSE5 } = await import('../src/data/tracks.js');
const { buildHongKong } = await import('../src/render/world/hongkong.js');

test('香港の中国語のネオン看板は、1枚の絵にまとめて描く（看板の数だけ描かない）', () => {
  const t = buildTrack(COURSE5);
  const g = buildHongKong(t);
  let signs = 0;
  g.traverse((o) => { if (o.userData.landmark === 'hkSign') signs++; });
  assert.ok(signs > 30, `看板 ${signs} 枚`);
  const neon = [];
  g.traverse((o) => { if (o.isMesh && o.material?.map && o.userData.neon) neon.push(o); });
  assert.ok(neon.length >= 1 && neon.length <= 2, `ネオンの形 ${neon.length} 個`);
  // 看板1枚に、前と後ろの2面（4つの角 × 2面 = 三角 4つ）
  const tris = neon.reduce((a, m) => a + m.geometry.attributes.position.count / 3, 0);
  assert.equal(tris, signs * 4);
  // 絵の場所（uv）は 0〜1 の中
  for (const m of neon) for (const v of m.geometry.attributes.uv.array) assert.ok(v >= 0 && v <= 1);
});
