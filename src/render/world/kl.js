// Global City のクアラルンプール（2026-10-20）: 夕方から夜。南のプトラジャヤのピンクモスクの中の回廊を通り、
// 北西のバトゥ洞窟（金色の像・虹色の階段）の中を通って、ペトロナスツインタワーの前でゴール
import * as THREE from '../../../vendor/three.module.min.js?v=49643e0';
import { createBuilder } from '../town/builder.js?v=49643e0';
import { locate } from '../../game/track.js?v=49643e0';
import { GLOBAL_SCENERY } from '../../data/global.js?v=49643e0';
import { landmark, worldAt, sOf, along, beside, pointAt, tower, textSign, buildRampDeck } from './kit.js?v=49643e0';
import { TUNNEL_HEIGHT } from '../snow/tunnel.js?v=49643e0';

const ryAlong = (h) => Math.atan2(Math.cos(h), Math.sin(h));
const PINK = 0xd9a0a8;
const PINK_LIGHT = 0xf0d0d6;
const ROCK = 0x8a8478;
const GOLD = 0xd4a62a;
const SILVER = 0xc8ccd2;

const clear = (track, x, z, gap) => {
  const loc = locate(track, x, z, null, 40);
  return Math.abs(loc.lateral) > loc.wall + gap;
};

// 道から need m 以上はなれた所（近ければ、道の横へ押し出す）
function away(track, x, z, need) {
  const loc = locate(track, x, z, null, 40);
  if (Math.abs(loc.lateral) >= loc.wall + need) return { x, z };
  const p = pointAt(track, loc.s);
  return beside(p, (Math.sign(loc.lateral) || 1) * (p.wall + need));
}

