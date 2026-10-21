// Global City のニューヨーク（2026-10-20）: 碁盤の目の街を直角に曲がって北へ。タイムズスクエア、マディソン街の Jefferies 本社とユニクロ、
// 五番街のティファニー、セントラルパークの中を通って、ジョージ・ワシントン・ブリッジでハドソン川をわたる。NY育英学園の門をくぐると輪っか
import * as THREE from '../../../vendor/three.module.min.js?v=0e78471';
import { createBuilder } from '../town/builder.js?v=0e78471';
import { locate } from '../../game/track.js?v=0e78471';
import { GLOBAL_SCENERY } from '../../data/global.js?v=0e78471';
import { landmark, worldAt, sOf, along, beside, pointAt, tower, textSign, roundTree, roadBanner, trafficLight } from './kit.js?v=0e78471';
import { cityBlocks } from './tokyo.js?v=0e78471';

const ryAlong = (h) => Math.atan2(Math.cos(h), Math.sin(h));
const BOARD = [0xff2d3a, 0x2d7dff, 0xffd21a, 0x2de07a, 0xff7a1a, 0xffffff];

// 名所の建物の置き場所: 地図の点に近い道の横（道のはしから 5m あけて、建物の半分のはば half）。side を決めると、その側に
function spot(track, at, half, side = 0, ds = 0) {
  const w = worldAt(track, at);
  const loc = locate(track, w.x, w.z, null, 40);
  const p = pointAt(track, loc.s + ds);
  const sd = side || Math.sign(loc.lateral) || 1;
  const c = beside(p, sd * (p.wall + half + 5));
  return { x: c.x, z: c.z, ry: ryAlong(p.h), side: sd, s: loc.s + ds, r: half * 1.5 + 12 };
}

const clear = (track, x, z, gap) => {
  const loc = locate(track, x, z, null, 40);
  return Math.abs(loc.lateral) > loc.wall + gap;
};

// 名前の看板を、建物の4つの面に（道に面した横と、走ってくる方から見える前後）
function signs(b, draw, px, w, y, sw, sh) {
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    b.label(draw, px, Math.sin(a) * (w / 2 + 0.3), y, Math.cos(a) * (w / 2 + 0.3), a, sw, sh);
  }
}

