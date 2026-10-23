// Global City の東京（2026-10-20）: 皇居の桜並木からスタート、丸の内・東京駅・東京タワー・新幹線・レインボーブリッジ・お台場
// 方角は実際のとおり（北は -z）。名所の置き場所は src/data/global.js の GLOBAL_SCENERY.tokyo
import * as THREE from '../../../vendor/three.module.min.js?v=669b1ac';
import { createBuilder } from '../town/builder.js?v=669b1ac';
import { locate } from '../../game/track.js?v=669b1ac';
import { GLOBAL_SCENERY } from '../../data/global.js?v=669b1ac';
import { landmark, worldAt, sOf, along, beside, pointAt, tower, textSign, sakura, coneTree, petals, roundTree, viaduct, roadBanner, buildRampDeck } from './kit.js?v=669b1ac';

const STONE = 0xd8d2c4; // 皇居の白い石垣
const ROOF_COPPER = 0x5f8f7a; // 銅の屋根（緑青）
const BRICK = 0xa8432f; // 東京駅の赤レンガ
const WHITE = 0xf4f4f0;
const STEEL = 0x9aa3ad;

// 道の向き h の点で、箱の長い向き（local z）を道にそろえる ry
const ryAlong = (h) => Math.atan2(Math.cos(h), Math.sin(h));

// 道（ほかの道を含む）から離れているか（建物を道の上に置かない）
function clearOfRoads(track, x, z, gap) {
  const loc = locate(track, x, z, null, 40);
  return Math.abs(loc.lateral) > loc.wall + gap;
}

// 街のビル（道ぞいに、道から離して並べる）
export function cityBlocks(b, track, from, to, { step = 55, back = 30, colors = [0xb8c2cc, 0x9aa8b6, 0xd6d0c4, 0x7f8c99], hMin = 30, hMax = 110, glow = null, win = 0xbfd8ea, avoid = [], group = null } = {}) {
  let k = 0;
  along(track, from, to, step, (p) => {
    for (const side of [-1, 1]) {
      k++;
      const w = 22 + ((k * 7) % 4) * 6;
      const d = 22 + ((k * 11) % 3) * 6;
      const h = hMin + ((k * 37) % 9) * ((hMax - hMin) / 8);
      const c = beside(p, side * (p.wall + back + d / 2));
      if (!clearOfRoads(track, c.x, c.z, Math.max(w, d) / 2 + 6)) continue;
      if (avoid.some((a) => Math.hypot(a.x - c.x, a.z - c.z) < a.r)) continue;
      tower(b, c.x, c.z, ryAlong(p.h), w, d, h, colors[k % colors.length], { glow, win });
      if (group) landmark(group, 'cityTower', c.x, 0, c.z);
    }
  });
}

// 芝浦のループの柱: 上の段の道の真ん中から地面まで。ただし真下（まわり）にほかの低い道がある所には立てない
// （下の段の道や、ループに入る手前の道の上に、柱が立っていた。2026-10-21 のユーザー依頼「道路上の橋脚が撤去されていない」）
export function loopPillars(track) {
  const out = [];
  along(track, 'SL', 'RB', 18, (p) => {
    if (p.y <= 3) return;
    const top = p.y - 1.2;
    const blocked = track.samples.some((q) => q.y !== null && !q.void && !q.auto && q.y < top - 1 && Math.hypot(q.x - p.x, q.z - p.z) < q.wall + 2.5);
    if (!blocked) out.push({ x: p.x, z: p.z, top });
  });
  return out;
}

