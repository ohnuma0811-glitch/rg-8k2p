// Global City の香港（2026-10-20）: 夜。香港島の中環（セントラル）の高層ビル群の間を抜ける。ネオンの看板がギラギラ光る。北がわがビクトリア湾
import * as THREE from '../../../vendor/three.module.min.js?v=996c4bd';
import { createBuilder } from '../town/builder.js?v=996c4bd';
import { locate } from '../../game/track.js?v=996c4bd';
import { GLOBAL_SCENERY } from '../../data/global.js?v=996c4bd';
import { landmark, worldAt, sOf, along, beside, pointAt, tower, neonSign, trafficLight } from './kit.js?v=996c4bd';
import { cityBlocks } from './tokyo.js?v=996c4bd';

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

  // 中国語のネオン看板（2026-10-21 のユーザー依頼「中国語の看板に溢れているはず。看板を多数配置して」）:
  // 道の両がわのビルから、道の上へ突き出す縦の看板（漢字を縦に）。走ってくる方から読めるよう、板は道を横切る向き
  const WORDS = ['金龍酒家', '茶餐廳', '大押', '藥房', '海鮮酒家', '麻雀館', '珠寶金行', '時裝', '找換店', '涼茶', '燒臘', '雲吞麵', '大酒樓', '旅館', '電器', '眼鏡', '鐘錶', '夜市', '鴻運', '百貨'];
  const COLORS = ['#ff2d6f', '#2de0ff', '#ffe12d', '#7dff3a', '#ff7a1a', '#c23aff', '#ff4040'];
  let n = 0;
  along(track, S.neon.from, S.neon.to, 12, (p) => {
    for (const side of [-1, 1]) {
      n++;
      const base = beside(p, side * (p.wall + 3));
      const lb = locate(track, base.x, base.z, p.i, 40);
      if (Math.abs(lb.lateral) < lb.wall + 1) continue; // ほかの道の上には立てない
      const w = (n * 7) % WORDS.length;
      const text = WORDS[w];
      const color = COLORS[w % COLORS.length]; // 言葉ごとに色を決める（同じ絵の看板は、まとめて描ける）
      const len = [...text].length;
      const h = 3 + len * 2.4; // 字の数で高さ
      const out = 4 + (n % 3) * 1.5; // 道の上へ突き出す長さ
      const y = 6 + (n % 4) * 2.5;
      const mid = beside(p, side * (p.wall + 3 - out / 2));
      const sg = new THREE.Object3D();
      sg.position.set(mid.x, y + h / 2, mid.z);
      sg.userData.landmark = 'hkSign';
      sg.userData.text = text;
      g.add(sg);
      glow.push(mid.x, y, mid.z, ryAlong(p.h));
      glow.box(out + 0.4, h + 0.4, 0.3, 0x120a18, 0, 0, 0); // 板
      glow.label(neonSign(text, color), [128, 128 * len], 0, h / 2, 0.2, 0, out, h); // 前（走ってくる方）
      glow.label(neonSign(text, color), [128, 128 * len], 0, h / 2, -0.2, Math.PI, out, h); // 後ろ
      glow.pop();
      b.push(base.x, y + h, base.z, ryAlong(p.h));
      b.box(0.2, 0.2, 0.2, 0x333333, 0, 0, 0);
      b.pop();
    }
  });
  // 信号機（左側。香港は左側通行。2026-10-21 のユーザー依頼）: 道にそって 130m ごと
  {
    let k = 0;
    for (let s = sOf(track, 'HL') + 60; s < sOf(track, 'SD') - 40; s += 130) trafficLight(g, b, glow, track, s, -1, k++ % 2 ? 'red' : 'green');
  }
  const mid = pointAt(track, (sOf(track, 'HL') + sOf(track, 'SD')) / 2);
  landmark(g, 'neon', mid.x, 0, mid.z);
  g.add(b.build(), glow.build());
  return root;
}
