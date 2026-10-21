// 川と滝（Soki Forest。2026-10-16 のユーザー依頼「川をジャンプで2回飛び越える」「ジャンプ②の手前に滝、川に合流」）
import * as THREE from '../../../vendor/three.module.min.js?v=fd408eb';
import { createBuilder } from '../town/builder.js?v=fd408eb';
import { markS } from '../../game/track.js?v=fd408eb';
import { terrainHeight } from '../terrain.js?v=fd408eb';

const WATER = 0x4f9fd6;
const FALLS = 0xbfe6ff; // 滝の水（白っぽい水色）
const RIVER_HALF = 8; // 川の半分の幅（m）
const RIVER_Y = -1.2; // 水の高さ（m）
const ROCK = [0x8d8d8d, 0x7b7b7b, 0x9b9a96];
const CLIFF = [0xa08868, 0xa6a59e, 0x937c60];

// 線（コースの座標）を step m ごとの点にする
function densify(line, step) {
  const out = [];
  for (let k = 0; k + 1 < line.length; k++) {
    const a = line[k];
    const b = line[k + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step));
    for (let u = 0; u < n; u++) out.push({ x: a.x + ((b.x - a.x) * u) / n, z: a.z + ((b.z - a.z) * u) / n });
  }
  out.push(line[line.length - 1]);
  return out;
}

// 線に沿った帯（幅 2×half）。yOf(x, z) で高さ
function strip(pts, half, yOf, color, opts = {}) {
  const pos = [];
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k];
    const b = pts[k + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = -(b.z - a.z) / len;
    const nz = (b.x - a.x) / len;
    const a1 = [a.x + nx * half, yOf(a.x, a.z), a.z + nz * half];
    const a2 = [a.x - nx * half, yOf(a.x, a.z), a.z - nz * half];
    const b1 = [b.x + nx * half, yOf(b.x, b.z), b.z + nz * half];
    const b2 = [b.x - nx * half, yOf(b.x, b.z), b.z - nz * half];
    pos.push(...a1, ...b1, ...a2, ...a2, ...b1, ...b2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, ...opts }));
}

// 川: 水の帯と、両岸の石
export function buildRiver(track) {
  const group = new THREE.Group();
  const line = (track.def.river ?? []).map(([x, z]) => track.toWorld(x, z));
  if (line.length < 2) return group;
  const pts = densify(line, 4);
  group.add(strip(pts, RIVER_HALF, () => RIVER_Y, WATER));
  const b = createBuilder();
  // 雪山（Kyugo Mountain）: 岸は雪の白、水の上に水色の氷の板（ところどころ）
  const snow = track.def.theme === 'snow';
  if (snow) {
    pts.forEach((p, k) => {
      if (k % 4 || k + 1 >= pts.length || (k * 7) % 3 === 0) return;
      const q = pts[k + 1];
      const len = Math.hypot(q.x - p.x, q.z - p.z) || 1;
      const off = (((k * 11) % 9) - 4) * 1.2;
      const x = p.x - ((q.z - p.z) / len) * off;
      const z = p.z + ((q.x - p.x) / len) * off;
      b.box(3 + (k % 3), 0.12, 2.2 + (k % 2), 0xcfeeff, x, RIVER_Y, z, k * 0.9);
    });
  }
  pts.forEach((p, k) => {
    if (k % 3 || k + 1 >= pts.length) return;
    const q = pts[k + 1];
    const len = Math.hypot(q.x - p.x, q.z - p.z) || 1;
    for (const side of [-1, 1]) {
      const off = RIVER_HALF - 1 + ((k * 7) % 3);
      const x = p.x - ((q.z - p.z) / len) * side * off;
      const z = p.z + ((q.x - p.x) / len) * side * off;
      if (onRoad(track, x, z)) continue;
      const s = 1.2 + ((k * 13 + side) % 4) * 0.4;
      b.box(s * 1.4, s * 0.8, s, snow ? 0xeef3f8 : ROCK[(k + side + 3) % 3], x, terrainHeight(track, x, z) - 0.4, z, k * 0.7);
    }
  });
  group.add(b.build());
  return group;
}