export function buildKL(track) {
  const S = GLOBAL_SCENERY.kl;
  const root = new THREE.Group();
  const g = new THREE.Group();
  g.userData.stages = [6];
  root.add(g);
  const b = createBuilder();
  const glow = createBuilder({ glow: true });
  const WIN = 0xffe0a0;

  // ---- プトラ・モスク: 道は中の回廊（src/render/snow/tunnel.js の mosque）を通る。回廊の上に大きなピンクのドーム ----
  const m0 = sOf(track, 'PM');
  const m1 = sOf(track, ['PM', 'BC', 0.08]);
  const mc = pointAt(track, (m0 + m1) / 2);
  landmark(g, 'pinkMosque', mc.x, 0, mc.z);
  const len = m1 - m0 + 12;
  // 両がわの建物と回廊の屋根は、道にそって 5m ごとに（道が曲がっているので、1つの箱だと回廊にはみ出した。最後のレビュー）
  for (let s = m0 - 6; s <= m1 + 6; s += 5) {
    const p = pointAt(track, s);
    const w = p.wall + 0.5;
    b.push(p.x, p.y, p.z, ryAlong(p.h));
    for (const side of [-1, 1]) b.box(16, TUNNEL_HEIGHT + 4, 5.4, PINK_LIGHT, side * (w + 8.2), 0, 0);
    b.box(2 * w + 33, 3, 5.4, PINK_LIGHT, 0, TUNNEL_HEIGHT + 0.6, 0);
    b.pop();
  }
  b.push(mc.x, mc.y, mc.z, ryAlong(mc.h));
  const hall = mc.wall + 0.5;
  // ドームの台（高く。球の下半分が台の中に入り、回廊の天井から下に出ないように。最後のレビュー）
  b.cyl(22, 24, 24, 24, PINK_LIGHT, 0, TUNNEL_HEIGHT + 3.6, 0);
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    b.box(1.6, 8, 0.6, 0xb87a86, Math.sin(a) * 23.3, TUNNEL_HEIGHT + 14, Math.cos(a) * 23.3, a); // 台の窓
  }
  b.sphere(22, PINK, 0, TUNNEL_HEIGHT + 27.6, 0, 20); // 大きなピンクのドーム
  b.cyl(0.4, 1, 6, 6, GOLD, 0, TUNNEL_HEIGHT + 49, 0); // てっぺんの飾り
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { // 四すみの小さなドーム
    b.cyl(5, 5, 4, 12, PINK_LIGHT, x * (hall + 8), TUNNEL_HEIGHT + 4, z * (len / 2 - 6));
    b.sphere(5, PINK, x * (hall + 8), TUNNEL_HEIGHT + 8, z * (len / 2 - 6), 12);
  }
  b.pop();
  // ミナレット（高さ 116m の尖塔。白とピンク、段々）
  const mn = beside(mc, -(mc.wall + 60));
  b.cyl(5, 6, 60, 8, PINK_LIGHT, mn.x, 0, mn.z);
  b.cyl(6.5, 6.5, 2, 8, PINK, mn.x, 60, mn.z);
  b.cyl(4, 5, 34, 8, PINK_LIGHT, mn.x, 62, mn.z);
  b.cyl(5.5, 5.5, 2, 8, PINK, mn.x, 96, mn.z);
  b.cyl(2.5, 3.5, 12, 8, PINK_LIGHT, mn.x, 98, mn.z);
  b.cyl(0, 2.6, 8, 8, PINK, mn.x, 110, mn.z);
  // プトラジャヤの湖（モスクの東）
  const lk = away(track, ...Object.values(worldAt(track, S.lake.at)), 60);
  landmark(g, 'lake', lk.x, 0, lk.z);
  b.box(160, 0.08, 220, 0x2a4a6a, lk.x, -0.09, lk.z);
  for (let k = 0; k < 14; k++) glow.box(3, 0.04, 30 + (k % 3) * 15, k % 2 ? 0xffb0c0 : 0xffe0a0, lk.x - 70 + k * 10, -0.0, lk.z); // 水に映るモスクの光

  // ---- バトゥ洞窟: 石灰岩の岩山。道は洞窟の中（暗い）。入口の前に金色の像と虹色の階段 ----
  const c0 = sOf(track, 'BC');
  const c1 = sOf(track, ['BC', 'BX', 0.95]);
  const bc = pointAt(track, c0);
  landmark(g, 'batuCaves', bc.x, bc.y, bc.z);
  // 洞窟の上と両がわを、岩でおおう（道の上は、トンネルの天井の上から）
  let k = 0;
  for (let s = c0 - 4; s <= c1 + 4; s += 5) {
    const p = pointAt(track, s);
    const w = p.wall + 0.5;
    b.push(p.x, 0, p.z, ryAlong(p.h));
    for (const side of [-1, 1]) {
      k++;
      const hgt = p.y + 40 + ((k * 13) % 5) * 8;
      b.box(30, hgt, 6.5, k % 3 ? ROCK : 0x7a7468, side * (w + 15.5), 0, 0); // 両がわの岩
    }
    b.box(2 * w + 2, 30 + (k % 4) * 6, 6.5, ROCK, 0, p.y + TUNNEL_HEIGHT + 0.6, 0); // 天井の上の岩
    b.pop();
  }
  // 入口の上の名前（2026-10-22 のユーザー依頼「ジャンプで入る際に、洞窟の入口の上に名前を英語で」）: 一番手前の岩の前に、走ってくる方へ向けて
  {
    const p = pointAt(track, c0 - 4);
    const w = 2 * p.wall + 6;
    const y = p.y + TUNNEL_HEIGHT + 4.2;
    const o = landmark(g, 'batuCavesSign', p.x - Math.cos(p.h) * 3.6, y, p.z - Math.sin(p.h) * 3.6);
    o.userData.banner = 'BATU CAVES';
    b.push(p.x, 0, p.z, ryAlong(p.h));
    b.box(w + 1.2, 7, 0.4, 0x5a1a12, 0, y - 3.5, -3.45); // 看板の板
    b.label(textSign('BATU CAVES', { bg: '#7a1f14', fg: '#ffd34a', font: 'bold 130px sans-serif' }), [1024, 192], 0, y, -3.7, Math.PI, w, 6);
    b.pop();
  }
  // 奥の大きな岩山（高さ 100m）。道からはなして
  const mt = away(track, ...Object.values(worldAt(track, S.batuCaves.at)), 70);
  for (let j = 0; j < 7; j++) {
    const a = j * 0.9;
    b.cyl(14 + (j % 3) * 8, 40 + (j % 2) * 12, 70 + (j % 3) * 18, 7, j % 2 ? ROCK : 0x7a7468, mt.x + Math.cos(a) * 30, 0, mt.z + Math.sin(a) * 30);
  }
  // 金色の像（ムルガン像。高さ 43m: 台・体・頭・右手のやり）
  const st = away(track, ...Object.values(worldAt(track, S.muruganStatue.at)), 24);
  landmark(g, 'muruganStatue', st.x, 0, st.z);
  const face = Math.atan2(bc.x - st.x, bc.z - st.z) + Math.PI; // 道の方を向く
  glow.push(st.x, 0, st.z, face + Math.PI);
  b.push(st.x, 0, st.z, face + Math.PI);
  b.box(14, 6, 14, 0xa8a090, 0, 0, 0); // 台
  glow.cyl(5, 7, 20, 10, GOLD, 0, 6, 0); // 体（着物のすそ）
  glow.cyl(4, 5, 10, 10, GOLD, 0, 26, 0); // 胸
  glow.sphere(3.2, GOLD, 0, 39, 0, 10); // 頭
  glow.cyl(0, 2.8, 5, 8, GOLD, 0, 41, 0); // 冠
  glow.rod(4.5, 32, 0, 6.5, 26, 3, 1, GOLD); // 右うで
  b.rod(7.5, 6, 3.5, 7.5, 49, 3.5, 0.35, 0xb08a2a, 4); // やり
  glow.cyl(0, 1.2, 3, 4, GOLD, 7.5, 49, 3.5);
  b.pop();
  glow.pop();
  // 虹色の階段（2026-10-21 のユーザー依頼「洞窟前にカラフルな階段を設置し、ジャンプ台で一気に飛び越える」）:
  // ジャンプ（BJ〜BCL）の下の道の上に、洞窟の入口の高さまで上る階段。赤・橙・黄・緑・青・紫の帯
  const COLORS = [0xe8403a, 0xf08a2a, 0xf0d23a, 0x4ab04a, 0x3a7ae0, 0x8a4ac8];
  {
    const s0 = sOf(track, 'BJ') + 6;
    const s1 = sOf(track, 'BCL');
    const top = pointAt(track, s1).y;
    let j = 0;
    for (let s = s0; s < s1; s += 1.5, j++) {
      const p = pointAt(track, s);
      const h = Math.max(0.3, (top * (s - s0)) / (s1 - s0) - 0.6); // 飛ぶ道すじより低く
      b.push(p.x, 0, p.z, ryAlong(p.h));
      b.box(2 * p.half + 2, h, 1.6, COLORS[j % COLORS.length], 0, 0, 0);
      b.pop();
    }
    const sm = pointAt(track, (s0 + s1) / 2);
    landmark(g, 'rainbowStairs', sm.x, 0, sm.z);
  }

  // ---- ペトロナスツインタワー: 8角を段々に細く、銀色に光る窓のしま。2本の間に空中の橋。ゴールはその前 ----
  // ゴールはツインタワーの2本の間（2026-10-21 のユーザー依頼）: ゴールの道の両がわに1本ずつ。空中の橋の下をくぐってゴール
  const fin = pointAt(track, sOf(track, 'FIN'));
  const H = 380;
  const pc = { x: fin.x, z: fin.z };
  landmark(g, 'petronas', pc.x, 0, pc.z);
  const twin = [-1, 1].map((sd) => beside(fin, sd * (fin.wall + 35)));
  landmark(g, 'petronasA', twin[0].x, 0, twin[0].z);
  landmark(g, 'petronasB', twin[1].x, 0, twin[1].z);
  for (const c of twin) {
    const levels = [[0, 0.55, 20], [0.55, 0.7, 17], [0.7, 0.8, 14], [0.8, 0.87, 11], [0.87, 0.92, 8]];
    for (const [a0, a1, r] of levels) {
      b.cyl(r, r, (a1 - a0) * H, 8, SILVER, c.x, a0 * H, c.z);
      for (let y = a0 * H + 3; y < a1 * H - 1; y += 6) glow.cyl(r + 0.25, r + 0.25, 1.2, 8, 0xd8ecff, c.x, y, c.z, true); // 窓のしま
    }
    b.cyl(5, 7, 0.04 * H, 8, SILVER, c.x, 0.92 * H, c.z);
    glow.rod(c.x, 0.96 * H, c.z, c.x, H + 40, c.z, 0.8, 0xeef4ff); // とがった先
  }
  // 空中の橋（高さ 170m の2階建て）と、それを支える足
  const [ta, tb] = twin;
  b.rod(ta.x, 170, ta.z, tb.x, 170, tb.z, 2.6, 0x9aa0a8, 4);
  b.rod(ta.x, 174, ta.z, tb.x, 174, tb.z, 2.6, 0x9aa0a8, 4);
  const mid = { x: (ta.x + tb.x) / 2, z: (ta.z + tb.z) / 2 };
  for (const c of twin) b.rod((c.x + mid.x) / 2, 120, (c.z + mid.z) / 2, mid.x, 168, mid.z, 0.9, 0x9aa0a8, 4);
  // まわりの高層ビル（夜の窓）
  for (const at of S.skyline) {
    const w = worldAt(track, at);
    const p = away(track, w.x, w.z, 30);
    if (twin.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 60)) continue;
    tower(b, p.x, p.z, 0, 30, 30, 120 + ((Math.abs(at[0]) * 3) % 90), 0x3a3448, { glow, win: WIN });
  }

  // クアラルンプールの街の高層ビル（道ぞいに、夜の窓。2026-10-21 のユーザー依頼「殺風景」）
  {
    let n = 0;
    along(track, 'M', 'END', 45, (p) => {
      if (p.ghost || p.auto) return;
      for (const side of [-1, 1]) {
        n++;
        const c = beside(p, side * (p.wall + 26));
        if (!clear(track, c.x, c.z, 20) || twin.some((t2) => Math.hypot(t2.x - c.x, t2.z - c.z) < 60)) continue;
        tower(b, c.x, c.z, ryAlong(p.h), 26, 26, 90 + ((n * 37) % 140), [0x3a3448, 0x2e3a4a, 0x48405a][n % 3], { glow, win: n % 2 ? WIN : 0xbfe6ff });
        landmark(g, 'klTower', c.x, 0, c.z);
      }
    });
  }

  // ゴールは、ツインタワーの空中の橋の下を飛びぬける。地面の門は置かない（ストッパーに見えた。2026-10-21 のユーザー依頼）。
  // FINISH の大きな幕は、空中の橋に（走ってくる方と、その反対の両方へ）
  {
    const [ta, tb] = twin;
    const mx = (ta.x + tb.x) / 2;
    const mz = (ta.z + tb.z) / 2;
    const ry = Math.atan2(tb.x - ta.x, tb.z - ta.z) + Math.PI / 2; // 幕の面は、走る向きに向く
    const span = Math.hypot(tb.x - ta.x, tb.z - ta.z) - 30;
    b.push(mx, 0, mz, ry);
    b.box(span, 14, 0.6, 0xffffff, 0, 152, 0);
    for (const sd of [-1, 1]) b.label(textSign('FINISH', { bg: '#ffffff', fg: '#111111', font: 'bold 110px sans-serif' }), [768, 192], 0, 159, sd * 0.4, sd > 0 ? 0 : Math.PI, span - 2, 12);
    for (let k = 0; k < 12; k++) b.box(span / 12, 2, 0.7, k % 2 ? 0x111111 : 0xffffff, -span / 2 + (k + 0.5) * (span / 12), 150, 0); // 白黒のしま
    b.pop();
    landmark(g, 'finishBanner', mx, 159, mz);
  }
  // ゴールライン（道を横切る白黒の線。2026-10-21 のユーザー依頼）
  {
    b.push(fin.x, fin.y, fin.z, ryAlong(fin.h));
    const n = Math.round(fin.half);
    for (let row = 0; row < 2; row++) for (let k = -n; k < n; k++) b.box(1, 0.03, 1, (k + row) % 2 ? 0x111111 : 0xffffff, k + 0.5, 0.005, row - 0.5);
    b.pop();
    landmark(g, 'finishLine', fin.x, fin.y, fin.z);
  }
  // 最後の大ジャンプ台（オレンジと黄色の光る矢印、赤白の柱）
  {
    const r0 = sOf(track, 'R0');
    const gj = sOf(track, 'GJ');
    // ジャンプ台の下の台（高いジャンプ台が宙に浮いて見えないように）と、光る矢印（階段に見えないように。src/render/world/kit.js）
    buildRampDeck(b, glow, track, r0, gj);
    for (const s of [r0, gj]) {
      const p = pointAt(track, s);
      for (const side of [-1, 1]) {
        const c = beside(p, side * (p.wall + 1));
        for (let k = 0; k < 6; k++) b.cyl(0.8, 0.8, 2, 8, k % 2 ? 0xffffff : 0xe0251c, c.x, p.y + k * 2, c.z);
      }
    }
    const jm = pointAt(track, (r0 + gj) / 2);
    landmark(g, 'goalJump', jm.x, jm.y, jm.z);
  }

  // 道ぞいの街灯（夕方の明かり）
  for (const c of klLampSpots(track)) {
    b.cyl(0.2, 0.25, 7, 6, 0x4a4a52, c.x, c.y, c.z);
    glow.sphere(0.7, 0xffe6a8, c.x, c.y + 7.2, c.z, 6);
  }

  g.add(b.build(), glow.build());
  return root;
}

// 道ぞいの街灯の場所（40m ごと、両わき）。地面の高さの道だけ: ジャンプ台の坂・空中の区間（自動の区間）・高い所の洞窟には立てない
// （ゴール直前に空中にライトが浮かんでいた。2026-10-22 のユーザー依頼）
export function klLampSpots(track) {
  const out = [];
  along(track, 'KL', 'END', 40, (p, s) => {
    const q = track.samples[Math.round(s) % track.length];
    if (p.tunnel || p.tunnelLook || q.tunnel || q.auto || q.y === null || Math.abs(p.y) > 0.5) return;
    for (const side of [-1, 1]) {
      const c = beside(p, side * (p.wall + 1.5));
      const lc = locate(track, c.x, c.z, null, 40);
      if (Math.abs(lc.lateral) < lc.wall + 1) continue; // ほかの道（ゴールのあとの周回の道）の上には立てない
      out.push({ x: c.x, y: p.y, z: c.z, s });
    }
  });
  return out;
}
