// Global City の京都（2026-10-20）: 外国の人が見ても京都だと分かるように、日本らしさ・京都らしさを前に出す
// 東から入るので、実際の位置のとおり時計回り: 伏見稲荷 → 清水寺（舞台からジャンプ）→ 八坂の五重塔・祇園 → 銀閣寺 → 金閣寺 → 嵐山の竹林
import * as THREE from '../../../vendor/three.module.min.js?v=0e5d133';
import { createBuilder } from '../town/builder.js?v=0e5d133';
import { locate } from '../../game/track.js?v=0e5d133';
import { GLOBAL_SCENERY } from '../../data/global.js?v=0e5d133';
import { landmark, worldAt, sOf, along, beside, pointAt, sakura, roundTree, coneTree, ryOf } from './kit.js?v=0e5d133';

const VERMILION = 0xe0441c; // 朱色
const DARK_WOOD = 0x3a2a22;
const TILE = 0x3a3a40; // 瓦
const WOOD = 0x7a5230;
const ryAlong = (h) => Math.atan2(Math.cos(h), Math.sin(h));
const clear = (track, x, z, gap, hint = null) => {
  const loc = locate(track, x, z, hint, 40);
  return Math.abs(loc.lateral) > loc.wall + gap;
};

// 反った瓦屋根（段の箱で反りを出す）。はば w、奥行き d、底の高さ y
function roof(b, w, d, y, color = TILE) {
  b.box(w + 3, 0.8, d + 3, color, 0, y, 0);
  b.box(w + 1.6, 0.8, d + 1.6, color, 0, y + 0.8, 0);
  b.box(w * 0.7, 1.4, d * 0.5, color, 0, y + 1.6, 0);
  // 四すみの反り上がり
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(1.2, 0.6, 1.2, color, sx * (w / 2 + 1.6), y + 0.6, sz * (d / 2 + 1.6));
}

// 五重塔・三重塔: levels 段、いちばん下のはば w、高さ h
function pagoda(b, x, z, levels, w, h) {
  b.push(x, 0, z, 0);
  b.box(w + 2, 1.2, w + 2, 0x9a958c, 0, 0, 0); // 石の基だん
  const lh = (h * 0.78) / levels;
  for (let k = 0; k < levels; k++) {
    const ww = w * (1 - k * 0.09);
    const y = 1.2 + k * lh;
    b.box(ww, lh * 0.55, ww, 0xf0ece0, 0, y, 0); // 白い壁
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.6, lh * 0.55, 0.6, VERMILION, sx * ww * 0.45, y, sz * ww * 0.45); // 朱の柱
    roof(b, ww + 2, ww + 2, y + lh * 0.55);
  }
  const top = 1.2 + levels * lh + 1.5;
  b.cyl(0.3, 0.3, h * 0.22, 6, 0xc9a23a, 0, top, 0); // 相輪
  for (let k = 0; k < 9; k++) b.cyl(1, 1, 0.3, 8, 0xc9a23a, 0, top + 1 + k * (h * 0.02), 0);
  b.pop();
}

// 鳥居（朱色）: 道の上に。half は道の半分の幅
function torii(b, p, half) {
  b.push(p.x, p.y, p.z, ryAlong(p.h));
  const w = half + 1;
  for (const side of [-1, 1]) {
    b.cyl(0.55, 0.6, 7, 8, VERMILION, side * w, 0, 0);
    b.cyl(0.65, 0.65, 0.6, 8, 0x222222, side * w, 0, 0); // 黒い足
  }
  b.box(2 * w + 1.6, 0.6, 0.8, VERMILION, 0, 5.4, 0); // 貫
  b.box(2 * w + 4, 0.9, 1.2, 0x222222, 0, 7, 0); // 笠木（黒）
  b.box(2 * w + 3.2, 0.6, 1.1, VERMILION, 0, 6.5, 0); // 島木
  for (const side of [-1, 1]) b.box(1.4, 0.6, 1.2, 0x222222, side * (w + 2.2), 7.4, 0); // 両はしの反り
  b.pop();
}

// 町家（2階建て、黒っぽい木、格子、瓦屋根）
function machiya(b, x, z, ry, w = 8, d = 12) {
  b.push(x, 0, z, ry);
  b.box(w, 3.4, d, DARK_WOOD, 0, 0, 0);
  b.box(w + 0.6, 0.5, d + 0.6, TILE, 0, 3.4, 0); // 1階の小屋根
  b.box(w, 2.8, d - 2, DARK_WOOD, 0, 3.9, -1);
  for (let k = -3; k <= 3; k++) b.box(0.15, 2.2, 0.2, 0xc8b89a, k * (w / 8), 0.6, d / 2 + 0.05); // 格子
  roof(b, w, d - 2, 6.7);
  b.pop();
}