export function buildTokyo(track) {
  const S = GLOBAL_SCENERY.tokyo;
  const root = new THREE.Group();
  const city = new THREE.Group(); // 東京だけ（ステージ 0）
  city.userData.stages = [0];
  const bay = new THREE.Group(); // お台場のまわり（大ジャンプからも見える。ステージ 0・1）
  bay.userData.stages = [0, 1];
  root.add(city, bay);
  const b = createBuilder();
  const bb = createBuilder();

  // ---- 皇居の北西のお堀と、満開の桜並木（スタート）----
  // お堀は道から離して、水は道より低く（道の上に青い床が出た。2026-10-21 のユーザー依頼「海のように青い床が出ている」）
  for (let k = 0; k + 1 < S.moat.length; k++) {
    const a = worldAt(track, S.moat[k]);
    const c = worldAt(track, S.moat[k + 1]);
    const len = Math.hypot(c.x - a.x, c.z - a.z);
    let mx = (a.x + c.x) / 2;
    let mz = (a.z + c.z) / 2;
    const loc = locate(track, mx, mz, null, 40);
    const need = loc.wall + 15 + 4 + len * 0.15; // お堀の半分のはば 15m ＋ すき間（ななめでも道にかからないよう、長さの分も）
    if (Math.abs(loc.lateral) < need) {
      const p = pointAt(track, loc.s);
      const sd = Math.sign(loc.lateral) || -1;
      mx += -Math.sin(p.h) * sd * (need - Math.abs(loc.lateral));
      mz += Math.cos(p.h) * sd * (need - Math.abs(loc.lateral));
    }
    const ry = Math.atan2(c.x - a.x, c.z - a.z);
    const water = new THREE.Mesh(new THREE.BoxGeometry(30, 0.04, len + 4), new THREE.MeshLambertMaterial({ color: 0x3f6f8f }));
    water.position.set(mx, -0.075, mz);
    water.rotation.y = ry;
    water.userData.moat = true;
    city.add(water);
    b.push(mx, 0, mz, ry);
    b.box(2, 3, len + 4, STONE, 16, -2, 0); // お堀の石垣のふち
    b.box(2, 3, len + 4, STONE, -16, -2, 0);
    b.pop();
  }
  along(track, 'S', 'NJ', 8, (p, s) => {
    for (const side of [-1, 1]) {
      const c = beside(p, side * (p.wall + 3));
      sakura(b, c.x, 0, c.z, 1 + ((Math.round(s) % 3) - 1) * 0.12);
      const c2 = beside(p, side * (p.wall + 10));
      if (clearOfRoads(track, c2.x, c2.z, 4)) sakura(b, c2.x, 0, c2.z, 1.15);
    }
  });
  const start = pointAt(track, 40);
  landmark(city, 'sakura', start.x, 0, start.z);
  city.add(petals({ x: pointAt(track, 80).x, z: pointAt(track, 80).z }, 180));

  // ---- 二重橋（石の手すりと街灯）----
  const nj = pointAt(track, sOf(track, 'NJ'));
  landmark(city, 'nijubashi', nj.x, 0, nj.z);
  along(track, ['NJ', 'MRN', -0.04], ['NJ', 'MRN', 0.04], 3, (p) => {
    for (const side of [-1, 1]) {
      const c = beside(p, side * (p.half + 0.6));
      b.push(c.x, p.y, c.z, ryAlong(p.h));
      b.box(0.8, 1.2, 3.2, 0xb8b2a4, 0, 0, 0);
      b.pop();
    }
  });
  for (const t of [-0.03, 0, 0.03]) {
    const p = pointAt(track, sOf(track, ['NJ', 'MRN', t]));
    for (const side of [-1, 1]) {
      const c = beside(p, side * (p.half + 0.6));
      b.cyl(0.15, 0.15, 5, 6, 0x222222, c.x, 0, c.z);
      b.sphere(0.6, 0xfff6dc, c.x, 5.4, c.z, 8);
    }
  }

  // ---- 皇居（石垣・櫓門・砂利の広場・宮殿・松）----
  along(track, ['NJ', 'MRN', 0.06], ['NJ', 'MRN', 0.55], 10, (p) => {
    for (const side of [-1, 1]) {
      const c = beside(p, side * (p.wall + 2.5));
      b.push(c.x, 0, c.z, ryAlong(p.h));
      b.box(3, 10, 10.5, STONE, 0, 0, 0);
      b.pop();
      coneTree(b, c.x - Math.sin(p.h) * side * 2, 10, c.z + Math.cos(p.h) * side * 2, 0.9, 0x2f5d3a);
    }
  });
  {
    const p = pointAt(track, sOf(track, ['NJ', 'MRN', 0.08]));
    const w = 2 * (p.wall + 4);
    b.push(p.x, 0, p.z, ryAlong(p.h)); // x が道の横の向き
    for (const side of [-1, 1]) b.box(6, 12, 8, WHITE, side * (w / 2), 0, 0);
    b.box(w + 6, 3, 8, WHITE, 0, 12, 0); // 櫓の白い壁
    b.box(w + 10, 1.2, 11, 0x3a3a40, 0, 15, 0); // 瓦の屋根
    b.box(w + 4, 1.2, 9, 0x3a3a40, 0, 16.2, 0);
    // 英語の看板「IMPERIAL PALACE」は、門の正面の上（くぐる前に正面から見える。道ばたに立てると石垣に埋まった。2026-10-21 のユーザー依頼）
    b.box(24, 3.2, 0.4, 0x2a2a30, 0, 11.6, -4.3);
    b.label(textSign('IMPERIAL PALACE', { bg: '#2a2a30', fg: '#f2ead2', font: 'bold 64px serif' }), [768, 128], 0, 13.2, -4.6, Math.PI, 22.8, 2.8);
    b.label(textSign('IMPERIAL PALACE', { bg: '#2a2a30', fg: '#f2ead2', font: 'bold 64px serif' }), [768, 128], 0, 13.2, 4.3, 0, 22.8, 2.8);
    b.pop();
    landmark(city, 'palaceSign', p.x, 13.2, p.z);
  }
  // 宮殿は、地図の点に近い道の横に、道にそって長く置く（地図の点のままだと建物が道の上に重なり、壁のように見えた。2026-10-21 のユーザー依頼）
  const pw = worldAt(track, S.palace.at);
  const pl = locate(track, pw.x, pw.z, null, 40);
  const pp = pointAt(track, pl.s);
  const pside = Math.sign(pl.lateral) || 1;
  const palace = beside(pp, pside * (pp.wall + 34));
  landmark(city, 'palace', palace.x, 12, palace.z);
  const pry = ryAlong(pp.h) + Math.PI / 2; // x が道にそう向き
  b.push(palace.x, 0, palace.z, pry);
  b.box(220, 0.05, 90, 0xe8e2d4, 0, -0.09, 0); // 白い砂利の広場（道より下）
  // 石の台（高さ 12m）の上に宮殿。道ばたの石垣（10m）より高くして、道から見えるように（2026-10-21 のユーザー依頼「壁の上に持ち上げて」）
  b.box(132, 12, 54, STONE, 0, 0, 0);
  b.push(0, 12, 0, 0);
  b.box(120, 14, 40, 0xece8dc, 0, 0, 0); // 宮殿（低く横に長い）
  for (let k = 0; k < 15; k++) for (const z of [-20.3, 20.3]) b.box(2, 8, 0.5, 0x6a4a32, -56 + k * 8, 2, z); // 柱
  b.box(128, 1.6, 48, ROOF_COPPER, 0, 14, 0); // 大きな屋根（反りを段で）
  b.box(118, 1.6, 40, ROOF_COPPER, 0, 15.6, 0);
  b.box(104, 1.6, 30, ROOF_COPPER, 0, 17.2, 0);
  b.box(80, 1.2, 18, ROOF_COPPER, 0, 18.8, 0);
  b.pop();
  b.pop();
  for (const [dx, dz] of [[-90, -60], [-70, 70], [80, -70], [95, 60], [-110, 10], [110, -5]]) {
    const x = palace.x + dx;
    const z = palace.z + dz;
    if (clearOfRoads(track, x, z, 4)) coneTree(b, x, 0, z, 1.3, 0x2f5d3a);
  }

  // ---- 丸の内（新丸ビルと高層ビル）と、東京駅 ----
  const shin = worldAt(track, S.shinmaru.at);
  landmark(city, 'shinmaru', shin.x, 0, shin.z);
  b.box(54, 30, 44, 0xc9b9a0, shin.x, 0, shin.z); // 下の低い建物（石の色）
  tower(b, shin.x, shin.z, 0, 46, 36, 140, 0x8fa3b5, { y: 30 });
  tower(b, shin.x, shin.z, 0, 38, 28, 22, 0x8fa3b5, { y: 170 });
  b.box(30, 6, 22, 0x6f8091, shin.x, 192, shin.z);
  S.marunouchi.forEach(([x, z], k) => {
    const w = worldAt(track, [x, z]);
    tower(b, w.x, w.z, 0, 40 + (k % 3) * 8, 36, 120 + ((k * 29) % 80), [0x9fb1c2, 0x7f93a6, 0xb4c0cc][k % 3]);
  });
  const st = worldAt(track, S.tokyoStation.at);
  landmark(city, 'tokyoStation', st.x, 0, st.z);
  b.push(st.x, 0, st.z, 0);
  b.box(22, 25, 330, BRICK, 0, 0, 0);
  for (const y of [8, 17]) b.box(22.4, 1.4, 330.4, WHITE, 0, y, 0); // 白い帯
  for (let k = 0; k < 40; k++) b.box(22.6, 4, 2.2, 0xe8e4da, 0, 10, -156 + k * 8); // 窓の白いふち
  b.box(28, 30, 40, BRICK, 0, 0, 0); // 真ん中
  b.box(28.4, 2, 40.4, 0x4a5058, 0, 30, 0);
  for (const zz of [-150, 150]) {
    b.cyl(17, 17, 32, 8, BRICK, 0, 0, zz); // 南北のドーム
    b.cyl(17.4, 17.4, 1.6, 8, WHITE, 0, 18, zz);
    b.cyl(4, 17.5, 12, 8, 0x5a6168, 0, 32, zz); // 灰色の八角の屋根
    b.cyl(0.5, 0.5, 4, 6, 0x5a6168, 0, 44, zz);
  }
  b.pop();
  // 英語の看板「TOKYO STATION」: 駅の手前のカーブに入る前から、正面に見える所（カーブの外がわの先）に、高い柱の上の大きな板
  // （駅の建物に付けた看板は見えなかった。2026-10-21 のユーザー依頼）
  {
    const cw = worldAt(track, [400, -60]);
    const cl = locate(track, cw.x, cw.z, null, 40);
    const pin = pointAt(track, cl.s - 60);
    const c = pointAt(track, cl.s);
    let x = 0;
    let z = 0;
    for (let d = c.wall + 18; d < c.wall + 120; d += 4) {
      x = c.x + Math.cos(pin.h) * d;
      z = c.z + Math.sin(pin.h) * d;
      if (clearOfRoads(track, x, z, 8)) break;
    }
    const ry = ryAlong(pin.h) + Math.PI; // 走ってくる方へ
    b.push(x, 0, z, ry);
    for (const sx of [-9, 9]) b.box(0.8, 14, 0.8, 0x4a4a52, sx, 0, 0);
    b.box(26, 7, 0.6, 0x6a2a1f, 0, 14, 0);
    const draw = textSign('TOKYO STATION', { bg: '#6a2a1f', fg: '#ffffff', font: 'bold 110px serif' });
    b.label(draw, [1024, 256], 0, 17.5, 0.4, 0, 25, 6.2);
    b.label(draw, [1024, 256], 0, 17.5, -0.4, Math.PI, 25, 6.2);
    b.pop();
    landmark(city, 'stationSign', x, 17, z);
  }
  cityBlocks(b, track, 'MRN', 'TT', { avoid: [{ ...st, r: 190 }, { ...shin, r: 60 }] });

  // ---- 東京タワー（赤と白のしま、高さ 333m）----
  const tt = worldAt(track, S.tokyoTower.at);
  landmark(city, 'tokyoTower', tt.x, 0, tt.z);
  const RED = 0xe8481c;
  // 下の方は4本の足（鉄の棒）と横のわく。40m ごとに赤と白。上の方（160m から）は細い四角すい
  const legAt = (k, y) => {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const r = 40 - (32 * y) / 160; // 足の広がり（地面 40m → 160m で 8m）
    return [tt.x + Math.cos(a) * r, y, tt.z + Math.sin(a) * r];
  };
  for (let y = 0; y < 160; y += 40) {
    const color = (y / 40) % 2 ? WHITE : RED;
    for (let k = 0; k < 4; k++) {
      const [x1, y1, z1] = legAt(k, y);
      const [x2, y2, z2] = legAt(k, y + 40);
      b.rod(x1, y1, z1, x2, y2, z2, 2.4, color);
      const [x3, , z3] = legAt((k + 1) % 4, y + 40);
      b.rod(x2, y2, z2, x3, y2, z3, 1.2, color); // 横のわく
      const [x4, , z4] = legAt((k + 1) % 4, y);
      b.rod(x1, y1 + 2, z1, x3, y2, z3, 0.6, color); // ななめの格子
      b.rod(x4, y1 + 2, z4, x2, y2, z2, 0.6, color);
    }
  }
  const sect = [[160, 200, 8, 6.5], [200, 240, 6.5, 5.2], [240, 250, 6.5, 6.5], [250, 290, 5, 2.5], [290, 333, 2.5, 0.5]];
  sect.forEach(([y0, y1, r0, r1], k) => {
    const deck = y1 - y0 === 10;
    b.push(tt.x, 0, tt.z, Math.PI / 4);
    b.cyl(r1, r0, y1 - y0, 4, deck ? 0x9aa3ad : k % 2 ? WHITE : RED, 0, y0, 0, !deck);
    b.pop();
  });
  for (const [y, w] of [[140, 26], [240, 14]]) {
    b.box(w, 12, w, 0xd8e2ea, tt.x, y, tt.z); // 展望台（窓）
    b.box(w + 1, 1.2, w + 1, 0x4a5058, tt.x, y + 12, tt.z);
  }

  // ---- 新幹線の線路（道の北がわ 30m、高架 8m）----
  const line = S.shinkansenLine;
  const ls = sOf(track, line.from);
  const le = sOf(track, line.to);
  viaduct(b, track, ls, le, line.off, line.y);
  // 線路の終わりは、新幹線が入っていくトンネルの入口（急に消えて見えないように。2026-10-21 のユーザー依頼）
  {
    const pe = pointAt(track, le);
    const pq = pointAt(track, le - 10);
    const a = beside(pe, line.off);
    const c = beside(pq, line.off);
    b.push(a.x, 0, a.z, Math.atan2(a.x - c.x, a.z - c.z)); // z が線路の向き
    for (const sx of [-1, 1]) b.box(5, line.y + 9, 14, 0x8a8f96, sx * 7.5, 0, 7);
    b.box(20, 4, 14, 0x8a8f96, 0, line.y + 6, 7);
    b.box(10, 6, 0.4, 0x111111, 0, line.y + 0.2, 0.1); // 暗い入口
    b.box(24, 1.2, 16, 0x5a6168, 0, line.y + 10, 7);
    b.pop();
  }
  const lm = pointAt(track, (ls + le) / 2);
  const lc = beside(lm, line.off);
  landmark(city, 'shinkansenLine', lc.x, line.y, lc.z);
  cityBlocks(b, track, 'TT', 'SL', { avoid: [{ ...tt, r: 80 }], back: 45 });

  // ---- 芝浦のループ（柱）と、レインボーブリッジ ----
  for (const c of loopPillars(track)) bb.cyl(1.6, 1.6, c.top, 8, 0xc8ccd2, c.x, 0, c.z);
  const rbs = sOf(track, 'RB');
  const rbe = sOf(track, 'RBE');
  const towers = [rbs + (rbe - rbs) * 0.28, rbs + (rbe - rbs) * 0.72];
  const topOf = 126;
  const tp = towers.map((s) => pointAt(track, s));
  for (const p of tp) {
    const off = p.wall + 3;
    for (const side of [-1, 1]) {
      const c = beside(p, side * off);
      bb.box(5, topOf, 5, WHITE, c.x, 0, c.z);
    }
    bb.push(p.x, 0, p.z, ryAlong(p.h)); // x が道の横の向き
    for (const y of [p.y - 6, 70, 118]) bb.box(2 * off + 5, 4, 4, WHITE, 0, y, 0); // 横の梁
    bb.pop();
  }
  // ケーブル（主塔のてっぺんから、真ん中で下がる。両はしは橋のたもとへ）と、つりさげの線
  for (const side of [-1, 1]) {
    const pts = [];
    for (let s = rbs; s <= rbe; s += 12) {
      const p = pointAt(track, s);
      const c = beside(p, side * (p.wall + 3));
      let y;
      if (s < towers[0]) y = p.y + 2 + ((topOf - p.y - 2) * (s - rbs)) / (towers[0] - rbs);
      else if (s > towers[1]) y = p.y + 2 + ((topOf - p.y - 2) * (rbe - s)) / (rbe - towers[1]);
      else {
        const u = (s - towers[0]) / (towers[1] - towers[0]);
        y = topOf - (topOf - p.y - 8) * 4 * u * (1 - u);
      }
      pts.push({ x: c.x, y, z: c.z, dy: p.y });
    }
    for (let k = 0; k + 1 < pts.length; k++) bb.rod(pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z, 0.5, WHITE);
    for (const q of pts) if (q.y - q.dy > 3) bb.rod(q.x, q.dy + 1, q.z, q.x, q.y, q.z, 0.15, 0xe8e8e8);
  }
  // 白い橋げた: 2.5m ごとの短い板（10m の平らな板だと、坂で階段のように見えた。2026-10-21 のユーザー依頼）
  along(track, 'RB', 'RBE', 2.5, (p) => {
    bb.push(p.x, p.y - 3.2, p.z, ryAlong(p.h));
    bb.box(2 * p.wall + 4, 3, 2.9, 0xeef0f2, 0, 0, 0);
    bb.pop();
  });
  // 橋のたもとの柱は、道の両がわに（道の真ん中に立てると、下を通る芝浦のループの道の上に立っていた。2026-10-21 のユーザー依頼）
  for (const s of [rbs, rbe]) {
    const p = pointAt(track, s);
    for (const side of [-1, 1]) {
      const c = beside(p, side * (p.wall + 6));
      if (clearOfRoads(track, c.x, c.z, 2)) bb.cyl(3, 3, Math.max(1, p.y - 3), 8, 0xc8ccd2, c.x, 0, c.z);
    }
  }
  const rbm = pointAt(track, (rbs + rbe) / 2);
  landmark(bay, 'rainbowBridge', rbm.x, rbm.y, rbm.z);
  // 東京湾の水は、橋の下（芝浦とお台場の間）と、お台場の西（大ジャンプで飛ぶ下）だけ。お台場の島はアスファルト
  // （水の板がお台場ごとおおって、全部が海に見えた。2026-10-21 のユーザー依頼「ここは下もアスファルト」）
  const rect = (x0, z0, x1, z1, color, y, h, water) => {
    const a = worldAt(track, [x0, z0]);
    const c = worldAt(track, [x1, z1]);
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(c.x - a.x), h, Math.abs(c.z - a.z)), new THREE.MeshLambertMaterial({ color }));
    m.position.set((a.x + c.x) / 2, y + h / 2, (a.z + c.z) / 2);
    m.userData.water = water;
    bay.add(m);
  };
  rect(690, 430, 1120, 900, 0x2f6f9a, -0.095, 0.04, true); // 橋の下の海
  rect(200, 860, 930, 1200, 0x2f6f9a, -0.095, 0.04, true); // お台場の西の海
  rect(950, 760, 1420, 1060, 0x4a4d52, -0.09, 0.06, false); // お台場の島（アスファルト）

  // ---- お台場: フジテレビ（格子の建物と球体）----
  const ftv = worldAt(track, S.fujiTV.at);
  landmark(bay, 'fujiTV', ftv.x, 0, ftv.z);
  // 2つの塔は、レインボーブリッジから見て左右に並べる（前後に並ぶと、手前の塔が球体を隠した。2026-10-21 のユーザー依頼「90度ほど回転」）。
  // 塔の間は広く（球体だと分かるように）、球体は少し下げる（2026-10-21 のユーザー依頼）
  const rbv = pointAt(track, (sOf(track, 'RB') + sOf(track, 'RBE')) / 2);
  const vl = Math.hypot(ftv.x - rbv.x, ftv.z - rbv.z);
  const vx = (ftv.x - rbv.x) / vl;
  const vz = (ftv.z - rbv.z) / vl;
  const ftvRy = Math.atan2(vx, vz); // z が橋から見る向き
  const HALF = 40; // 塔の真ん中どうしの半分
  for (const sd of [-1, 1]) {
    const tx = ftv.x - vz * HALF * sd;
    const tz = ftv.z + vx * HALF * sd;
    tower(bb, tx, tz, ftvRy, 34, 34, 120, 0xe8eaec, { win: 0x8a96a3 });
    for (let y = 10; y < 120; y += 20) {
      bb.push(tx, 0, tz, ftvRy);
      bb.box(34.6, 1.6, 34.6, 0x8a96a3, 0, y, 0);
      bb.pop();
    }
    landmark(bay, 'fujiTVTower', tx, 0, tz);
  }
  bb.push(ftv.x, 0, ftv.z, ftvRy);
  for (const y of [40, 104]) bb.box(2 * HALF - 30, 8, 16, 0xe8eaec, 0, y, 0); // 2つの塔をつなぐ通路（上と下）
  bb.pop();
  bb.sphere(20, 0xd8dee6, ftv.x, 80, ftv.z, 20); // 球体（少し下げて、通路の間に）
  landmark(bay, 'fujiTVSphere', ftv.x, 80, ftv.z);
  // 名前は1枚だけ: 橋から見える面（下の通路の、橋の方の面）
  bb.push(ftv.x, 0, ftv.z, ftvRy);
  bb.label(textSign('FUJI TV', { bg: '#ffffff', fg: '#1f4aa8', font: 'bold 96px sans-serif' }), [512, 128], 0, 44, -8.3, Math.PI, 36, 9);
  bb.pop();
  landmark(bay, 'fujiTVSign', ftv.x - vx * 8, 44, ftv.z - vz * 8);
  // フジテレビの前（橋から見る線のまわり）には、ビルを建てない（前のビルが球体を隠した。2026-10-21 のユーザー依頼）
  const sight = [{ ...ftv, r: 90 }];
  for (let u = 0.15; u < 1; u += 0.05) sight.push({ x: rbv.x + (ftv.x - rbv.x) * u, z: rbv.z + (ftv.z - rbv.z) * u, r: 60 });
  cityBlocks(bb, track, 'RBE', 'FTV', { back: 40, hMax: 70, avoid: sight, group: bay });

  // ---- 巨大ジャンプ台（加速板の巨大版。オレンジと黄色の光る矢印、赤白の柱）----
  const glow = createBuilder({ glow: true });
  const js = sOf(track, 'JP');
  const je = sOf(track, 'AJ');
  // ジャンプ台の下の台（高いジャンプ台が宙に浮いて見えないように）と、光る矢印（階段に見えないように。src/render/world/kit.js）
  buildRampDeck(bb, glow, track, js, je);
  for (const s of [js, je]) {
    const p = pointAt(track, s);
    for (const side of [-1, 1]) {
      const c = beside(p, side * (p.wall + 1));
      for (let k = 0; k < 6; k++) bb.cyl(0.8, 0.8, 2, 8, k % 2 ? WHITE : 0xe0251c, c.x, p.y + k * 2, c.z);
    }
  }
  const jm = pointAt(track, (js + je) / 2);
  landmark(bay, 'bigJump', jm.x, jm.y, jm.z);

  // まわりの木
  along(track, 'ODA', 'JP', 25, (p) => {
    for (const side of [-1, 1]) {
      const c = beside(p, side * (p.wall + 6));
      if (clearOfRoads(track, c.x, c.z, 3)) roundTree(bb, c.x, 0, c.z, 1);
    }
  });

  city.add(b.build());
  bay.add(bb.build(), glow.build());
  return root;
}
