// Global City の空の雲（2026-10-21 のユーザー依頼「景色が無ければ空に雲を入れたり」）: 昼と夕方のステージに、道の上の空に白い雲
import * as THREE from '../../../vendor/three.module.min.js?v=187c0cd';
import { createBuilder } from '../town/builder.js?v=187c0cd';
import { landmark, pointAt, beside } from './kit.js?v=187c0cd';

const DAY = [0, 1, 2, 5, 6]; // 雲を出すステージ（香港は夜、海の底は水の中）

export function buildClouds(track) {
  const root = new THREE.Group();
  const st = track.stages ?? [];
  for (const k of DAY) {
    if (!st[k]) continue;
    const from = st[k].s;
    const to = st[k + 1]?.s ?? track.finish ?? track.length;
    const g = new THREE.Group();
    g.userData.stages = [k];
    const b = createBuilder();
    let n = 0;
    for (let s = from; s < to; s += 110) {
      const p = pointAt(track, s);
      if (p.y === null || p.auto) continue;
      for (const side of [-1, 1]) {
        n++;
        const lat = side * (220 + ((n * 97) % 320));
        const c = beside(p, lat);
        const y = 170 + ((n * 53) % 150);
        const sz = 14 + ((n * 31) % 12);
        landmark(g, 'cloud', c.x, y, c.z);
        for (let j = 0; j < 4; j++) b.sphere(sz * (1 - j * 0.15), k === 6 ? 0xf2d6e6 : 0xffffff, c.x + (j - 1.5) * sz * 0.9, y + (j % 2) * sz * 0.3, c.z + ((j * 7) % 5 - 2) * 3, 7);
      }
    }
    g.add(b.build());
    root.add(g);
  }
  return root;
}
