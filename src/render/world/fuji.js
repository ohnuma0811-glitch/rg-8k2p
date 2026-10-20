// Global City の富士山のふもとと、新幹線と並走する道（2026-10-20）。富士山の山は地面（src/render/terrain.js の peaks）
import * as THREE from '../../../vendor/three.module.min.js';
import { createBuilder } from '../town/builder.js';
import { locate } from '../../game/track.js';
import { terrainHeight } from '../terrain.js';
import { GLOBAL_SCENERY } from '../../data/global.js';
import { landmark, worldAt, sOf, along, beside, pointAt, coneTree } from './kit.js';

const ryAlong = (h) => Math.atan2(Math.cos(h), Math.sin(h));
const clear = (track, x, z, gap) => {
  const loc = locate(track, x, z, null, 40);
  return Math.abs(loc.lateral) > loc.wall + gap;
};

export function buildFuji(track) {
  const S = GLOBAL_SCENERY.fuji;
  const root = new THREE.Group();
  const g = new THREE.Group();
  g.userData.stages = [1];
  root.add(g);
  const b = createBuilder();
  const m = worldAt(track, S.mountain.at);
  landmark(g, 'fujiMountain', m.x, 600, m.z);

  // すそ野の森（道から離して、山の斜面に）
  const f = worldAt(track, S.forest.center);
  for (let k = 0; k < S.forest.count; k++) {
    const a = k * 2.399963; // 黄金角でちらす
    const r = S.forest.r * Math.sqrt((k + 0.5) / S.forest.count);
    const x = f.x + Math.cos(a) * r;
    const z = f.z + Math.sin(a) * r;
    if (!clear(track, x, z, 6)) continue;
    coneTree(b, x, terrainHeight(track, x, z), z, 1.4 + (k % 3) * 0.3, k % 4 ? 0x2f5d3a : 0x3b6b45);
  }

  // 新幹線の高架（並走の道の北がわ）
  const sh = S.shinkansen;
  along(track, sh.from, sh.to, 25, (p) => {
    const c = beside(p, sh.off);
    b.push(c.x, 0, c.z, ryAlong(p.h));
    b.box(3, sh.y, 2.5, 0xb8bcc2, 0, 0, 0);
    b.box(13, 1.6, 26, 0xc8ccd2, 0, sh.y, 0);
    for (const x of [-3, 3]) b.box(0.3, 0.3, 26, 0x444a50, x, sh.y + 1.6, 0);
    b.pop();
  });
  const mid = pointAt(track, (sOf(track, sh.from) + sOf(track, sh.to)) / 2);
  const mc = beside(mid, sh.off);
  landmark(g, 'shinkansenParallel', mc.x, sh.y, mc.z);

  // 田んぼ（水のはった四角に、緑の苗の列）と茶畑（緑のかまぼこの列）
  for (const at of S.paddies) {
    const w = worldAt(track, at);
    b.box(150, 0.1, 60, 0x7aa8b8, w.x, 0.02, w.z);
    for (let k = -27; k <= 27; k += 3) b.box(146, 0.25, 0.5, 0x6aa84f, w.x, 0.1, w.z + k);
  }
  for (const at of S.tea) {
    const w = worldAt(track, at);
    for (let k = -24; k <= 24; k += 4) {
      b.push(w.x, 0, w.z + k, 0);
      b.box(150, 1.2, 2.2, 0x4f8a3a, 0, 0, 0);
      b.pop();
    }
  }
  landmark(g, 'paddies', worldAt(track, S.paddies[0]).x, 0, worldAt(track, S.paddies[0]).z);
  g.add(b.build());
  return root;
}