export function buildKyoto(track) {
  const S = GLOBAL_SCENERY.kyoto;
  const root = new THREE.Group();
  const g = new THREE.Group();
  g.userData.stages = [2];
  root.add(g);
  const b = createBuilder();
  const glow = createBuilder({ glow: true });

  // ---- 伏見稲荷: 朱色の鳥居がずらっと並ぶトンネル ----
  along(track, S.toriiTunnel.from, S.toriiTunnel.to, S.toriiTunnel.every, (p) => torii(b, p, p.half));
  const fi = pointAt(track, sOf(track, S.toriiTunnel.from) + 30);
  landmark(g, 'toriiTunnel', fi.x, 0, fi.z);

  // ---- 清水寺: 木の柱で組んだ舞台（道はこの上）、本堂、仁王門、三重塔 ----
  const km = sOf(track, 'KM');
  for (let s = km - 70; s <= km; s += 4) {
    const p = pointAt(track, s);
    if (p.y === null || p.y < 3) continue;
    b.push(p.x, 0, p.z, ryAlong(p.h));
    for (let x = -p.wall; x <= p.wall + 0.1; x += 4.3) b.box(0.8, p.y - 1.4, 0.8, WOOD, x, 0, 0); // 柱
    for (let y = 3; y < p.y - 1; y += 3.5) b.box(2 * p.wall + 1, 0.5, 0.6, WOOD, 0, y, 0); // 貫（横の木）
    b.box(2 * p.wall + 2, 0.5, 4.2, 0x8a6240, 0, p.y - 1.4, 0); // 舞台の板（坂の上ではみ出さないよう、道の少し下）
    b.pop();
  }
  const kz = worldAt(track, S.kiyomizu.at);
  landmark(g, 'kiyomizu', kz.x, 0, kz.z);
  b.push(kz.x, 0, kz.z, ryOf(S.kiyomizu.ry));
  b.box(46, 14, 30, 0xe8e0cc, 0, 0, 0); // 本堂
  for (let k = -5; k <= 5; k++) b.box(0.9, 14, 0.9, VERMILION, k * 4.4, 0, 15);
  b.box(54, 1.2, 40, 0x6a4a32, 0, 14, 0); // 檜皮ぶきの大きな屋根（茶色、反り）
  b.box(48, 1.6, 32, 0x6a4a32, 0, 15.2, 0);
  b.box(36, 2.2, 20, 0x6a4a32, 0, 16.8, 0);
  b.box(22, 2, 6, 0x6a4a32, 0, 19, 0);
  b.pop();
  // 仁王門（朱色）と三重塔
  const nio = { x: kz.x - 40, z: kz.z + 50 };
  b.push(nio.x, 0, nio.z, 0);
  b.box(18, 9, 9, VERMILION, 0, 0, 0);
  roof(b, 18, 9, 9);
  b.pop();
  pagoda(b, kz.x - 60, kz.z - 30, 3, 9, 31);
  // 谷の木々
  for (let k = 0; k < 24; k++) roundTree(b, kz.x + 30 + (k % 6) * 12, 0, kz.z - 60 + Math.floor(k / 6) * 14, 1.3, k % 3 ? 0x4f8a3a : 0xd8644a);

  // ---- 八坂の五重塔と祇園の町なみ（町家・ちょうちん・桜）----
  const yp = worldAt(track, S.yasakaPagoda.at);
  landmark(g, 'yasakaPagoda', yp.x, 0, yp.z);
  pagoda(b, yp.x, yp.z, 5, 11, 46);
  let k = 0;
  along(track, S.gion.from, S.gion.to, 13, (p) => {
    for (const side of [-1, 1]) {
      k++;
      const c = beside(p, side * (p.wall + 8));
      if (!clear(track, c.x, c.z, 4) || Math.hypot(c.x - yp.x, c.z - yp.z) < 18) continue;
      machiya(b, c.x, c.z, ryAlong(p.h) + (side > 0 ? -Math.PI / 2 : Math.PI / 2));
      // 赤いちょうちん（光る）
      const l = beside(p, side * (p.wall + 3.4));
      glow.sphere(0.5, 0xff3a2a, l.x, 2.6, l.z, 8);
      if (k % 3 === 0) {
        const t = beside(p, side * (p.wall + 2));
        sakura(b, t.x, 0, t.z, 0.9);
      }
    }
  });
  const gi = pointAt(track, sOf(track, 'GI'));
  landmark(g, 'gion', gi.x, 0, gi.z);

  // ---- 銀閣寺（2階建て、黒っぽい木と白い壁、砂の庭と向月台）----
  const gk = worldAt(track, S.ginkaku.at);
  landmark(g, 'ginkaku', gk.x, 0, gk.z);
  b.push(gk.x, 0, gk.z, ryOf(S.ginkaku.ry));
  b.box(14, 4.5, 12, DARK_WOOD, 0, 0, 0);
  b.box(13, 0.6, 11, 0xf0ece0, 0, 1.5, 6.05);
  roof(b, 14, 12, 4.5, 0x4a4a50);
  b.box(10, 3.5, 9, 0x4a3a30, 0, 6.6, 0);
  roof(b, 10, 9, 10.1, 0x4a4a50);
  b.cyl(0.2, 0.4, 1.4, 6, 0x9a8a4a, 0, 12.4, 0); // 鳳凰
  b.box(36, 0.5, 20, 0xf2efe6, 0, 0, 22); // 銀沙灘（白い砂）
  for (let x = -16; x <= 16; x += 2) b.box(0.4, 0.55, 20, 0xe4e0d4, x, 0, 22); // 砂の波もよう
  b.cyl(3, 6, 1.8, 16, 0xf2efe6, 10, 0.5, 26); // 向月台
  b.pop();

  // ---- 金閣寺（3階建て、2・3階が金色、池に映る）----
  const kk = worldAt(track, S.kinkaku.at);
  landmark(g, 'kinkaku', kk.x, 0, kk.z);
  const GOLD = 0xd4a62a;
  const kinkaku = (bb, sign, scale) => {
    bb.push(kk.x, 0, kk.z, ryOf(S.kinkaku.ry));
    const y0 = 0.4;
    bb.box(16, 4 * sign, 13, 0xe8e0cc, 0, y0, 0); // 1階（白い壁と木）
    bb.box(17.5, 0.8 * sign, 14.5, TILE, 0, y0 + 4 * sign, 0);
    bb.box(14, 4 * sign, 11, GOLD, 0, y0 + 4.8 * sign, 0); // 2階（金）
    bb.box(16, 0.8 * sign, 13, TILE, 0, y0 + 8.8 * sign, 0);
    bb.box(9, 3.6 * sign, 8, GOLD, 0, y0 + 9.6 * sign, 0); // 3階（金）
    bb.box(12, 0.8 * sign, 11, TILE, 0, y0 + 13.2 * sign, 0);
    bb.box(7, 1.2 * sign, 6, TILE, 0, y0 + 14 * sign, 0);
    bb.cyl(0.3, 0.6, 1.8 * scale, 6, GOLD, 0, y0 + 15.2 * sign, 0); // 鳳凰
    bb.pop();
  };
  kinkaku(glow, 1, 1); // 金色が光って見えるように（光る builder）
  b.push(kk.x, 0, kk.z, ryOf(S.kinkaku.ry));
  b.box(70, 0.12, 46, 0x3a6f6a, 0, 0.02, 24); // 池（金閣の前）
  b.pop();
  // 池に映る金閣（上下さかさ、うすい色）
  b.push(kk.x, 0, kk.z, ryOf(S.kinkaku.ry));
  b.box(9, 0.05, 3, 0x9a8a50, 0, 0.16, 16);
  b.box(14, 0.05, 4, 0x8a7a48, 0, 0.16, 20);
  b.pop();
  for (const [dx, dz] of [[-40, -20], [40, -18], [-46, 30], [46, 32], [0, -40]]) coneTree(b, kk.x + dx, 0, kk.z + dz, 1.6, 0x2f5d3a);

  // ---- 嵐山の竹林（背の高い竹を道の両がわにびっしり、竹の枝の茶色の垣根）----
  let n = 0;
  along(track, S.bamboo.from, S.bamboo.to, 1.4, (p) => {
    for (const side of [-1, 1]) {
      // 垣根
      const f = beside(p, side * (p.half + 1.6));
      b.push(f.x, 0, f.z, ryAlong(p.h));
      b.box(0.5, 1.5, 1.5, 0x7a5a38, 0, 0, 0);
      b.pop();
      for (let row = 0; row < 5; row++) {
        n++;
        const lat = p.half + 3 + row * 3 + ((n * 7) % 5) * 0.4;
        const c = beside(p, side * lat);
        if (!clear(track, c.x, c.z, 1, p.i)) continue; // カーブの内がわで道の上に来る竹は置かない
        const h = 20 + ((n * 13) % 6);
        b.cyl(0.13, 0.15, h, 5, row % 2 ? 0x6f9e4a : 0x7fae58, c.x, 0, c.z, true);
        if (n % 6 === 0) b.sphere(2.2, 0x5f8f3a, c.x - Math.sin(p.h) * side * -2, h - 1, c.z + Math.cos(p.h) * side * -2, 5); // 上の葉
      }
    }
  });
  const ar = pointAt(track, sOf(track, 'AR') + 20);
  landmark(g, 'bamboo', ar.x, 0, ar.z);

  g.add(b.build(), glow.build());
  return root;
}