const onRoad = (track, x, z) => track.samples.some((p) => p.y !== null && Math.hypot(p.x - x, p.z - z) < p.wall + 2);

// 滝: 道の外のがけと、上から落ちる水、下のしぶき、川（ジャンプ②）へ向かう細い流れ
export function buildWaterfall(track) {
  const group = new THREE.Group();
  const wf = track.def.waterfall;
  if (!wf) return group;
  const s0 = markS(track, wf.at);
  const p = track.samples[Math.round(s0) % track.length];
  const rx = -Math.sin(p.h) * wf.side;
  const rz = Math.cos(p.h) * wf.side;
  const ry = Math.PI / 2 - p.h; // 走る向きを +z に
  const face = p.wall + 19; // がけの道がわの面（道の真ん中から m）
  const cx = p.x + rx * (face + 7);
  const cz = p.z + rz * (face + 7);
  const base = terrainHeight(track, p.x + rx * face, p.z + rz * face);
  const top = base + wf.height;
  // がけ: 茶色と灰色の箱を重ねる
  const b = createBuilder();
  b.push(cx, base - 0.5, cz, ry);
  // 滝のはば W（2026-10-16 のユーザー依頼「滝を大きく」）。がけは、そのまわりに
  const W = wf.width ?? 8;
  const L = W + 26; // がけの長さ（道ぞい）
  b.box(14, wf.height + 0.5, L, CLIFF[0], 0, 0, 0);
  b.box(12, wf.height + 2.5, 12, CLIFF[1], 1, 0, -(W / 2 + 7));
  b.box(12, wf.height + 1.5, 12, CLIFF[2], 1, 0, W / 2 + 7);
  b.box(10, 3, L - 4, CLIFF[1], 2, wf.height + 0.5, 0);
  b.pop();
  group.add(b.build());
  // 落ちる水（がけの面に沿った縦の板）
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(W, wf.height + 0.6), new THREE.MeshBasicMaterial({ color: FALLS, side: THREE.DoubleSide }));
  fall.position.set(p.x + rx * (face - 0.2), (base + top) / 2, p.z + rz * (face - 0.2));
  fall.rotation.y = -p.h; // 板の面を道と平行に（道から見える）
  group.add(fall);
  // しぶき: 白い半透明の板を、ゆっくり上下させる
  const mist = new THREE.Mesh(new THREE.BoxGeometry(W + 6, 4, 9), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }));
  const mx = p.x + rx * (face - 2);
  const mz = p.z + rz * (face - 2);
  mist.position.set(mx, base + 1.2, mz);
  mist.rotation.y = -p.h;
  mist.onBeforeRender = () => {
    mist.position.y = base + 1.2 + 0.4 * Math.sin(performance.now() / 600);
  };
  group.add(mist);
  // 滝の下から、道に沿ってジャンプ②の川へ流れる細い流れ
  const j2 = markS(track, ['J2', 'J2', 0]);
  const pts = [];
  const off = p.wall + 14;
  for (let s = s0; s <= j2 - 4; s += 3) {
    const q = track.samples[Math.round(s) % track.length];
    const qx = -Math.sin(q.h) * wf.side;
    const qz = Math.cos(q.h) * wf.side;
    pts.push({ x: q.x + qx * off, z: q.z + qz * off });
  }
  pts.unshift({ x: p.x + rx * (face - 2), z: p.z + rz * (face - 2) });
  const river = (track.def.river ?? []).map(([x, z]) => track.toWorld(x, z));
  if (river.length) {
    // 川のいちばん近い点まで
    const last = pts[pts.length - 1];
    const near = river.reduce((m, r) => (Math.hypot(r.x - last.x, r.z - last.z) < Math.hypot(m.x - last.x, m.z - last.z) ? r : m));
    pts.push(near);
  }
  group.add(strip(pts, 3.5, (x, z) => terrainHeight(track, x, z) + 0.05, WATER)); // 大きな滝なので、流れも少し太く
  return group;
}
