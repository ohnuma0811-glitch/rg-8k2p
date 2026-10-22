// Global City の香港（2026-10-20）: 夜。香港島の中環（セントラル）の高層ビル群の間を抜ける。ネオンの看板がギラギラ光る。北がわがビクトリア湾
import * as THREE from '../../../vendor/three.module.min.js?v=dcfe307';
import { createBuilder } from '../town/builder.js?v=dcfe307';
import { locate } from '../../game/track.js?v=dcfe307';
import { GLOBAL_SCENERY } from '../../data/global.js?v=dcfe307';
import { landmark, worldAt, sOf, along, beside, pointAt, tower, neonSign, trafficLight } from './kit.js?v=dcfe307';
import { cityBlocks } from './tokyo.js?v=dcfe307';

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
  // 水は 40m 四方のますに分けて、地面より下を通る道（海にもぐるトンネル）の上のますは置かない
  // （水の板がトンネルの中につき出て、先が見えなかった。2026-10-22 のユーザー依頼）
  const under = track.samples.filter((p, i) => i % 2 === 0 && p.y !== null && p.y < -0.3 && Math.abs(p.x - hb.x) < 820 && Math.abs(p.z - hb.z) < 200);
  const CELL = 40;
  for (let cx = -800 + CELL / 2; cx < 800; cx += CELL) {
    for (let cz = -180 + CELL / 2; cz < 180; cz += CELL) {
      const x = hb.x + cx;
      const z = hb.z + cz;
      const near = under.some((p) => Math.abs(p.x - x) < CELL / 2 + p.wall + 4 && Math.abs(p.z - z) < CELL / 2 + p.wall + 4);
      if (!near) b.box(CELL, 0.1, CELL, 0x0a1428, x, -0.05, z);
    }
  }
  // 水に映る光の帯（トンネルの上にかかる帯は置かない）
  for (let k = 0; k < 40; k++) {
    const len = 60 + (k % 4) * 30;
    const x = hb.x - 780 + k * 40;
    const z = hb.z + 120;
    if (under.some((p) => Math.abs(p.x - x) < 2 + p.wall + 4 && Math.abs(p.z - z) < len / 2 + p.wall + 4)) continue;
    glow.box(4, 0.06, len, NEON[k % NEON.length], x, 0.02, z);
  }

  // 中国語のネオン看板（2026-10-21 のユーザー依頼「中国語の看板に溢れているはず。看板を多数配置して」）:
  // 道の両がわのビルから、道の上へ突き出す縦の看板（漢字を縦に）。走ってくる方から読めるよう、板は道を横切る向き
  const WORDS = ['金龍酒家', '茶餐廳', '大押', '藥房', '海鮮酒家', '麻雀館', '珠寶金行', '時裝', '找換店', '涼茶', '燒臘', '雲吞麵', '大酒樓', '旅館', '電器', '眼鏡', '鐘錶', '夜市', '鴻運', '百貨'];
  const COLORS = ['#ff2d6f', '#2de0ff', '#ffe12d', '#7dff3a', '#ff7a1a', '#c23aff', '#ff4040'];
  let n = 0;
  const faces = [];
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
      glow.pop();
      // 字の面は、あとで1つの形にまとめる（前＝走ってくる方と、後ろ）
      for (const [dz, ry] of [[0.2, 0], [-0.2, Math.PI]]) faces.push({ w, x: mid.x, y, z: mid.z, ry0: ryAlong(p.h), dz, ry, out, h });
      b.push(base.x, y + h, base.z, ryAlong(p.h));
      b.box(0.2, 0.2, 0.2, 0x333333, 0, 0, 0);
      b.pop();
    }
  });
  const atlas = neonAtlasMesh(WORDS, COLORS, faces);
  if (atlas) g.add(atlas);
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

// ネオン看板の字の面を、1枚の絵（言葉を並べた絵）と1つの形にまとめる（看板ごとに描くと、香港が 30fps になった。2026-10-22 のユーザー依頼）
// 絵: 1つの言葉が はば 128・高さ 128×字の数 の場所に（ATLAS_COLS 列 × 行）。face: 看板の中心・向き・前後・大きさ
const CELL_W = 128;
const CELL_H = 512; // 4字まで
const ATLAS_COLS = 10;
function neonAtlasMesh(words, colors, faces) {
  if (typeof document === 'undefined' || !faces.length) return null;
  const rows = Math.ceil(words.length / ATLAS_COLS);
  const W = CELL_W * ATLAS_COLS;
  const H = CELL_H * rows;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c2 = cv.getContext('2d');
  words.forEach((text, k) => {
    const x = (k % ATLAS_COLS) * CELL_W;
    const y = Math.floor(k / ATLAS_COLS) * CELL_H;
    const h = CELL_W * [...text].length;
    c2.save();
    c2.beginPath();
    c2.rect(x, y, CELL_W, h);
    c2.clip();
    c2.translate(x, y);
    neonSign(text, colors[k % colors.length])(c2, CELL_W, h);
    c2.restore();
  });
  const pos = [];
  const uv = [];
  const m = new THREE.Matrix4();
  const local = (x, y, z, ry) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
  for (const f of faces) {
    const len = [...words[f.w]].length;
    const u0 = ((f.w % ATLAS_COLS) * CELL_W) / W;
    const u1 = u0 + CELL_W / W;
    const top = Math.floor(f.w / ATLAS_COLS) * CELL_H;
    const v1 = 1 - top / H;
    const v0 = 1 - (top + CELL_W * len) / H;
    m.multiplyMatrices(local(f.x, f.y, f.z, f.ry0), local(0, f.h / 2, f.dz, f.ry));
    const geo = new THREE.PlaneGeometry(f.out, f.h).toNonIndexed().applyMatrix4(m);
    const p = geo.attributes.position.array;
    const q = geo.attributes.uv.array;
    for (let i = 0; i < p.length; i++) pos.push(p[i]);
    for (let i = 0; i < q.length; i += 2) uv.push(u0 + q[i] * (u1 - u0), v0 + q[i + 1] * (v1 - v0));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
  mesh.userData.neon = true;
  return mesh;
}
