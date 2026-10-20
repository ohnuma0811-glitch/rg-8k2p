// Global City の香港（2026-10-20）: 夜。香港島の中環（セントラル）の高層ビル群の間を抜ける。ネオンの看板がギラギラ光る。北がわがビクトリア湾
import * as THREE from '../../../vendor/three.module.min.js?v=0e5d133';
import { createBuilder } from '../town/builder.js?v=0e5d133';
import { locate } from '../../game/track.js?v=0e5d133';
import { GLOBAL_SCENERY } from '../../data/global.js?v=0e5d133';
import { landmark, worldAt, sOf, along, beside, pointAt, tower } from './kit.js?v=0e5d133';
import { cityBlocks } from './tokyo.js?v=0e5d133';

const NEON = [0xff2d6f, 0x2de0ff, 0xffe12d, 0x7dff3a, 0xff7a1a, 0xc23aff];
const ryAlong = (h) => Math.atan2(Math.cos(h), Math.sin(h));

export function buildHongKong(track) {
  const S = GLOBAL_SCENERY.hongkong;
  const root = new THREE.Group();
  const g = new THREE.Group();
  g.userData.stages = [3];
  root.add(g);
  const b = createBuilder();
  const glow = createBuilder({ glow: true });
  const WIN = 0xffe0a0;

  // 中環の高層ビル（夜の窓が光る）
  S.central.forEach(([x, z], k) => {
    const w = worldAt(track, [x, z]);
    const loc = locate(track, w.x, w.z, null, 40);
    if (Math.abs(loc.lateral) < loc.wall + 30) return;
    tower(b, w.x, w.z, 0, 40 + (k % 3) * 10, 36, 140 + ((k * 47) % 140), [0x2a3442, 0x34404e, 0x3e4a58][k % 3], { glow, win: k % 2 ? WIN : 0xbfe6ff });
  });
  landmark(g, 'central', worldAt(track, S.central[2]).x, 0, worldAt(track, S.central[2]).z);
  cityBlocks(b, track, 'HL', 'SD', { glow, win: WIN, colors: [0x2a3442, 0x3a3440, 0x30383a], hMin: 60, hMax: 200, back: 26, step: 45 });

  // 中国銀行タワー（三角の断面を段々に。白い斜めの線）
  const boc = worldAt(track, S.bocTower.at);
  landmark(g, 'bocTower', boc.x, 0, boc.z);
  const levels = [[0, 120, 30], [120, 200, 24], [200, 260, 18], [260, 300, 12], [300, 315, 3]];
  for (const [y0, y1, r] of levels) {
    b.cyl(r, r, y1 - y0, 3, 0x3a4a5e, boc.x, y0, boc.z);
    glow.rod(boc.x - r, y0, boc.z, boc.x + r * 0.5, y1, boc.z + r * 0.86, 0.5, 0xeef4ff);
    glow.rod(boc.x + r * 0.5, y0, boc.z - r * 0.86, boc.x - r, y1, boc.z, 0.5, 0xeef4ff);
  }
  glow.rod(boc.x, 315, boc.z, boc.x, 345, boc.z, 0.6, 0xff4040); // アンテナ

  // IFC（高さ 412m、上が段で細い）
  const ifc = worldAt(track, S.ifc.at);
  landmark(g, 'ifc', ifc.x, 0, ifc.z);
  tower(b, ifc.x, ifc.z, 0, 52, 52, 300, 0x4a5868, { glow, win: 0xd8f0ff });
  tower(b, ifc.x, ifc.z, 0, 44, 44, 70, 0x4a5868, { glow, win: 0xd8f0ff, y: 300 });
  tower(b, ifc.x, ifc.z, 0, 34, 34, 30, 0x4a5868, { glow, win: 0xd8f0ff, y: 370 });
  for (let k = 0; k < 4; k++) glow.box(6, 18, 6, 0xd8f0ff, ifc.x + (k % 2 ? 14 : -14), 400, ifc.z + (k < 2 ? 14 : -14)); // てっぺんの角

  // ビクトリア湾（北がわの黒い海に、ビルの光の色の帯が映る）
  const hb = worldAt(track, S.harbour.at);
  landmark(g, 'harbour', hb.x, 0, hb.z);
  b.box(1600, 0.1, 360, 0x0a1428, hb.x, -0.05, hb.z);
  for (let k = 0; k < 40; k++) glow.box(4, 0.06, 60 + (k % 4) * 30, NEON[k % NEON.length], hb.x - 780 + k * 40, 0.02, hb.z + 120);

  // ネオンの看板（道の両がわのビルの下の方に、色の板と枠。文字は描かない）
  let n = 0;
  along(track, S.neon.from, S.neon.to, S.neon.every, (p) => {
    for (const side of [-1, 1]) {
      n++;
      const c = beside(p, side * (p.wall + 8));
      const loc = locate(track, c.x, c.z, p.i, 40);
      if (Math.abs(loc.lateral) < loc.wall + 4) continue;
      const col = NEON[n % NEON.length];
      glow.push(c.x, 0, c.z, ryAlong(p.h));
      if (n % 2) glow.box(1, 10 + (n % 3) * 4, 3, col, 0, 5 + (n % 4), 0); // 縦長の看板
      else glow.box(1, 3, 9, col, 0, 7 + (n % 3) * 3, 0); // 横長の看板
      glow.box(1.2, 0.4, n % 2 ? 3.4 : 9.4, 0xffffff, 0, n % 2 ? 4.8 : 6.8, 0); // 白い枠
      glow.pop();
    }
  });
  const mid = pointAt(track, (sOf(track, 'HL') + sOf(track, 'SD')) / 2);
  landmark(g, 'neon', mid.x, 0, mid.z);
  g.add(b.build(), glow.build());
  return root;
}