export function buildNewYork(track) {
  const S = GLOBAL_SCENERY.newyork;
  const root = new THREE.Group();
  const g = new THREE.Group();
  g.userData.stages = [5];
  root.add(g);
  const b = createBuilder();
  const glow = createBuilder({ glow: true });

  // 名所の建物の場所（まわりには、ふつうのビルを建てない。重なって隠れた）
  // Jefferies とユニクロは、直角の角の正面（走ってくる車から真正面に見える所）に、大きく（2026-10-21 のユーザー依頼「存在感が無い。視認性も悪い」）
  const cornerSpot = (mark, half) => {
    const s0 = sOf(track, mark);
    const pin = pointAt(track, s0 - 30);
    const c = pointAt(track, s0);
    for (let d = c.wall + half + 6; d < c.wall + half + 80; d += 4) {
      const x = c.x + Math.cos(pin.h) * d;
      const z = c.z + Math.sin(pin.h) * d;
      if (clear(track, x, z, half * 1.42 + 2)) return { x, z, ry: Math.atan2(-Math.cos(pin.h), -Math.sin(pin.h)), r: half * 1.5 + 12 };
    }
    return null;
  };
  const jf = cornerSpot('MAD', 23) ?? spot(track, S.jefferies.at, 22);
  const uq = cornerSpot('Z5', 17) ?? spot(track, S.jefferies.at, 16, jf.side, 46);
  const tf = spot(track, S.tiffany.at, 16);
  // 高層ビルの街（道ぞい）。セントラルパークの中は建てない
  cityBlocks(b, track, 'NY', 'CP', { avoid: [jf, uq, tf], step: 40, back: 20, hMin: 60, hMax: 220, colors: [0x9aa4ae, 0xb8b0a0, 0x7f8a96, 0xc8c2b4, 0x6a7480] });
  for (const at of S.skyline) {
    const w = worldAt(track, at);
    if (clear(track, w.x, w.z, 30) && ![jf, uq, tf].some((a) => Math.hypot(a.x - w.x, a.z - w.z) < a.r + 20)) tower(b, w.x, w.z, 0, 34, 34, 180 + ((Math.abs(at[0]) * 7) % 120), 0x8a949e, { crown: 12 });
  }

  // 直角の角の正面（まっすぐ行った先）にもビル（空き地に見えた）
  for (const mark of ['NY1']) {
    const s0 = sOf(track, mark);
    const pin = pointAt(track, s0 - 30);
    const c = pointAt(track, s0);
    for (const k of [0, 1]) {
      const d = c.wall + 26 + k * 50;
      const x = c.x + Math.cos(pin.h) * d;
      const z = c.z + Math.sin(pin.h) * d;
      if (clear(track, x, z, 22) && ![jf, uq, tf].some((a) => Math.hypot(a.x - x, a.z - z) < a.r + 20)) tower(b, x, z, ryAlong(pin.h), 40, 40, 90 + k * 60, k ? 0x8a949e : 0xb8b0a0, { crown: 6 });
    }
  }

  // タイムズスクエア: 角のまわりのビルに、光る大きな看板をびっしり
  const ts = pointAt(track, sOf(track, 'TSQ'));
  landmark(g, 'timesSquare', ts.x, 0, ts.z);
  let n = 0;
  for (const [fx, fz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const x = ts.x + fx * (ts.wall + 22);
    const z = ts.z + fz * (ts.wall + 22);
    if (!clear(track, x, z, 16)) continue;
    tower(b, x, z, 0, 26, 26, 120 + n * 15, 0x5a626c);
    // ビルの4つの面に、大きさのちがう光る看板（白いふち）
    for (let face = 0; face < 4; face++) {
      glow.push(x, 0, z, (face * Math.PI) / 2);
      let y = 5;
      while (y < 75) {
        n++;
        const ph = 7 + (n % 3) * 4;
        const pw = [22, 14, 18, 10][n % 4];
        const px = n % 2 ? 0 : ((n % 5) - 2) * 2;
        glow.box(pw + 0.8, ph + 0.8, 0.3, 0xffffff, px, y - 0.4, 13.1); // ふち
        glow.box(pw, ph, 0.3, BOARD[n % BOARD.length], px, y, 13.3);
        if (n % 3 === 0) glow.box(pw * 0.7, ph * 0.3, 0.2, BOARD[(n + 2) % BOARD.length], px, y + ph * 0.35, 13.5); // 看板の中の絵（色の板）
        y += ph + 2;
      }
      glow.pop();
    }
  }

  // マディソン街の Jefferies 本社（高さ 210m のガラスのビル。正面に大きな光る看板、てっぺんの4面にも）
  landmark(g, 'jefferies', jf.x, 0, jf.z);
  b.push(jf.x, 0, jf.z, jf.ry);
  glow.push(jf.x, 0, jf.z, jf.ry);
  b.box(46, 210, 46, 0x3f5f86, 0, 0, 0);
  for (let y = 3; y < 208; y += 4) b.box(46.3, 0.5, 46.3, 0x9ab8d4, 0, y, 0); // ガラスの横すじ
  b.box(48, 10, 48, 0x1f2f45, 0, 0, 0); // 入り口の階
  for (const x of [-23.2, 23.2]) for (const z of [-23.2, 23.2]) glow.box(0.5, 210, 0.5, 0xeaf2ff, x, 0, z); // 光るかど
  glow.box(40, 11, 0.4, 0x13294b, 0, 16, 23.3); // 正面の大きな看板（紺）
  b.label(textSign('Jefferies', { bg: '#13294b', fg: '#ffffff', font: 'bold 96px serif' }), [768, 192], 0, 21.5, 23.6, 0, 38, 9.5);
  signs(b, textSign('Jefferies', { bg: '#ffffff', fg: '#13294b', font: 'bold 96px serif' }), [768, 192], 46.4, 196, 40, 10); // てっぺんの4面
  glow.pop();
  b.pop();
  // ユニクロ（白い箱の建物に、赤い大きな看板「UNIQLO」。正面と横）
  landmark(g, 'uniqlo', uq.x, 0, uq.z);
  b.push(uq.x, 0, uq.z, uq.ry);
  glow.push(uq.x, 0, uq.z, uq.ry);
  b.box(34, 34, 34, 0xf4f4f4, 0, 0, 0);
  glow.box(26, 26, 0.4, 0xe60012, 0, 5, 17.2); // 正面の赤い大きな看板
  b.label(textSign('UNIQLO', { bg: '#e60012', fg: '#ffffff', font: 'bold 120px sans-serif' }), [512, 512], 0, 18, 17.5, 0, 25, 25);
  for (const sd of [-1, 1]) {
    glow.push(sd * 17.2, 0, 0, (sd * Math.PI) / 2);
    glow.box(18, 18, 0.4, 0xe60012, 0, 12, 0);
    glow.pop();
    b.label(textSign('UNIQLO', { bg: '#e60012', fg: '#ffffff', font: 'bold 120px sans-serif' }), [512, 512], sd * 17.5, 21, 0, (sd * Math.PI) / 2, 17, 17);
  }
  glow.pop();
  b.pop();

  // 五番街のティファニー（石のビル、ティファニーブルーの看板に白い字。入り口に時計を持つ像の代わりに金の時計）
  landmark(g, 'tiffany', tf.x, 0, tf.z);
  b.push(tf.x, 0, tf.z, tf.ry);
  b.box(30, 46, 30, 0xd8d0c0, 0, 0, 0);
  for (let y = 8; y < 44; y += 9) b.box(30.3, 1, 30.3, 0xb8b0a0, 0, y, 0);
  b.box(30.6, 6, 30.6, 0x81d8d0, 0, 0, 0);
  signs(b, textSign('TIFFANY & Co.', { bg: '#81d8d0', fg: '#ffffff', font: 'bold 64px serif' }), [512, 128], 30.6, 9.5, 20, 5);
  b.cyl(1.2, 1.2, 0.5, 12, 0xc9a23a, 15.6, 14, 0); // 金の時計
  b.pop();

  // セントラルパーク: 道の両がわに広い芝生と木、池。公園のまわりに高層ビル
  const c0 = sOf(track, 'CP');
  const c1 = sOf(track, 'CPN');
  const cm = pointAt(track, (c0 + c1) / 2);
  landmark(g, 'centralPark', cm.x, 0, cm.z);
  roadBanner(g, b, track, c0 + 6, 'CENTRAL PARK', 'bannerCentralPark', { bg: '#2f6f3a', fg: '#ffffff' }); // 入口の横断幕（2026-10-21 のユーザー依頼）
  b.push(cm.x, 0, cm.z, ryAlong(cm.h));
  b.box(260, 0.08, c1 - c0 + 60, 0x5f9a3f, 0, -0.09, 0); // 芝生（道より下。地面 -0.1 より上）
  b.box(70, 0.08, 50, 0x3f7fa8, -80, -0.08, 30); // 池
  b.pop();
  let k = 0;
  along(track, 'CP', 'CPN', 9, (p) => {
    for (const side of [-1, 1]) {
      k++;
      const lat = side * (p.wall + 6 + ((k * 13) % 7) * 14);
      const c = beside(p, lat);
      if (!clear(track, c.x, c.z, 4)) continue;
      roundTree(b, c.x, 0, c.z, 1 + (k % 3) * 0.3, k % 4 ? 0x3f7f35 : 0x5a9a3a);
    }
    for (const side of [-1, 1]) {
      k++;
      if (k % 3) continue;
      const c = beside(p, side * 150);
      if (clear(track, c.x, c.z, 20)) tower(b, c.x, c.z, ryAlong(p.h), 28, 28, 120 + ((k * 31) % 100), 0xa8a094, { crown: 6 });
    }
  });

  // ハドソン川（南北に流れる、ジョージ・ワシントン・ブリッジの下）
  const gw = worldAt(track, [560, 1355]);
  b.box(300, 0.08, 1000, 0x2a5a7a, gw.x, -0.09, gw.z - 200);
  // ジョージ・ワシントン・ブリッジ: 鉄の格子の主塔2本、太いケーブルとつり下げのワイヤー
  const g0 = sOf(track, S.gwb.from);
  const g1 = sOf(track, S.gwb.to);
  const gm = pointAt(track, (g0 + g1) / 2);
  landmark(g, 'gwb', gm.x, gm.y, gm.z);
  const STEEL = 0x8a9298;
  const H = 150;
  const towers = [g0 + (g1 - g0) * 0.22, g0 + (g1 - g0) * 0.78].map((s) => pointAt(track, s));
  const top = [];
  for (const p of towers) {
    const legs = [-1, 1].map((side) => beside(p, side * (p.half + 4)));
    for (const l of legs) {
      for (const dx of [-2.5, 2.5]) for (const dz of [-2.5, 2.5]) b.rod(l.x + dx, 0, l.z + dz, l.x + dx * 0.6, H, l.z + dz * 0.6, 0.5, STEEL, 4);
      for (let y = 0; y < H; y += 12) { // 格子のななめの骨
        b.rod(l.x - 2.5, y, l.z - 2.5, l.x + 2.5, y + 12, l.z + 2.5, 0.25, STEEL, 3);
        b.rod(l.x + 2.5, y, l.z - 2.5, l.x - 2.5, y + 12, l.z + 2.5, 0.25, STEEL, 3);
      }
    }
    for (const y of [p.y - 3, 60, 110, H]) b.rod(legs[0].x, y, legs[0].z, legs[1].x, y, legs[1].z, 1.2, STEEL, 4); // 横のはり
    top.push(legs);
  }
  // ケーブル（両がわ）: 岸 → 塔 → 塔 → 岸。塔の間はたるむ
  for (const j of [0, 1]) {
    const side = j ? 1 : -1;
    const cab = [];
    for (let s = g0; s <= g1 + 0.1; s += (g1 - g0) / 40) {
      const p = pointAt(track, s);
      const t = (s - g0) / (g1 - g0);
      let y;
      if (t < 0.22) y = p.y + 2 + ((H - p.y - 2) * t) / 0.22;
      else if (t > 0.78) y = p.y + 2 + ((H - p.y - 2) * (1 - t)) / 0.22;
      else { const u = (t - 0.5) / 0.28; y = p.y + 8 + (H - p.y - 8) * u * u; }
      const c = beside(p, side * (p.half + 4));
      cab.push({ x: c.x, y, z: c.z, d: p.y });
    }
    for (let i = 0; i + 1 < cab.length; i++) {
      const a = cab[i];
      const c = cab[i + 1];
      b.rod(a.x, a.y, a.z, c.x, c.y, c.z, 0.7, 0x6a7278, 4);
      if (a.y > a.d + 3) b.rod(a.x, a.y, a.z, a.x, a.d + 1, a.z, 0.12, 0x6a7278, 3); // つり下げのワイヤー
    }
  }

  // NY育英学園（Japanese Children's Society）の門: 道をまたぐ門と、名前の看板。横に校舎
  const ig = pointAt(track, sOf(track, 'IG'));
  landmark(g, 'ikueiGate', ig.x, ig.y, ig.z);
  b.push(ig.x, ig.y, ig.z, ryAlong(ig.h));
  const gx = ig.half + 3;
  for (const side of [-1, 1]) {
    b.box(2.4, 9, 2.4, 0xe8e2d4, side * gx, 0, 0);
    b.box(3, 0.6, 3, 0x8a6a4a, side * gx, 9, 0);
  }
  b.box(2 * gx + 4, 1.4, 1.6, 0x8a6a4a, 0, 9.6, 0); // 上の横木
  b.box(2 * gx, 3.6, 0.5, 0xffffff, 0, 6.2, 0); // 看板の板
  b.label(textSign("Japanese Children's Society", { bg: '#ffffff', fg: '#1a3a6a', font: 'bold 52px sans-serif' }), [1024, 96], 0, 7.2, -0.3, Math.PI, 2 * gx - 1, 1.5);
  b.label(textSign('NY育英学園', { bg: '#ffffff', fg: '#b01a2a', font: 'bold 72px sans-serif' }), [512, 96], 0, 5.4, -0.3, Math.PI, 9, 1.7);
  b.label(textSign('NY育英学園', { bg: '#ffffff', fg: '#b01a2a', font: 'bold 72px sans-serif' }), [512, 96], 0, 6.2, 0.3, 0, 9, 1.7);
  b.pop();
  const sc = beside(ig, (ig.wall + 30) * -1);
  if (clear(track, sc.x, sc.z, 22)) {
    b.push(sc.x, 0, sc.z, ryAlong(ig.h));
    b.box(30, 14, 50, 0xb86a4a, 0, 0, 0); // れんがの校舎
    for (let y = 3; y < 13; y += 4) b.box(30.3, 1.4, 50.3, 0xe8f0f4, 0, y, 0); // 窓の列
    b.box(32, 1, 52, 0x6a4a3a, 0, 14, 0);
    b.pop();
  }

  // 輪っか3つ（道いっぱいの、光る青白い輪。足もとに機械の箱と配線）
  S.rings.forEach((mark, j) => {
    const p = pointAt(track, sOf(track, mark));
    landmark(g, `ring${j + 1}`, p.x, p.y, p.z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(15, 1.3, 10, 48), new THREE.MeshBasicMaterial({ color: j === 2 ? 0xff9adf : 0x9fe8ff }));
    ring.position.set(p.x, p.y + 5, p.z); // 輪は道より大きく、道の外で地面に入る（道の上に輪の下が出ないように）
    ring.rotation.y = ryAlong(p.h);
    ring.userData.keep = true;
    ring.userData.ring = j;
    g.add(ring);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(13, 0.4, 6, 48), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    inner.position.copy(ring.position);
    inner.rotation.copy(ring.rotation);
    inner.userData.keep = true;
    g.add(inner);
    for (const side of [-1, 1]) {
      const c = beside(p, side * 17);
      b.push(c.x, p.y, c.z, ryAlong(p.h));
      b.box(4, 4, 6, 0x4a5058, 0, 0, 0);
      b.pop();
      glow.box(4.2, 0.6, 6.2, 0x9fe8ff, c.x, p.y + 3, c.z);
      b.rod(c.x, p.y + 4, c.z, p.x - Math.sin(p.h) * side * 14, p.y + 6, p.z + Math.cos(p.h) * side * 14, 0.25, 0x2a2e34, 3); // 配線
    }
  });

  // ワープ地点（輪っか）のまわりの高層ビル街（殺風景だった。2026-10-21 のユーザー依頼「ビルを大量に設置」）: 道の両がわに3列
  {
    let k = 0;
    const COLS = [0x8a949e, 0x6a7480, 0xa8b0b8, 0x4a5868, 0xc8c2b4];
    along(track, ['IG', 'R1', 0.3], 'R3', 28, (p) => {
      for (const side of [-1, 1]) {
        for (const back of [24, 62, 104]) {
          k++;
          const w = 22 + (k % 3) * 6;
          const c = beside(p, side * (p.wall + back + w / 2));
          if (!clear(track, c.x, c.z, w * 0.75 + 4)) continue;
          const h = 90 + ((k * 53) % 200);
          if (back === 24) tower(b, c.x, c.z, ryAlong(p.h), w, w, h, COLS[k % COLS.length], { glow, win: k % 2 ? 0xfff0c8 : 0xcfe6ff, crown: k % 4 ? 0 : 10 });
          else { // 奥の列は窓のしまなしの箱（軽くするため）
            b.push(c.x, 0, c.z, ryAlong(p.h));
            b.box(w, h, w, COLS[k % COLS.length], 0, 0, 0);
            b.pop();
          }
          landmark(g, 'ringTower', c.x, 0, c.z);
        }
      }
    });
  }

  // 信号機（直角の角の手前の右側。ニューヨークは右側通行。2026-10-21 のユーザー依頼）
  (track.def.squareCorners ?? []).forEach(([m], k) => trafficLight(g, b, glow, track, sOf(track, m) - 14, 1, k % 2 ? 'red' : 'green'));

  g.add(b.build(), glow.build());
  return root;
}
