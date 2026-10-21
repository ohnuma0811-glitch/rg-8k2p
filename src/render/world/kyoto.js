// Global City の京都（2026-10-20）: 外国の人が見ても京都だと分かるように、日本らしさ・京都らしさを前に出す
// 東から入るので、実際の位置のとおり時計回り: 伏見稲荷 → 清水寺（舞台からジャンプ）→ 八坂の五重塔・祇園 → 銀閣寺 → 金閣寺 → 嵐山の竹林
import * as THREE from '../../../vendor/three.module.min.js?v=3294f6b';
import { createBuilder } from '../town/builder.js?v=3294f6b';
import { locate } from '../../game/track.js?v=3294f6b';
import { GLOBAL_SCENERY } from '../../data/global.js?v=3294f6b';
import { landmark, worldAt, sOf, along, beside, pointAt, sakura, roundTree, coneTree, ryOf, roadSign, roadBanner } from './kit.js?v=3294f6b';

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

// 道の点 p のどちらの横が、ほかの道から遠いか（谷の木などを置く側）
function p0Side(track, p) {
  const r = beside(p, 80);
  return Math.abs(locate(track, r.x, r.z, null, 40).lateral) > 60 ? 1 : -1;
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
  // 巨大な本堂（2026-10-21 のユーザー依頼「清水寺を巨大にして寺のなかを走りたい」）: 道は本堂の中を通りぬけて、舞台へ出る。
  // 道にそって 4m ごとに、両がわの壁と朱色の柱、高い天井、檜皮ぶきの大きな屋根。中にはちょうちん
  const h0 = km - 64;
  const h1 = km - 24;
  for (let s = h0; s <= h1; s += 4) {
    const p = pointAt(track, s);
    const w = p.wall + 0.5;
    b.push(p.x, p.y, p.z, ryAlong(p.h));
    glow.push(p.x, p.y, p.z, ryAlong(p.h));
    for (const side of [-1, 1]) {
      b.box(6, 13, 4.4, 0xf0ece0, side * (w + 3.2), 0, 0); // 白い壁
      b.box(1, 13, 1, VERMILION, side * (w + 0.4), 0, 0); // 朱色の柱
      b.box(6.4, 1.2, 4.6, WOOD, side * (w + 3.2), 3, 0); // 腰の木
    }
    b.box(2 * w + 14, 1, 4.6, WOOD, 0, 13, 0); // 天井
    // 檜皮ぶきの大きな屋根（反りを段で）
    b.box(2 * w + 34, 1.4, 4.6, 0x6a4a32, 0, 14, 0);
    b.box(2 * w + 26, 2, 4.6, 0x6a4a32, 0, 15.4, 0);
    b.box(2 * w + 16, 2.6, 4.6, 0x6a4a32, 0, 17.4, 0);
    b.box(2 * w + 4, 3, 4.6, 0x6a4a32, 0, 20, 0);
    b.box(6, 1.6, 4.6, 0x4a3422, 0, 23, 0); // 棟
    if (Math.round(s - h0) % 8 === 0) glow.sphere(0.9, 0xffb04a, 0, 10.5, 0, 8); // ちょうちん
    glow.pop();
    b.pop();
  }
  // 清水の舞台（2026-10-21 のユーザー依頼「一目で舞台だとわかるように。飛び降りるところ以外に手すり」）:
  // 本堂を出てから飛び降りる所まで、道に板張りの床。両わきに木の手すり。飛び降りる所（前のはし）は開けておく
  {
    const d0 = km - 24;
    const d1 = km - 2;
    for (let s = d0; s <= d1; s += 1.2) {
      const p = pointAt(track, s);
      b.push(p.x, p.y, p.z, ryAlong(p.h));
      b.box(2 * p.half + 2, 0.02, 1.1, Math.round(s / 1.2) % 2 ? 0x9a6a3a : 0x8a5a30, 0, 0.005, 0); // 板
      b.pop();
    }
    const dm = pointAt(track, (d0 + d1) / 2);
    landmark(g, 'kiyomizuDeck', dm.x, dm.y, dm.z);
    for (let s = d0; s <= km - 3; s += 2) {
      const p = pointAt(track, s);
      const q = pointAt(track, Math.min(s + 2, km - 3));
      for (const side of [-1, 1]) {
        const c = beside(p, side * (p.half + 0.8));
        const e = beside(q, side * (q.half + 0.8));
        b.cyl(0.16, 0.16, 1.2, 6, 0x6a4026, c.x, p.y, c.z); // 手すりの柱
        const post = landmark(g, 'kiyomizuRailPost', c.x, p.y, c.z);
        post.userData.s = s;
        b.rod(c.x, p.y + 1.15, c.z, e.x, q.y + 1.15, e.z, 0.1, 0x7a4a2a, 4); // 上の木
        b.rod(c.x, p.y + 0.6, c.z, e.x, q.y + 0.6, e.z, 0.07, 0x7a4a2a, 4); // 中の木
      }
    }
    landmark(g, 'kiyomizuRail', dm.x, dm.y, dm.z);
    roadBanner(g, b, track, h1 + 3, 'KIYOMIZU STAGE', 'bannerKiyomizuStage', { bg: '#7a1a10', fg: '#ffe14a' });
  }
  const hm = pointAt(track, (h0 + h1) / 2);
  landmark(g, 'kiyomizuHall', hm.x, hm.y, hm.z);
  landmark(g, 'kiyomizu', hm.x, 0, hm.z);
  // 仁王門（朱色の2階の門）: 鳥居のトンネルを出たあと、道をまたぐ。くぐる
  {
    const p = pointAt(track, km - 82);
    const w = p.wall + 0.5;
    landmark(g, 'nioGate', p.x, p.y, p.z);
    b.push(p.x, p.y, p.z, ryAlong(p.h));
    for (const side of [-1, 1]) b.box(6, 9, 8, VERMILION, side * (w + 3), 0, 0);
    b.box(2 * w + 12, 4, 8, VERMILION, 0, 9, 0);
    roof(b, 2 * w + 12, 8, 13);
    b.pop();
  }
  // 三重塔（道からはなして）
  {
    const p = pointAt(track, km - 40);
    const c = beside(p, -(p.wall + 40));
    if (clear(track, c.x, c.z, 12)) pagoda(b, c.x, c.z, 3, 9, 31);
  }
  const kz = beside(hm, p0Side(track, hm) * 80);
  // 谷の木々
  for (let k = 0; k < 24; k++) {
    const x = kz.x + (k % 6) * 12 - 30;
    const z = kz.z + Math.floor(k / 6) * 14 - 20;
    if (clear(track, x, z, 4)) roundTree(b, x, 0, z, 1.3, k % 3 ? 0x4f8a3a : 0xd8644a);
  }

  // ---- 八坂の五重塔と祇園の町なみ（町家・ちょうちん・桜）----
  const yp = worldAt(track, S.yasakaPagoda.at);
  landmark(g, 'yasakaPagoda', yp.x, 0, yp.z);
  pagoda(b, yp.x, yp.z, 5, 11, 46);
  let k = 0;
  along(track, S.gion.from, S.gion.to, 13, (p) => {
    for (const side of [-1, 1]) {
      k++;
      const c = beside(p, side * (p.wall + 12)); // 町家は奥行き 12m なので、桜（道から 2m）にかからない所に（桜が建物に埋まった。2026-10-21 のユーザー依頼）
      if (!clear(track, c.x, c.z, 6) || Math.hypot(c.x - yp.x, c.z - yp.z) < 18) continue;
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
  // 道の近くに、道の方へ向けて大きく（1.7倍）。前（道の方）に白い砂の庭（どれか分からなかった。2026-10-21 のユーザー依頼）
  const gw = worldAt(track, S.ginkaku.at);
  const gl = locate(track, gw.x, gw.z, null, 40);
  const gp = pointAt(track, gl.s);
  const gside = Math.sign(gl.lateral) || 1;
  const gk = beside(gp, gside * (gp.wall + 34));
  landmark(g, 'ginkaku', gk.x, 0, gk.z);
  const gb = createBuilder();
  gb.box(14, 4.5, 12, DARK_WOOD, 0, 0, 0);
  gb.box(13, 0.6, 11, 0xf0ece0, 0, 1.5, 6.05);
  roof(gb, 14, 12, 4.5, 0x4a4a50);
  gb.box(10, 3.5, 9, 0x4a3a30, 0, 6.6, 0);
  roof(gb, 10, 9, 10.1, 0x4a4a50);
  gb.cyl(0.2, 0.4, 1.4, 6, 0x9a8a4a, 0, 12.4, 0); // 鳳凰
  gb.box(30, 0.5, 11, 0xf2efe6, 0, 0, 13); // 銀沙灘（白い砂。建物のすぐ前、道の方）
  for (let x = -14; x <= 14; x += 2) gb.box(0.4, 0.55, 11, 0xe4e0d4, x, 0, 13); // 砂の波もよう
  gb.cyl(2.5, 4.5, 1.8, 16, 0xf2efe6, 9, 0.5, 14); // 向月台
  const ggroup = gb.build();
  ggroup.position.set(gk.x, 0, gk.z);
  ggroup.rotation.y = Math.atan2(gp.x - gk.x, gp.z - gk.z); // +z が道の方
  ggroup.scale.setScalar(1.7);
  g.add(ggroup);

  // ---- 金閣寺（3階建て、2・3階が金色、池に映る）----
  // 道からはなして、池を道の方に向ける。大きく（1.8倍）して分かりやすく（2026-10-21 のユーザー依頼「金閣寺も良くわからない」）
  const kw = worldAt(track, S.kinkaku.at);
  const kl = locate(track, kw.x, kw.z, null, 40);
  const kp = pointAt(track, kl.s);
  const kside = Math.sign(kl.lateral) || 1;
  const kk = beside(kp, kside * (kp.wall + 40)); // 道に近く（2026-10-21 のユーザー依頼「もっと道路に近接」）
  landmark(g, 'kinkaku', kk.x, 0, kk.z);
  const kry = Math.atan2(kp.x - kk.x, kp.z - kk.z); // +z が道の方
  const GOLD = 0xd4a62a;
  const KS = 1.8;
  const kg = createBuilder({ glow: true });
  const kb = createBuilder();
  kg.box(16, 4, 13, 0xe8e0cc, 0, 0.4, 0); // 1階（白い壁と木）
  kb.box(17.5, 0.8, 14.5, TILE, 0, 4.4, 0);
  kg.box(14, 4, 11, GOLD, 0, 5.2, 0); // 2階（金）
  kb.box(16, 0.8, 13, TILE, 0, 9.2, 0);
  kg.box(9, 3.6, 8, GOLD, 0, 10, 0); // 3階（金）
  kb.box(12, 0.8, 11, TILE, 0, 13.6, 0);
  kb.box(7, 1.2, 6, TILE, 0, 14.4, 0);
  kg.cyl(0.3, 0.6, 1.8, 6, GOLD, 0, 15.6, 0); // 鳳凰
  kb.box(30, 0.06, 13, 0x3a6f6a, 0, -0.04, 13.5); // 池（建物のすぐ前、道の方）
  kb.box(14, 0.03, 3, 0x9a8a50, 0, 0.03, 9); // 池に映る金閣
  kb.box(9, 0.03, 2.5, 0x9a8a50, 0, 0.03, 12);
  const kgroup = new THREE.Group();
  kgroup.add(kg.build(), kb.build());
  kgroup.position.set(kk.x, 0, kk.z);
  kgroup.rotation.y = kry;
  kgroup.scale.setScalar(KS);
  g.add(kgroup);
  // 松は、池の両わき（金閣寺の手前）に（道ばたにあった緑は、ここへ。2026-10-21 のユーザー依頼）
  for (const [lx, lz] of [[-19, 8], [19, 8], [-21, 16], [21, 16], [-16, 22], [16, 22]]) {
    const x = kk.x + (Math.cos(kry) * lx + Math.sin(kry) * lz) * KS;
    const z = kk.z + (-Math.sin(kry) * lx + Math.cos(kry) * lz) * KS;
    if (clear(track, x, z, 4)) coneTree(b, x, 0, z, 1.5, 0x2f5d3a);
  }

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

  // 銀閣寺 → 金閣寺 → 嵐山の間の町なみ（町家・紅葉と桜）と、遠くの山なみ（2026-10-21 のユーザー依頼「周りも殺風景」）
  {
    let n = 0;
    const avoid = [kk, gk].map((c) => ({ x: c.x, z: c.z, r: 90 }));
    along(track, 'GK', 'AR', 14, (p) => {
      for (const side of [-1, 1]) {
        n++;
        const c = beside(p, side * (p.wall + 9));
        if (!clear(track, c.x, c.z, 6) || avoid.some((a) => Math.hypot(a.x - c.x, a.z - c.z) < a.r)) continue;
        if (n % 5 === 0) roundTree(b, c.x, 0, c.z, 1.2, n % 2 ? 0xd8644a : 0xe89ab0); // 紅葉・桜
        else {
          machiya(b, c.x, c.z, ryAlong(p.h) + (side > 0 ? -Math.PI / 2 : Math.PI / 2));
          landmark(g, 'kyotoTown', c.x, 0, c.z);
        }
      }
    });
    // 遠くの山なみ（緑の低い山）
    along(track, 'FI', 'LP', 120, (p) => {
      for (const side of [-1, 1]) {
        const c = beside(p, side * 300);
        if (!clear(track, c.x, c.z, 150)) continue;
        b.cyl(0, 110, 70, 9, 0x3f6f3a, c.x, 0, c.z);
      }
    });
  }

  // 英語の看板（2026-10-21 のユーザー依頼「金閣寺も良くわからないので看板を立てるなりして」）
  const sign = (s, text, name) => roadBanner(g, b, track, s, text, name, { bg: '#7a1a10', fg: '#ffe14a' }); // 濃い赤に黄色の字（見やすく）
  sign(sOf(track, 'FI') - 30, 'FUSHIMI INARI', 'signFushimi');
  // 清水寺の看板は撤去（2026-10-22 のユーザー依頼「視認性が悪い」）。舞台の KIYOMIZU STAGE はそのまま
  sign(sOf(track, 'GK') - 40, 'GINKAKU-JI', 'signGinkaku');
  sign(sOf(track, 'KK') - 40, 'KINKAKU-JI', 'signKinkaku');
  sign(sOf(track, 'AR') - 30, 'ARASHIYAMA', 'signArashiyama');
  g.add(b.build(), glow.build());
  return root;
}
