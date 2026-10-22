// コースの見た目: 道（白線）、縁石、ダート、柵、ジャンプ台、加速板、スタートライン、観客席、木と看板
import * as THREE from '../../vendor/three.module.min.js?v=3562af2';
import { buildScenery, stubMouths, inMouth } from './town/scenery.js?v=3562af2';
import { buildJungle } from './town/jungle.js?v=3562af2';
import { buildWater } from './town/water.js?v=3562af2';
import { buildBridge } from './forest/bridge.js?v=3562af2';
import { buildTunnel } from './snow/tunnel.js?v=3562af2';
import { buildSnowScenery } from './snow/kit.js?v=3562af2';
import { buildSigns } from './snow/signs.js?v=3562af2';
import { buildTokyo } from './world/tokyo.js?v=3562af2';
import { buildFuji } from './world/fuji.js?v=3562af2';
import { buildKyoto } from './world/kyoto.js?v=3562af2';
import { buildSpace, buildLaunchRail } from './world/space.js?v=3562af2';
import { buildHongKong } from './world/hongkong.js?v=3562af2';
import { buildSea } from './world/sea.js?v=3562af2';
import { buildNewYork } from './world/newyork.js?v=3562af2';
import { buildWarp } from './world/warp.js?v=3562af2';
import { buildKL } from './world/kl.js?v=3562af2';
import { buildClouds } from './world/clouds.js?v=3562af2';
import * as forestKit from './forest/kit.js?v=3562af2';
import { createBuilder } from './town/builder.js?v=3562af2';
import { buildRiver, buildWaterfall } from './forest/water.js?v=3562af2';
import { buildTerrain, terrainHeight, GAP_DROP } from './terrain.js?v=3562af2';
import { mergeMeshes } from './mergeMeshes.js?v=3562af2';
import { BUMP_STRIPE_M } from '../game/hazards.js?v=3562af2';
import { cornerUW, markS, GRIP_ICE, stageAt } from '../game/track.js?v=3562af2';

const COLORS = {
  dirt: 0xb08850,
  red: 0xd8262b,
  white: 0xffffff,
};

// 幅などは、数か、点ごとの関数（ロータリーで道が広がる所など）
const at = (o, p) => (typeof o === 'function' ? o(p) : o);

// 右向きのベクトル（右が正）
function rightOf(p) {
  return [-Math.sin(p.h), Math.cos(p.h)];
}

function mesh(pos, { color, colors, uv, map } = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const m = new THREE.MeshLambertMaterial({ color, map, vertexColors: Boolean(colors), side: THREE.DoubleSide });
  return new THREE.Mesh(g, m);
}

// となり合う点どうしを四角でつないだ、地面に平らな帯。ok(p) が false の点はつながない
// colorOf があれば四角ごとの色、vScale があれば模様を貼る（縦は vScale m ごとにくり返す）
function ribbon(samples, offA, offB, yOf, ok, { color, colorOf, map, vScale } = {}) {
  const pos = [];
  const colors = colorOf ? [] : null;
  const uv = map ? [] : null;
  const c = new THREE.Color();
  const n = samples.length;
  for (let i = 0; i < n; i++) {
    const p = samples[i];
    const q = samples[p.next ?? (i + 1) % n]; // 分かれ道は、点のつながりの次の点と（番号の次ではなく）
    if (!ok(p) || !ok(q)) continue;
    const [rpx, rpz] = rightOf(p);
    const [rqx, rqz] = rightOf(q);
    const a = [p.x + rpx * at(offA, p), yOf(p), p.z + rpz * at(offA, p)];
    const b = [p.x + rpx * at(offB, p), yOf(p), p.z + rpz * at(offB, p)];
    const cc = [q.x + rqx * at(offA, q), yOf(q), q.z + rqz * at(offA, q)];
    const d = [q.x + rqx * at(offB, q), yOf(q), q.z + rqz * at(offB, q)];
    pos.push(...a, ...cc, ...b, ...b, ...cc, ...d);
    if (colors) {
      c.setHex(colorOf(p));
      for (let k = 0; k < 6; k++) colors.push(c.r, c.g, c.b);
    }
    if (uv) {
      const v0 = p.s / vScale;
      const v1 = v0 + (q.s > p.s ? q.s - p.s : 1) / vScale;
      uv.push(0, v0, 0, v1, 1, v0, 1, v0, 0, v1, 1, v1);
    }
  }
  return mesh(pos, { color, colors, uv, map });
}

// 道の横に立つ縦の板（柵やジャンプ台の側面）
function fence(samples, off, yBottom, yTop, ok, colorOf) {
  const pos = [];
  const col = [];
  const n = samples.length;
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const p = samples[i];
    const q = samples[p.next ?? (i + 1) % n];
    if (!ok(p) || !ok(q)) continue;
    const [rpx, rpz] = rightOf(p);
    const [rqx, rqz] = rightOf(q);
    const px = p.x + rpx * at(off, p);
    const pz = p.z + rpz * at(off, p);
    const qx = q.x + rqx * at(off, q);
    const qz = q.z + rqz * at(off, q);
    pos.push(px, yBottom(p), pz, qx, yBottom(q), qz, px, yTop(p), pz);
    pos.push(px, yTop(p), pz, qx, yBottom(q), qz, qx, yTop(q), qz);
    c.setHex(colorOf(p));
    for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
  }
  return mesh(pos, { colors: col });
}

function canvasTexture(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// 進む方向（前）を指す矢印の模様。前は模様の上（v が大きい方）
function chevrons(bg, fg) {
  return canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    for (let k = 0; k < 2; k++) {
      const y0 = k * 32;
      g.beginPath();
      g.moveTo(8, y0 + 28);
      g.lineTo(w / 2, y0 + 4);
      g.lineTo(w - 8, y0 + 28);
      g.lineTo(w - 20, y0 + 28);
      g.lineTo(w / 2, y0 + 14);
      g.lineTo(20, y0 + 28);
      g.fill();
    }
  });
}

// 雪山の橋の板と手すり（Kyugo Mountain）: 坂にそった、なめらかな形（2026-10-18 のユーザー依頼「階段のように見える」）
export function bridgeSlab(track) {
  const g = new THREE.Group();
  const { samples } = track;
  const ok = (p) => p.bridge && p.y !== null;
  const STONE = 0xb8bec6;
  const outer = (p) => p.wall + 0.6;
  g.add(ribbon(samples, (p) => -outer(p), outer, (p) => p.y - 1.4, ok, { color: STONE })); // 板の裏
  for (const side of [-1, 1]) {
    g.add(fence(samples, (p) => side * p.wall, (p) => p.y - 1.4, (p) => p.y + 1.0, ok, () => STONE)); // 手すりの内がわ
    g.add(fence(samples, (p) => side * outer(p), (p) => p.y - 1.4, (p) => p.y + 1.0, ok, () => STONE)); // 外がわ
    const [a, b] = side < 0 ? [(p) => -outer(p), (p) => -p.wall] : [(p) => p.wall, outer];
    g.add(ribbon(samples, a, b, (p) => p.y + 1.0, ok, { color: 0xf4f7fb })); // 手すりの上の雪
  }
  return g;
}

// うしろを指す矢印の模様（スローの板。Kyugo Mountain）。模様の下（v が小さい方）を指す
function backArrows(bg, fg) {
  return canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    for (let k = 0; k < 2; k++) {
      const y0 = k * 32;
      g.beginPath();
      g.moveTo(8, y0 + 4);
      g.lineTo(w / 2, y0 + 28);
      g.lineTo(w - 8, y0 + 4);
      g.lineTo(w - 20, y0 + 4);
      g.lineTo(w / 2, y0 + 18);
      g.lineTo(20, y0 + 4);
      g.fill();
    }
  });
}

// スローの板（Kyugo Mountain）: 本線の点 from から 30 点、道の真ん中から lateral ± half の帯
function slowPad(track, sl, material) {
  const pos = [];
  const uv = [];
  for (let k = 0; k < 30; k++) {
    const p = track.samples[(sl.from + k) % track.length];
    const q = track.samples[(sl.from + k + 1) % track.length];
    const [rpx, rpz] = rightOf(p);
    const [rqx, rqz] = rightOf(q);
    const lo = sl.lateral - sl.half;
    const hi = sl.lateral + sl.half;
    const a = [p.x + rpx * lo, p.y + 0.05, p.z + rpz * lo];
    const b = [p.x + rpx * hi, p.y + 0.05, p.z + rpz * hi];
    const c = [q.x + rqx * lo, q.y + 0.05, q.z + rqz * lo];
    const d = [q.x + rqx * hi, q.y + 0.05, q.z + rqz * hi];
    const v0 = k / 3;
    const v1 = (k + 1) / 3;
    pos.push(...a, ...b, ...c, ...b, ...d, ...c);
    uv.push(0, v0, 1, v0, 0, v1, 1, v0, 1, v1, 0, v1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return new THREE.Mesh(g, material);
}

// コースを横切る板（スタートライン、加速板、ジャンプ台の模様）。from〜to は s（m）。tiles は模様をくり返す回数
// side が 1 なら道の右半分（分離帯の外）だけ、-1 なら左半分だけ
export function strip(track, from, to, y, material, tiles = 1, side = 0) {
  const { samples } = track;
  const pos = [];
  const uv = [];
  // 本線の点だけ（分かれ道の点も、本線でいうと同じ s を持つので）
  const list = samples.slice(0, track.length).filter((p) => p.s >= from && p.s < to);
  const w = (p) => p.half ?? track.roadHalf;
  // 板の左はし・右はし（右が正）
  const lo = (p) => (side > 0 ? p.median || 0 : -w(p));
  const hi = (p) => (side < 0 ? -(p.median || 0) : w(p));
  for (let k = 0; k + 1 < list.length; k++) {
    const p = list[k];
    const q = list[k + 1];
    const [rpx, rpz] = rightOf(p);
    const [rqx, rqz] = rightOf(q);
    const v0 = (k / (list.length - 1)) * tiles;
    const v1 = ((k + 1) / (list.length - 1)) * tiles;
    const a = [p.x + rpx * lo(p), y(p), p.z + rpz * lo(p)];
    const b = [p.x + rpx * hi(p), y(p), p.z + rpz * hi(p)];
    const c = [q.x + rqx * lo(q), y(q), q.z + rqz * lo(q)];
    const d = [q.x + rqx * hi(q), y(q), q.z + rqz * hi(q)];
    // 表が上を向く並び（上から見える）
    pos.push(...a, ...b, ...c, ...b, ...d, ...c);
    uv.push(0, v0, 1, v0, 0, v1, 1, v0, 1, v1, 0, v1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return new THREE.Mesh(g, material);
}

// 点 (x, z) がコースの線で囲まれた内側にあるか（線を横切る回数が奇数なら内側）
function insideLoop(samples, x, z) {
  let inside = false;
  for (let i = 0, j = samples.length - 1; i < samples.length; j = i++) {
    const a = samples[i];
    const b = samples[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

// 点 (x, z) からコースの中心線までの一番近い距離
function distToTrack(samples, x, z) {
  let d = Infinity;
  for (const p of samples) d = Math.min(d, (p.x - x) ** 2 + (p.z - z) ** 2);
  return Math.sqrt(d);
}

// 観客席の向き（コースの外側）と、真ん中の場所。音（歓声）でも使う
function grandstandFrame(track) {
  // 置く場所を決めたコース（Kyugo Mountain: 観客席の前の印の、左がわ。2026-10-18）
  const gs = track.def.grandstand;
  const p = gs ? track.samples[Math.round(markS(track, [gs.at, gs.at, 0])) % track.length] : track.samples[track.startIndex];
  const base = p.wall + 4;
  const [r0x, r0z] = rightOf(p);
  const side = gs ? gs.side : insideLoop(track.samples, p.x + r0x * (base + 6), p.z + r0z * (base + 6)) ? -1 : 1;
  return { p, base, rx: r0x * side, rz: r0z * side };
}

export function grandstandSpot(track) {
  const { p, base, rx, rz } = grandstandFrame(track);
  const mid = base + 9; // 10段（2m ずつ）の真ん中
  return { x: p.x + rx * mid, z: p.z + rz * mid };
}

// スタートラインの横（コースの外側、柵の外）に、段になった観客席と観客
function grandstand(track) {
  const group = new THREE.Group();
  const { p, base, rx, rz } = grandstandFrame(track);
  const length = 50;
  const steps = 10; // 段の数（マリオカート64 のように高い観客席）
  const snowy = track.def.theme === 'snow';
  const stand = new THREE.MeshLambertMaterial({ color: snowy ? 0xb9c2cc : 0x9aa3ad });
  for (let k = 0; k < steps; k++) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(length, 1 + k * 1.2, 2), stand);
    const d = base + k * 2;
    box.position.set(p.x + rx * d, (1 + k * 1.2) / 2, p.z + rz * d);
    box.rotation.y = -p.h;
    group.add(box);
  }
  // 雪山: 段のうしろの一番上と両はしに、雪（白い板）
  if (snowy) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(length + 0.4, 0.3, 2.2), new THREE.MeshLambertMaterial({ color: 0xf4f7fb }));
    const d = base + (steps - 1) * 2;
    cap.position.set(p.x + rx * d, 1 + (steps - 1) * 1.2 + 0.15, p.z + rz * d);
    cap.rotation.y = -p.h;
    group.add(cap);
  }
  // 道の高さ（Kyugo Mountain の観客席の前は 4m）。下の地面まで、土台でうめる
  if (p.y) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(length, p.y + 0.2, steps * 2 + 2), stand);
    const d = base + (steps - 1);
    foot.position.set(p.x + rx * d, -p.y / 2, p.z + rz * d);
    foot.rotation.y = -p.h;
    group.add(foot);
  }
  group.position.y = p.y ?? 0;
  const perRow = 40;
  const people = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 1, 0.6), new THREE.MeshLambertMaterial(), steps * perRow);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  const palette = [0xe63946, 0xf1c453, 0x2a9d8f, 0x457b9d, 0xffffff, 0xf4a261, 0x9b5de5];
  let idx = 0;
  for (let k = 0; k < steps; k++) {
    for (let j = 0; j < perRow; j++) {
      const along = -length / 2 + 0.6 + j * ((length - 1.2) / (perRow - 1));
      const d = base + k * 2;
      const x = p.x + rx * d + Math.cos(p.h) * along;
      const z = p.z + rz * d + Math.sin(p.h) * along;
      m.makeTranslation(x, 1 + k * 1.2 + 0.5, z);
      people.setMatrixAt(idx, m);
      people.setColorAt(idx, c.setHex(palette[(k * 7 + j * 3) % palette.length]));
      idx++;
    }
  }
  group.add(people);
  return group;
}

// コースの点を、CELL m ごとのます目に分けておき、点 (x, z) から r m 以内の点だけを調べる（読み込みを速くする）
const CELL = 20;
function nearIndex(samples) {
  const grid = new Map();
  samples.forEach((p, i) => {
    const key = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(i);
  });
  // (x, z) から r 以内にある点の番号を、ひとつずつ test に渡す。test が true を返したらそこで止めて true
  return (x, z, r, test) => {
    const span = Math.ceil(r / CELL);
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    for (let gx = cx - span; gx <= cx + span; gx++) {
      for (let gz = cz - span; gz <= cz + span; gz++) {
        for (const j of grid.get(`${gx},${gz}`) ?? []) if (test(j)) return true;
      }
    }
    return false;
  };
}

// 柵を立てられるか（点 i の左右 -1 / 1）。地面がある平らな所で、柵の位置がほかの道の舗装（＋1m）の上でなければ立てる
// （交わる所の近くでも、下を通る道をふさがない所には柵を描く。ジャンプの着地の所も囲む）
// 合流の手前の、進む向きの白い矢印（地面にかいた白線）。合流する所の MERGE_ARROWS m 手前に1つずつ
export const MERGE_ARROWS = [15, 30, 45];
export function mergeArrowSpots(track) {
  const { samples } = track;
  const out = [];
  const defs = track.def.branches ?? [];
  for (const path of (track.paths ?? []).slice(1)) {
    // 高速道路のような合流（横に並んでから1本になる）は、並び始める所の手前に（矢印どうしが重ならないように）
    const lead = defs.find((b) => b.id === path.id)?.merge ?? 0;
    for (const d0 of MERGE_ARROWS) {
      const d = d0 + lead;
      // 分かれ道の上（合流する所から d m 手前）
      const k = path.count - Math.round(d / (path.len / path.count));
      if (k >= 0) out.push(samples[path.start + k]);
      // 本線の上（合流する所から d m 手前）
      out.push(samples[(path.join - d + track.length) % track.length]);
    }
  }
  // スローの板（Kyugo Mountain）の上には置かない（板の矢印と重なる。2026-10-18 のユーザー依頼）
  const n = track.length;
  const onSlow = (p) => p.path === 0 && (track.slows ?? []).some((sl) => (track.samples.indexOf(p) - sl.from + 4 + n) % n < 38);
  return out.filter((p) => p && p.y !== null && !onSlow(p));
}
function mergeArrows(track) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  // 前（+x）を向いた矢印（長さ 8m、はば 4m）
  shape.moveTo(-4, -0.6);
  shape.lineTo(1.2, -0.6);
  shape.lineTo(1.2, -2);
  shape.lineTo(4, 0);
  shape.lineTo(1.2, 2);
  shape.lineTo(1.2, 0.6);
  shape.lineTo(-4, 0.6);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const p of mergeArrowSpots(track)) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(p.x, p.y + 0.08, p.z);
    m.rotation.y = -p.h; // 進む向きへ
    g.add(m);
  }
  return g;
}

// 点 p から横に lat m の所が、ほかの道（ほかの path、または同じ道の遠い所）の道の面の上か。高さが 3m 以上ちがう道（橋の上と下）は数えない
const otherRoadCache = new WeakMap();
export function onOtherRoad(track, p, lat) {
  if (!otherRoadCache.has(track)) otherRoadCache.set(track, nearIndex(track.samples));
  const near = otherRoadCache.get(track);
  const x = p.x - Math.sin(p.h) * lat;
  const z = p.z + Math.cos(p.h) * lat;
  return near(x, z, track.roadHalf + 2, (j) => {
    const q = track.samples[j];
    if (q.y === null || Math.abs(q.y - (p.y ?? 0)) >= 3) return false;
    const other = q.path !== p.path || Math.min(Math.abs(q.s - p.s), track.length - Math.abs(q.s - p.s)) >= 60;
    return other && Math.hypot(q.x - x, q.z - z) < q.half;
  });
}

// mouths: 通行止めの道の口（src/render/town/scenery.js の stubMouths）。口の前の壁はあける
export function fenceSides(track, mouths = []) {
  const { samples, roadHalf } = track;
  const n = samples.length;
  const near = nearIndex(samples);
  return samples.map((p, i) => {
    const ok = {};
    for (const side of [-1, 1]) {
      ok[side] = false;
      if (p.y === null || p.ramp) continue;
      const x = p.x - Math.sin(p.h) * side * p.wall;
      const z = p.z + Math.cos(p.h) * side * p.wall;
      if (mouths.some((m) => inMouth(m, x, z))) continue;
      ok[side] = !near(x, z, roadHalf + 1, (j) => {
        const q = samples[j];
        // ほかの道: 分かれ道どうし・本線と分かれ道（分かれる所・合流する所で道をふさがない）、同じ道の遠い所（60m 以上）
        const other = q.path !== p.path || Math.min(Math.abs(q.s - p.s), track.length - Math.abs(q.s - p.s)) >= 60;
        // 橋の上と下・らせんの段の上と下（高さが 3m 以上ちがう）は、ふさがないので柵を立てる
        // 雪山（柵を道の高さに立てる）は、橋の点の手前でも、高さが 3m 以上ちがえば別の道（2026-10-18: 橋に入る所で柵が切れて、落ちそうに見えた）。
        // Kenta Circuit の柵は地面から立てるので、上の道の柵が下の道の上に立たないよう、今のまま
        const separate = p.bridge || q.bridge || p.stacked || q.stacked || track.def.theme === 'snow';
        const overBridge = separate && Math.abs(q.y - (p.y ?? 0)) >= 3;
        return other && q.y !== null && !overBridge && Math.hypot(q.x - x, q.z - z) <= q.half + 1;
      });
    }
    return ok;
  });
}

// ジャンプの着地の道のはし（地面のない所のすぐ先の点）。本線だけ
export function landingEdges(track) {
  const out = [];
  for (let i = 0; i < track.length; i++) {
    const p = track.samples[i];
    if (p.y !== null && !p.tunnel && track.samples[p.prev].y === null) out.push(i);
  }
  return out;
}

// 着地の道のはしの崖と壁（2026-10-19 のユーザー依頼「着地するところがわかりにくい。崖をしっかり描いて」
// 「着地したところを逆走すると何もないのに進むことができない。壁をコースの切れ目に描いて」）
export const LANDING_WALL = 0.7; // 壁の高さ（m）
function landingCliffs(track) {
  const b = createBuilder();
  for (const i of landingEdges(track)) {
    const p = track.samples[i];
    const w = p.wall + 3;
    b.push(p.x, p.y, p.z, Math.PI / 2 - p.h); // 前（z）が道の向き、x が横
    b.box(2 * w, GAP_DROP + 4, 1, 0x7d756b, 0, -(GAP_DROP + 4) - 0.02, -0.5); // 岩の崖（道のはしから、下の地面まで）
    const n = Math.round(p.wall); // しまの数（1m ずつ）
    // 壁の面は、はしから 0.5m 先（地面のない所は、点と点のまん中から。逆走した車のうしろの端がここで止まる）
    for (let k = -n; k < n; k++) b.box(1, LANDING_WALL, 0.4, k % 2 ? 0xffd000 : 0x222222, k + 0.5, -0.02, -0.7);
    b.pop();
  }
  // 片道のコース（Global City）の道の終わり（すぐ先が無い道）: 前向きの、しまの低い壁
  for (let i = 0; i < track.length; i++) {
    const p = track.samples[i];
    if (p.y === null || p.void || !track.samples[p.next].void) continue;
    if (track.loopTo !== undefined) continue; // ゴールのあと周回するコースは、道の終わりに壁を置かない（ストッパーに見えた。2026-10-21 のユーザー依頼）
    b.push(p.x, p.y, p.z, Math.PI / 2 - p.h);
    const n = Math.round(p.wall);
    for (let k = -n; k < n; k++) b.box(1, LANDING_WALL, 0.4, k % 2 ? 0xffd000 : 0x222222, k + 0.5, -0.02, 0.7);
    b.pop();
  }
  return b.build();
}

// 点 p の柵の見た目（Global City の def.fenceStyles。範囲のない所は guard。あとに書いた範囲が勝つ）
function fenceStyleOf(track) {
  const ranges = (track.def.fenceStyles ?? []).map((f) => ({ from: refOf(track, f.from), to: refOf(track, f.to), style: f.style }));
  return (p) => {
    let style = 'guard';
    for (const r of ranges) if (p.path === 0 && p.s >= r.from && p.s <= r.to) style = r.style;
    return style;
  };
}
function refOf(track, ref) {
  return typeof ref === 'string' ? track.marks[ref] : markS(track, ref);
}

// 柵の外の高い土手（マリオカート64 のように、道の両側を高く囲む）。ほかの道・交わる所・観客席の前には作らない
export const BANK_FROM = 3; // 柵から土手のふもとまで（m）。間に看板を立てる
export const BANK_WIDTH = 14; // 土手の幅（m）
const BANK_HEIGHT = 7; // 土手の高さ（m）

// 点 i の左右（-1 / 1）に土手を作れるか
export function bankSides(track) {
  const { samples } = track;
  const n = samples.length;
  const start = samples[track.startIndex];
  const fences = fenceSides(track);
  const near = nearIndex(samples);
  const reach = Math.max(...samples.map((q) => q.wall)) + 1;
  // 点 (x, z) が、点 i から離れたほかの道（地面がない所も含む）の柵の内側にないか
  const clearOfOthers = (x, z, i) => !near(x, z, reach, (j) => {
    const gap = Math.min(Math.abs(i - j), n - Math.abs(i - j));
    const q = samples[j];
    return gap >= 80 && Math.hypot(q.x - x, q.z - z) <= q.wall + 1;
  });
  return samples.map((p, i) => {
    const ok = {};
    for (const side of [-1, 1]) {
      const [rx, rz] = rightOf(p);
      ok[side] = fences[i][side] && p.y === 0 && !p.ramp && Math.hypot(p.x - start.x, p.z - start.z) > 40;
      // 土手のふもと・真ん中・てっぺんが、ほかの道にかからない所だけ
      for (const off of [BANK_FROM, BANK_FROM + BANK_WIDTH / 2, BANK_FROM + BANK_WIDTH + 2]) {
        if (!ok[side]) break;
        const d = p.wall + off;
        ok[side] = clearOfOthers(p.x + rx * side * d, p.z + rz * side * d, i);
      }
    }
    return ok;
  });
}

// ふもと（高さ0）から上（高さ BANK_HEIGHT）へ上がる土手。明るい緑と濃い緑のしま（流れていくのが見える）
function bank(track, sides, side) {
  const { samples } = track;
  const pos = [];
  const col = [];
  const c = new THREE.Color();
  const n = samples.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (!sides[i][side] || !sides[j][side]) continue;
    const p = samples[i];
    const q = samples[j];
    const [rpx, rpz] = rightOf(p);
    const [rqx, rqz] = rightOf(q);
    const p0 = (p.wall + BANK_FROM) * side;
    const p1 = (p.wall + BANK_FROM + BANK_WIDTH) * side;
    const q0 = (q.wall + BANK_FROM) * side;
    const q1 = (q.wall + BANK_FROM + BANK_WIDTH) * side;
    const a = [p.x + rpx * p0, 0, p.z + rpz * p0];
    const b = [p.x + rpx * p1, BANK_HEIGHT, p.z + rpz * p1];
    const cc = [q.x + rqx * q0, 0, q.z + rqz * q0];
    const d = [q.x + rqx * q1, BANK_HEIGHT, q.z + rqz * q1];
    pos.push(...a, ...cc, ...b, ...b, ...cc, ...d);
    c.setHex(Math.floor(p.s / 4) % 2 ? 0x4f9a3f : 0x62b350);
    for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
  }
  return mesh(pos, { colors: col });
}

// 看板の場所（柵と土手の間）。i はどの点の横か
// ほかの道（ジャンプ台・飛び越える所・横の道）の上や、その柵のすぐ外（3m 以内）には立てない
// （ジャンプで飛ぶ道すじに看板が立っていた: 2026-10-15 の実機確認）
export function signSpots(track) {
  const { samples } = track;
  const n = samples.length;
  const start = samples[track.startIndex];
  const spots = [];
  for (let i = 0; i < n; i += 5) {
    const p = samples[i];
    if (p.y !== 0) continue;
    if (Math.hypot(p.x - start.x, p.z - start.z) < 45) continue;
    const [rx, rz] = rightOf(p);
    for (const side of [-1, 1]) {
      if ((i / 5 + (side > 0 ? 1 : 0)) % 4 !== 0) continue;
      const d = p.wall + 1.5;
      const x = p.x + rx * side * d;
      const z = p.z + rz * side * d;
      const onOtherRoad = samples.some((q, j) => {
        const dj = Math.min(Math.abs(j - i), n - Math.abs(j - i));
        return dj >= 60 && Math.hypot(q.x - x, q.z - z) < q.wall + 3;
      });
      if (!onOtherRoad) spots.push({ i, x, z, h: p.h });
    }
  }
  return spots;
}

// 木（土手の上、土手がない所は柵の外）と看板（柵と土手の間）。高く大きく（マリオカート64 のように）
function roadside(track, sides) {
  const { samples } = track;
  const start = samples[track.startIndex];
  const trees = [];
  const signs = signSpots(track);
  for (let i = 0; i < samples.length; i += 5) {
    const p = samples[i];
    if (p.y !== 0) continue;
    const [rx, rz] = rightOf(p);
    for (const side of [-1, 1]) {
      if (Math.hypot(p.x - start.x, p.z - start.z) < 45) continue;
      // 看板を立てる場所（立てなかった所も）には、木は植えない
      if ((i / 5 + (side > 0 ? 1 : 0)) % 4 === 0) continue;
      const onBank = sides[i][side];
      const d = onBank ? p.wall + BANK_FROM + BANK_WIDTH + 2 + ((i * 7) % 4) : p.wall + 3 + ((i * 7) % 3);
      const x = p.x + rx * side * d;
      const z = p.z + rz * side * d;
      if (distToTrack(samples, x, z) < p.wall + 2.5) continue;
      trees.push({ x, z, y: onBank ? BANK_HEIGHT : 0, s: 1.6 + ((i * 13) % 5) * 0.15 });
    }
  }
  const group = new THREE.Group();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.4, 2, 6), new THREE.MeshLambertMaterial({ color: 0x7a4b25 }), trees.length);
  const leaves = new THREE.InstancedMesh(new THREE.ConeGeometry(2.2, 5, 7), new THREE.MeshLambertMaterial({ color: 0x2f7d32 }), trees.length);
  trees.forEach((t, k) => {
    const sc = new THREE.Vector3(t.s, t.s, t.s);
    trunk.setMatrixAt(k, m.compose(new THREE.Vector3(t.x, t.y + 1 * t.s, t.z), q, sc));
    leaves.setMatrixAt(k, m.compose(new THREE.Vector3(t.x, t.y + 4.2 * t.s, t.z), q, sc));
  });
  const board = new THREE.InstancedMesh(new THREE.BoxGeometry(6, 3, 0.2), new THREE.MeshLambertMaterial(), signs.length);
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.15, 4, 5), new THREE.MeshLambertMaterial({ color: 0xdddddd }), signs.length);
  const c = new THREE.Color();
  const palette = [0xffd84a, 0x3fa9ff, 0xff5a5f, 0x7bd389];
  const up = new THREE.Vector3(0, 1, 0);
  signs.forEach((s, k) => {
    q.setFromAxisAngle(up, -s.h);
    board.setMatrixAt(k, m.compose(new THREE.Vector3(s.x, 5.2, s.z), q, one));
    board.setColorAt(k, c.setHex(palette[k % palette.length]));
    pole.setMatrixAt(k, m.makeTranslation(s.x, 2, s.z));
  });
  group.add(trunk, leaves, board, pole);
  return group;
}

// トンネルのあるコース（Kyugo Mountain の雪のトンネル、Global City の山の岩・海の底のガラス。2026-10-20）
// 道を描く点か: 無い道・自動の区間（Global City）の空の道すじは描かない。
// 自動の区間でも、地面の高さの所（輪っかの間 R1〜R3）は描く（道が消えて見えた。最後のレビュー）
export function roadDrawn(p) {
  return p.y !== null && !p.void && !p.ghost && !(p.auto && p.y > 0.5);
}

// 大きな形（コースぜんぶの道の帯など）を、三角の真ん中の場所で size m のます目ごとの形に切り分ける
function splitMesh(mesh, size = 250) {
  const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const names = Object.keys(geo.attributes);
  const pos = geo.attributes.position;
  const cells = new Map();
  for (let t = 0; t < pos.count; t += 3) {
    const cx = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3;
    const cz = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3;
    const key = `${Math.floor(cx / size)},${Math.floor(cz / size)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(t);
  }
  return [...cells.values()].map((tris) => {
    const g = new THREE.BufferGeometry();
    for (const n of names) {
      const a = geo.attributes[n];
      const out = new Float32Array(tris.length * 3 * a.itemSize);
      let o = 0;
      for (const t of tris) for (let v = 0; v < 3; v++) for (let c = 0; c < a.itemSize; c++) out[o++] = a.array[(t + v) * a.itemSize + c];
      g.setAttribute(n, new THREE.BufferAttribute(out, a.itemSize));
    }
    const m = new THREE.Mesh(g, mesh.material);
    m.renderOrder = mesh.renderOrder;
    m.userData = { ...mesh.userData };
    return m;
  });
}

// 形を、三角ごとに、いちばん近い道の点（高さもみる）のステージで分け、さらに size m のます目ごとに分ける（Global City）。
// 地図の上で重なる所（富士山の着地点の近くを通るニューヨークの道など）でも、その道のステージだけで見せる（2026-10-21 のユーザー依頼「途切れた道」）
// 道の点のステージ。スタートの後ろ（片道のコースの点の並びの最後、GB より先）は、スタートの東京（ステージ 0）
// （点の並びでは最後なので、クアラルンプールと数えて、東京でスタート地点の道が欠けた。2026-10-21 のユーザー依頼）
function sampleStage(track, p) {
  if (track.open && track.marks.GB !== undefined && p.s >= track.marks.GB) return 0;
  return stageAt(track, p.s);
}
const stageGrids = new WeakMap();
function stageGridOf(track) {
  if (!stageGrids.has(track)) {
    const grid = new Map();
    for (const p of track.samples) {
      if (p.y === null || p.void) continue;
      const key = `${Math.floor(p.x / 30)},${Math.floor(p.z / 30)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push({ x: p.x, y: p.y, z: p.z, st: sampleStage(track, p) });
    }
    stageGrids.set(track, grid);
  }
  return stageGrids.get(track);
}
export function splitByStage(mesh, track, size = 250) {
  const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const names = Object.keys(geo.attributes);
  const pos = geo.attributes.position;
  const grid = stageGridOf(track);
  const groups = new Map();
  for (let t = 0; t < pos.count; t += 3) {
    const cx = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3;
    const cy = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3;
    const cz = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3;
    const gx = Math.floor(cx / 30);
    const gz = Math.floor(cz / 30);
    let best = -1;
    let bd = Infinity;
    for (let ix = gx - 1; ix <= gx + 1; ix++) for (let iz = gz - 1; iz <= gz + 1; iz++) {
      for (const q of grid.get(`${ix},${iz}`) ?? []) {
        const d = (q.x - cx) ** 2 + (q.z - cz) ** 2 + (3 * (q.y - cy)) ** 2;
        if (d < bd) { bd = d; best = q.st; }
      }
    }
    const key = `${best}|${Math.floor(cx / size)},${Math.floor(cz / size)}`; // 近くに道がなければ best = -1（いつも見せる）
    if (!groups.has(key)) groups.set(key, { st: best, tris: [] });
    groups.get(key).tris.push(t);
  }
  return [...groups.values()].map(({ st, tris }) => {
    const g = new THREE.BufferGeometry();
    for (const n of names) {
      const a = geo.attributes[n];
      const out = new Float32Array(tris.length * 3 * a.itemSize);
      let o = 0;
      for (const t of tris) for (let v = 0; v < 3; v++) for (let c = 0; c < a.itemSize; c++) out[o++] = a.array[(t + v) * a.itemSize + c];
      g.setAttribute(n, new THREE.BufferAttribute(out, a.itemSize));
    }
    const m = new THREE.Mesh(g, mesh.material);
    m.renderOrder = mesh.renderOrder;
    m.userData = { ...mesh.userData };
    if (st >= 0) m.userData.stages = [st];
    return m;
  });
}

// 四角（x0〜x1、z0〜z1。少し広げて見る）の中の道の点のステージ（Global City）。道や柵のまとまりを、ステージごとに見せるため
// （遠くのステージの道が見えた。2026-10-21 のユーザー依頼）。道がなければ []
export function chunkStages(track, x0, x1, z0, z1, pad = 20) {
  const st = new Set();
  for (const p of track.samples) {
    if (p.y === null || p.void) continue;
    if (p.x < x0 - pad || p.x > x1 + pad || p.z < z0 - pad || p.z > z1 + pad) continue;
    st.add(sampleStage(track, p));
  }
  return [...st].sort((a, b) => a - b);
}

// コース選び・紹介の背景だけの、軽い形（Global City はクアラルンプールだけ）。全部の景色を作ると、とても時間がかかった
// （名前・コース選びの画面が重かった。2026-10-21 のユーザー依頼）。レースのときは buildTrackMesh で全部を作る
export function buildShowcase(track) {
  const group = new THREE.Group();
  group.userData.stageGroups = [];
  group.userData.showcase = true;
  const road = new THREE.MeshLambertMaterial({ color: 0x55585c });
  // 道（最後の大ジャンプの空の道すじは描かない）
  const gj = track.marks.GJ ?? track.marks.END;
  const lnd = track.marks.LND ?? track.marks.END;
  const onRoad = (p) => (p.y ?? 0) + 0.02;
  group.add(strip(track, markS(track, 'KL'), gj, onRoad, road));
  if (lnd < (track.loopEnd ?? 0)) group.add(strip(track, lnd, track.loopEnd, onRoad, road));
  for (const g of buildKL(track).children) {
    g.visible = true;
    group.add(g);
  }
  mergeMeshes(group);
  return group;
}

export function hasTunnels(track) {
  return track.samples.some((p) => p.tunnel || p.tunnelLook);
}

export function buildTrackMesh(track) {
  const { samples } = track;
  const dirt = track.def.dirt;
  const town = track.def.theme === 'town';
  // 世界の都市（Global City。2026-10-20）: アスファルトの道（白線）、柵は場所ごと（fenceStyles）、景色はステージごとの群れ
  const world = track.def.theme === 'world';
  // 森（Soki Forest。2026-10-16）: 茶色い土の道（線なし）、縁石なし、道の外は草、柵は丸太の色の低い柵
  const forest = track.def.theme === 'forest';
  // 雪山（Kyugo Mountain。2026-10-18）: 雪のつもった道（線なし）、縁石なし、道の外は雪、柵は低い木の柵
  const snow = track.def.theme === 'snow';
  const natural = forest || snow;
  const group = new THREE.Group();
  const hasGround = roadDrawn;
  const flat = (p) => p.y === 0 && !p.ramp;
  const stripes = (len) => (p) => (Math.floor(p.s / len) % 2 ? COLORS.white : COLORS.red);
  // 街の縁石は白黒のしま
  const curb = town || world ? (p) => (Math.floor(p.s / 2) % 2 ? 0xf2f2f2 : 0x222222) : stripes(2);
  const half = (p) => p.half;

  // 道: 灰色に、真ん中の白い破線と、両はしの白線
  const asphalt = snow ? canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#d9dde3';
    g.fillRect(0, 0, w, h);
    // 雪のわだち（少し濃い点）
    g.fillStyle = '#c6ccd4';
    for (let k = 0; k < 40; k++) g.fillRect((k * 37) % w, (k * 23) % h, 3, 2);
  }) : forest ? canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#8a6a45';
    g.fillRect(0, 0, w, h);
    // 土のでこぼこ（少し濃い点）
    g.fillStyle = '#7a5c3a';
    for (let k = 0; k < 40; k++) g.fillRect((k * 37) % w, (k * 23) % h, 3, 2);
  }) : canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#55585e';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8e8e8';
    g.fillRect(w / 2 - 1, 0, 2, h / 2);
    g.fillRect(2, 0, 2, h);
    g.fillRect(w - 4, 0, 2, h);
  });
  // 直角の角の四角の中のコースの道は、両はしの白線なし（真ん中の破線はそのまま通す。2026-10-15 のユーザー依頼）
  const corners = track.corners ?? [];
  const inSquare = (p) => corners.some((c) => inCornerZone(c, p.x, p.z));
  const asphaltMid = canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#55585e';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8e8e8';
    g.fillRect(w / 2 - 1, 0, 2, h / 2);
  });
  // 雪山: 雪の道（grip < 1）だけを雪の絵に。アスファルト（grip 1）は灰色に破線、凍った所は水色に白い光の筋（2026-10-18）
  // 雪山は、橋の上も普通の道の見た目（石の色にしない。2026-10-18 のユーザー依頼「階段のように見える」）
  const roadOk = (p) => hasGround(p) && !inSquare(p) && (snow || !p.bridge) && (!snow || (p.grip < 1 && p.grip > GRIP_ICE));
  group.add(ribbon(samples, (p) => -p.half, half, (p) => p.y + 0.03, roadOk, { color: 0xffffff, map: asphalt, vScale: 4 }));
  if (snow) {
    const paved = canvasTexture(64, 64, (g, w, h) => {
      g.fillStyle = '#5f646c';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#e8e8e8';
      g.fillRect(w / 2 - 1, 0, 2, h / 2);
    });
    const ice = canvasTexture(64, 64, (g, w, h) => {
      g.fillStyle = '#a8dcf2';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#e9f8ff';
      for (let k = 0; k < 6; k++) g.fillRect((k * 23) % (w - 20), (k * 11) % h, 20, 2);
    });
    const ok = (want) => (p) => hasGround(p) && want(p.grip);
    group.add(ribbon(samples, (p) => -p.half, half, (p) => p.y + 0.03, ok((g) => g >= 1), { color: 0xffffff, map: paved, vScale: 4 }));
    group.add(ribbon(samples, (p) => -p.half, half, (p) => p.y + 0.03, ok((g) => g <= GRIP_ICE), { color: 0xffffff, map: ice, vScale: 8 }));
  }
  // 橋の上の道は石の色（Soki Forest。2026-10-16）
  // 橋の上は、柵（車が通れる所のはし）まで石（手すりは柵の所。2026-10-16 のユーザー依頼「橋の縁がずれている」）
  if (!snow && samples.some((p) => p.bridge)) group.add(ribbon(samples, (p) => -p.wall, (p) => p.wall, (p) => p.y + 0.03, (p) => p.bridge, { color: 0x8c877e }));
  if (corners.length) group.add(ribbon(samples, (p) => -p.half, half, (p) => p.y + 0.03, (p) => hasGround(p) && inSquare(p), { color: 0xffffff, map: asphaltMid, vScale: 4 }));
  // 街の交差点: 通行止めの道の口と、角のまん中（コースと同じ道の絵でつなぐ。2026-10-15 のユーザー依頼「しっかり交差点に」）
  const mouths = town ? stubMouths(track, track.def.scenery ?? []) : [];
  if (mouths.length || corners.length) group.add(junctionMesh(track, mouths, corners, asphalt));
  if (corners.length) group.add(cornerWalls(corners, mouths));
  // 縁石（交差点の口の所と、直角の角の外側の四角の中はなし）
  const curbOk = (side) => (p) => {
    if (!hasGround(p) || natural) return false;
    const [rx, rz] = rightOf(p);
    const x = p.x + rx * side * (p.half + 0.5);
    const z = p.z + rz * side * (p.half + 0.5);
    return !mouths.some((m) => inMouth(m, x, z)) && !corners.some((c) => inCornerZone(c, x, z));
  };
  group.add(ribbon(samples, (p) => -p.half - 1, (p) => -p.half, (p) => p.y + 0.04, curbOk(-1), { colorOf: curb }));
  group.add(ribbon(samples, half, (p) => p.half + 1, (p) => p.y + 0.04, curbOk(1), { colorOf: curb }));
  // 道の外: サーキットはダート。街は歩道を描かない（地面のまま。2026-10-15 のユーザー依頼）
  if (natural) {
    // 道のふちの草は、分かれる所・合流する所で、ほかの道の上にはみ出さない（2026-10-16 のユーザー依頼「つなぎ目の草と土がおかしい」）
    const grassOk = (side) => (p) => hasGround(p) && !p.bridge && !onOtherRoad(track, p, side * (p.half + dirt / 2)) && !onOtherRoad(track, p, side * (p.half + 0.5));
    // 雪の白 / 草。トンネルの中は暗い灰色（舗装）
    const edge = (p) => (p.tunnel ? 0x4a4e55 : snow ? 0xf4f7fb : 0x6aa84f);
    group.add(ribbon(samples, (p) => -p.half - dirt, (p) => -p.half, (p) => p.y + 0.02, grassOk(-1), { colorOf: edge }));
    group.add(ribbon(samples, half, (p) => p.half + dirt, (p) => p.y + 0.02, grassOk(1), { colorOf: edge }));
  } else if (world) {
    // Global City: 道のはし（縁石の外から柵まで）を、道と同じ高さで描く（高い所の道で、すき間から下が見えた。2026-10-21 のユーザー依頼）。
    // 高い所の道は、横に側面の板（下から見上げたときと、横から見たときに、うすい紙のように見えないように）
    const edgeOk = (side) => (p) => hasGround(p) && !p.tunnel && !onOtherRoad(track, p, side * (p.half + 1.5));
    group.add(ribbon(samples, (p) => -p.wall, (p) => -p.half - 1, (p) => p.y + 0.03, edgeOk(-1), { color: 0x8a8d90 }));
    group.add(ribbon(samples, (p) => p.half + 1, (p) => p.wall, (p) => p.y + 0.03, edgeOk(1), { color: 0x8a8d90 }));
    for (const side of [-1, 1]) group.add(fence(samples, (p) => side * p.wall, (p) => p.y - 1.2, (p) => p.y + 0.03, (p) => edgeOk(side)(p) && p.y > 1.5, () => 0xb8bcc2));
  } else if (!town) {
    group.add(ribbon(samples, (p) => -p.half - dirt, (p) => -p.half - 1, () => 0.02, flat, { color: COLORS.dirt }));
    group.add(ribbon(samples, (p) => p.half + 1, (p) => p.half + dirt, () => 0.02, flat, { color: COLORS.dirt }));
  }

  // 柵（ほかの道をふさぐ所だけ開ける）。街は低いコンクリートの壁。ジャンプ台は道のすぐ横に側面と柵
  const fences = fenceSides(track, mouths);
  const index = new Map(samples.map((p, i) => [p, i]));
  for (const side of [-1, 1]) {
    // 直角の角の外側の、丸い柵は描かない（かわりに cornerWalls の2本のまっすぐな壁）
    const fenceOk = (p) => {
      if (!fences[index.get(p)][side]) return false;
      const [rx, rz] = rightOf(p);
      return !corners.some((c) => inCornerOuter(c, p.x + rx * side * p.wall, p.z + rz * side * p.wall));
    };
    const off = (p) => side * p.wall;
    if (snow) group.add(fence(samples, off, (p) => p.y ?? 0, (p) => (p.y ?? 0) + 0.8, (p) => fenceOk(p) && !p.bridge && !p.tunnel, () => 0x8a6a4a)); // 低い木の柵（高さ0.8m。トンネルの中は壁）
    else if (forest) group.add(fence(samples, off, (p) => p.y ?? 0, (p) => (p.y ?? 0) + 1.0, (p) => fenceOk(p) && !p.bridge, () => 0x7a5230)); // 丸太の色の低い柵（高さ1m。橋の上は石の手すり）
    else if (town) group.add(fence(samples, off, () => 0, () => 0.9, fenceOk, () => 0xd8d4cc)); // 低いコンクリートの壁（高さ0.9m）
    else if (world) {
      // 場所ごとの柵（def.fenceStyles。あとに書いた範囲が勝つ）: guard 白いガードレール、bamboo 竹、curb 歩道のふち、rail 橋の手すり、none なし
      const styleOf = fenceStyleOf(track);
      for (const [style, h, color] of [['guard', 0.8, 0xe8eaec], ['bamboo', 1.0, 0x8aa05a], ['curb', 0.3, 0xb8b4ac], ['rail', 1.2, 0xd8dce0]]) {
        group.add(fence(samples, off, (p) => p.y ?? 0, (p) => (p.y ?? 0) + h, (p) => fenceOk(p) && !p.tunnel && !p.auto && !p.void && styleOf(p) === style, () => color));
      }
    }
    else group.add(fence(samples, off, () => 0, () => 2.5, fenceOk, stripes(4))); // 柵（高さ2.5m）
    // ジャンプ台の側面は、黄色と黒のしま（ジャンプ台だと分かるように）
    // 下は、台の高さの分だけ（高い所のジャンプ台が、地面までの大きな壁にならないように。Kyugo Mountain）
    group.add(fence(samples, side * track.roadHalf, (p) => Math.max(0, p.y - 4), (p) => p.y + 0.03, (p) => p.ramp, (p) => (Math.floor(p.s / 2) % 2 ? 0xffd000 : 0x222222)));
    group.add(fence(samples, side * track.roadHalf, (p) => p.y, (p) => p.y + 1, (p) => p.ramp, stripes(4)));
  }
  // ジャンプの着地の道のはし（Kyugo Mountain）: 岩の崖と、黄色と黒のしまの低い壁（逆走すると、ここで止まる）
  if (snow || track.def.theme === 'world') group.add(landingCliffs(track));

  // 分離帯（芝生）と、両はしの白黒の縁石
  const hasMedian = (p) => p.median > 0;
  if (samples.some(hasMedian)) {
    group.add(ribbon(samples, (p) => -p.median, (p) => p.median, (p) => p.y + 0.12, hasMedian, { color: 0x5aa04a }));
    for (const side of [-1, 1]) group.add(fence(samples, (p) => side * p.median, (p) => p.y, (p) => p.y + 0.15, hasMedian, curb));
  }

  // ロータリーの島: 芝生の丸い台と、白黒の縁石の輪、真ん中に木。G は島のまわりが赤レンガ
  // 出口へ向かう所の道の上に、白い大きな矢印（出口が分かるように。2026-10-15 のユーザー依頼）
  const exitMat = new THREE.MeshBasicMaterial({ map: roadArrows(), transparent: true });
  for (const isl of track.islands ?? []) {
    group.add(islandMesh(isl));
    group.add(strip(track, isl.s + 14, isl.s + 22, (p) => p.y + 0.05, exitMat, 1));
  }

  const checker = canvasTexture(64, 16, (g, w, h) => {
    for (let x = 0; x < w; x += 8) {
      for (let y = 0; y < h; y += 8) {
        g.fillStyle = (x + y) % 16 ? '#111' : '#fff';
        g.fillRect(x, y, 8, 8);
      }
    }
  });
  const startS = samples[track.startIndex].s;
  group.add(strip(track, startS - 1, startS + 2, () => 0.05, new THREE.MeshBasicMaterial({ map: checker })));

  // コブ（Kyugo Mountain）: 白い雪の半球（高さ 1m につぶす）
  if (track.moguls?.length) {
    const geo = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
    const mat = new THREE.MeshLambertMaterial({ color: 0xf7fafd });
    const bumps = new THREE.InstancedMesh(geo, mat, track.moguls.length);
    const m4 = new THREE.Matrix4();
    track.moguls.forEach((m, k) => {
      m4.makeScale(m.r, 1.0, m.r).setPosition(m.x, m.y, m.z);
      bumps.setMatrixAt(k, m4);
    });
    group.add(bumps);
  }
  // スローの板（Kyugo Mountain）: 灰色に白い、うしろ向きの矢印。矢印は src/main.js で流す
  track.slowTextures = [];
  for (const sl of track.slows ?? []) {
    const tx = backArrows('#6b7480', '#ffffff');
    track.slowTextures.push(tx);
    group.add(slowPad(track, sl, new THREE.MeshBasicMaterial({ map: tx })));
  }
  // 加速板: オレンジに黄色の矢印（続いている所ごとに1枚）
  const padMat = new THREE.MeshBasicMaterial({ map: chevrons('#ff8a00', '#fff36b') });
  // 加速板は道の高さに（坂の上の加速板が道の下にかくれないように。2026-10-16 のユーザー依頼「遠いルートの加速板が見えない」）
  for (const [from, to, side] of mainBoostRuns(track)) group.add(strip(track, from, to, (p) => (p.y ?? 0) + 0.06, padMat, 1, side));
  for (const run of boostRunsAll(track)) group.add(runStrip(track, run, (p) => (p.y ?? 0) + 0.06, padMat));
  // 雪山: ジャンプ台の上も、赤に黄色の矢印（どこがジャンプ台か見えるように。2026-10-18 のユーザー依頼）
  if (snow) {
    const rampMat = new THREE.MeshBasicMaterial({ map: chevrons('#d8262b', '#ffd800') });
    for (const run of runsOn(track, (p) => p.ramp && p.y !== null)) group.add(runStrip(track, run, (p) => p.y + 0.07, rampMat, Math.max(1, Math.round(run.length / 4))));
  }
  if (track.cross) {
    const r = track.def.jump.ramp;
    // ジャンプ台: 赤に黄色の矢印をくり返し（飛び出す方向を指す）
    group.add(strip(track, track.cross.sA + r.from, track.cross.sA + r.to, (p) => p.y + 0.06,
      new THREE.MeshBasicMaterial({ map: chevrons('#d8262b', '#ffd800') }), 6));
  }

  // バンプ（Kampar Town）: 道の幅いっぱいの、大きな立体のでっぱり（黄色と黒のななめのしま）
  // 手前の道に、バンプ専用のしま模様（白と黒のななめのしまと「BUMP」の文字。黄色のバンプと見分けられるように。しまに入ると警告が出る）。
  // さらに手前の道ばたに BONGGOL の標識（2026-10-15 のユーザー依頼）
  for (const b of track.bumps ?? []) {
    group.add(bumpMesh(track, b));
    group.add(strip(track, b - BUMP_STRIPE_M, b - 4, (p) => p.y + 0.05, BUMP_ROAD_MAT(), 6));
    group.add(bumpSign(track, b - 78));
  }

  // 交差点の横断歩道（角の前と後ろ）
  for (const m of track.def.intersections ?? []) {
    const s = track.marks[m];
    for (const from of [s - 24, s + 18]) group.add(strip(track, from, from + 5, (p) => p.y + 0.05, ZEBRA_MAT(), 1));
  }

  // 街の景色（部品セットを、コースのデータの置き場所に）
  if (town) {
    const scenery = buildScenery(track, track.def.scenery ?? []);
    group.add(scenery);
    // コースの外側の何もない所はジャングル（建物・通行止めの道のまわりはあける）
    const avoid = [];
    for (const sp of scenery.userData.spots) {
      const r = sp.side === 2 ? 14 : Math.max(6, sp.radius ?? 1);
      const back = sp.side === 2 ? 16 : r * 1.4; // 建物は道から奥へ広がる
      avoid.push({ x: sp.x, z: sp.z, radius: r + 6 });
      avoid.push({ x: sp.x - Math.sin(sp.ry) * back, z: sp.z - Math.cos(sp.ry) * back, radius: r * 1.6 + 6 });
    }
    // 通行止めの道の上にも木を置かない
    for (const m of mouths) {
      for (let d = 0; d <= m.length; d += 12) avoid.push({ x: m.x - Math.sin(m.ry) * d, z: m.z - Math.cos(m.ry) * d, radius: m.width / 2 + 10 });
    }
    group.add(buildJungle(track, avoid));
    // コースの内側の左半分は水（Westlake の湖。2026-10-15 のユーザー依頼）
    group.add(buildWater(track, avoid));
  }

  // 雪山（Kyugo Mountain）: 雪のつもった石の橋、道の高さに合わせた雪の地面と雪山、トンネル
  if (snow) {
    group.add(buildBridge(track, { snow: true }));
    group.add(bridgeSlab(track));
    group.add(buildTerrain(track));
    group.add(buildRiver(track));
    group.add(grandstand(track));
    group.add(buildSnowScenery(track));
    group.add(buildSigns(track)); // トンネルのカーブの矢印、分かれ道と合流の横断幕
    group.add(mergeArrows(track)); // 合流の手前の、進む向きの白い矢印
  }
  // Global City（2026-10-20）: 景色はステージごとの群れ（userData.stages）。富士山のまわりだけ高さのある地面
  if (track.def.theme === 'world') {
    group.userData.stageGroups = [];
    const addStage = (g, stages) => {
      g.userData.stages = stages;
      group.userData.stageGroups.push(g);
      group.add(g);
    };
    group.userData.addStage = addStage;
    if (track.def.terrainBox) {
      const land = new THREE.Group();
      land.add(buildTerrain(track));
      addStage(land, [0, 1, 2]);
    }
  }
  // 森（Soki Forest）: 石のアーチ橋、道の高さに合わせた地面、川と滝
  if (forest) {
    group.add(buildBridge(track));
    group.add(buildTerrain(track));
    group.add(buildRiver(track));
    group.add(buildWaterfall(track));
    // 景色（門・大きな木・きのこの広場・道ばた）と、外のジャングル・中のブロッコリーの木（2026-10-16 のユーザー依頼）
    const groundY = (x, z) => terrainHeight(track, x, z);
    const scenery = buildScenery(track, track.def.scenery ?? [], groundY);
    group.add(scenery);
    const avoid = scenery.userData.spots.map((sp) => ({ x: sp.x, z: sp.z, radius: Math.max(4, sp.radius ?? 1) + 6 }));
    // 川と滝のまわりにも木を置かない
    const river = (track.def.river ?? []).map(([x, z]) => track.toWorld(x, z));
    for (let k = 0; k + 1 < river.length; k++) {
      const a = river[k];
      const b = river[k + 1];
      const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 8);
      for (let u = 0; u <= n; u++) avoid.push({ x: a.x + ((b.x - a.x) * u) / n, z: a.z + ((b.z - a.z) * u) / n, radius: 16 });
    }
    const wf = track.def.waterfall;
    if (wf) {
      const p = track.samples[Math.round(markS(track, wf.at)) % track.length];
      for (const d of [p.wall + 20, p.wall + 34]) avoid.push({ x: p.x - Math.sin(p.h) * wf.side * d, z: p.z + Math.cos(p.h) * wf.side * d, radius: 24 });
    }
    group.add(buildJungle(track, avoid, { groundY }));
    group.add(buildJungle(track, avoid, { groundY, inside: true }));
    // イノシシがかくれる、道の両側のしげみ（2026-10-16 のユーザー依頼）
    const hide = createBuilder();
    for (const boar of track.boars ?? []) {
      const p = track.samples[Math.round(boar.s) % track.length];
      for (const side of [-1, 1]) {
        const d = p.wall + 3;
        const x = p.x - Math.sin(p.h) * side * d;
        const z = p.z + Math.cos(p.h) * side * d;
        for (const [u, w, size] of [[0, 0, 1.6], [2, 1.2, 1.2], [-2, 0.8, 1.3]]) {
          hide.push(x + Math.cos(p.h) * u - Math.sin(p.h) * side * w, groundY(x, z), z + Math.sin(p.h) * u + Math.cos(p.h) * side * w, 0);
          hide.push(0, 0, 0, u);
          forestKit.bush(hide, { size });
          hide.pop();
          hide.pop();
        }
      }
    }
    // ぬかるみ（近道に3つ）: こげ茶の泥を、少しずつずらした丸を重ねて
    for (const m of track.muds ?? []) {
      [[0, 0, 1, 0x5a3d22], [m.r * 0.3, -m.r * 0.2, 0.7, 0x4a3018], [-m.r * 0.35, m.r * 0.25, 0.55, 0x6b4a2c], [m.r * 0.1, m.r * 0.15, 0.35, 0x3a2512]].forEach(([dx, dz, f, c], k) => {
        const disc = new THREE.Mesh(new THREE.CircleGeometry(m.r * f, 18), new THREE.MeshLambertMaterial({ color: c }));
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(m.x + dx, m.y + 0.07 + k * 0.03, m.z + dz); // 重ねる丸は少しずつ高く（ちらつかないように）
        group.add(disc);
      });
    }
    // 合流の手前の地面に、進む向きの白い矢印（2026-10-16 のユーザー依頼）。合流に入ってくる道（本線と分かれ道）の両方に
    group.add(mergeArrows(track));
    // 道の上の動かない木（2026-10-18 のユーザー依頼）: 茶色の幹に、高い所の丸い葉（車の上の高さ）
    for (const tr of track.trees ?? []) {
      if (tr.scenery) continue; // 分離帯の木（Kampar）は景色の方で描く
      hide.push(tr.x, tr.y, tr.z, tr.k);
      forestKit.broccoliTree(hide, { size: 1.15, k: tr.k });
      hide.pop();
    }
    // サルのいる高い木（枝が道の方へのびる）
    for (const m of track.monkeys ?? []) {
      const q = track.samples[m.i];
      hide.push(m.x, groundY(m.x, m.z), m.z, Math.atan2(-(q.z - m.z), q.x - m.x));
      forestKit.monkeyTree(hide);
      hide.pop();
    }
    group.add(hide.build());
  }

  // 観客席・土手・木と看板は、サーキットだけ
  if (track.def.theme === 'circuit') {
    group.add(grandstand(track));
    const sides = bankSides(track);
    group.add(bank(track, sides, -1), bank(track, sides, 1));
    group.add(roadside(track, sides));
  }
  if (hasTunnels(track)) group.add(buildTunnel(track));
  // Global City: 暗いトンネル（富士山の中・バトゥ洞窟）のカーブに矢印の板（Kyugo Mountain と同じ。2026-10-21 のユーザー依頼）
  if (world) group.add(buildSigns(track));
  // 逆走を止める柵（ジャンプの着地側。2026-10-22 のユーザー依頼）
  if (track.oneWays?.length) group.add(oneWayFences(track));
  // Global City の景色（ステージごとの群れ）
  if (world) {
    for (const build of [buildTokyo, buildFuji, buildKyoto, buildLaunchRail, buildSpace, buildHongKong, buildSea, buildNewYork, buildWarp, buildKL, buildClouds]) {
      for (const g of build(track).children.slice()) group.userData.addStage(g, g.userData.stages);
    }
  }
  // 動かない形は、同じ材質ごと・区画ごとに1つにまとめる（タブレットで描く回数を減らす。2026-10-16）
  // Global City のステージごとの群れは、見えたり消えたりするので、群れの中だけでまとめる
  const stageGroups = group.userData.stageGroups ?? [];
  for (const g of stageGroups) group.remove(g);
  group.userData.merged = mergeMeshes(group);
  // Global City: 道・柵・トンネルなどのまとまりも、ある所のステージの群れにする（遠くのステージの道を見せない）
  if (world) {
    const box = new THREE.Box3();
    // 道・柵・トンネルなどの形は、三角ごとに、近い道のステージで分ける（入れ子のグループの中の形も）
    const meshes = [];
    group.traverse((o) => { if (o.isMesh && !Array.isArray(o.material)) meshes.push(o); });
    const ident = new THREE.Matrix4();
    for (const m of meshes) {
      m.updateMatrixWorld(true);
      if (!m.matrixWorld.equals(ident)) {
        // 動かした形（ラベルなど）は、そのまま。ある所のステージで見せる
        box.setFromObject(m);
        const st = chunkStages(track, box.min.x, box.max.x, box.min.z, box.max.z);
        if (st.length && m.parent === group) { m.userData.stages = st; stageGroups.push(m); } // 入れ子の中の動かした形は、そのまま（いつも見せる）
        continue;
      }
      m.parent.remove(m);
      for (const piece of splitByStage(m, track)) {
        group.add(piece);
        if (piece.userData.stages) stageGroups.push(piece);
      }
    }
  }
  for (const g of stageGroups) {
    if (g.parent === group) continue; // 道のまとまり（もうまとめてある）
    mergeMeshes(g);
    group.add(g);
  }
  return group;
}

// 加速板が続いている所（s の始まりと終わり）
// 分かれ道の上の加速板（本線は boostRuns と strip）: 続いている所ごとの点の番号の並び（2026-10-18 のユーザー依頼「見えない」）
export function boostRunsAll(track) {
  return runsOn(track, (p) => p.boost).filter((r) => track.samples[r[0]].path !== 0);
}
// 本線・分かれ道の上で、ok な点が next でつながる並び
function runsOn(track, ok) {
  const { samples } = track;
  const runs = [];
  const seen = new Set();
  samples.forEach((p, i) => {
    if (!ok(p) || seen.has(i)) return;
    const prev = samples[p.prev];
    if (ok(prev) && prev.path === p.path && !seen.has(p.prev)) return; // 続きのとちゅう（始まりから数える）
    const run = [];
    for (let k = i; ok(samples[k]) && samples[k].path === p.path && !seen.has(k); k = samples[k].next) {
      seen.add(k);
      run.push(k);
    }
    runs.push(run);
  });
  return runs;
}
// 点の番号の並びにそった、道はばいっぱいの板（分かれ道の上でも）
function runStrip(track, run, y, material, tiles = 1) {
  const pos = [];
  const uv = [];
  const list = [...run, track.samples[run[run.length - 1]].next].map((i) => track.samples[i]);
  for (let k = 0; k + 1 < list.length; k++) {
    const p = list[k];
    const q = list[k + 1];
    const [rpx, rpz] = rightOf(p);
    const [rqx, rqz] = rightOf(q);
    const v0 = (k / (list.length - 1)) * tiles;
    const v1 = ((k + 1) / (list.length - 1)) * tiles;
    const a = [p.x - rpx * p.half, y(p), p.z - rpz * p.half];
    const b = [p.x + rpx * p.half, y(p), p.z + rpz * p.half];
    const c = [q.x - rqx * q.half, y(q), q.z - rqz * q.half];
    const d = [q.x + rqx * q.half, y(q), q.z + rqz * q.half];
    pos.push(...a, ...b, ...c, ...b, ...d, ...c);
    uv.push(0, v0, 1, v0, 0, v1, 1, v0, 1, v1, 0, v1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return new THREE.Mesh(g, material);
}

// 本線の加速板（s の始まりと終わり、片側か）。分かれ道の点は、本線と同じ s を持つので入れない（2026-10-18: B の加速板が本線に描かれていた）
export function mainBoostRuns(track) {
  return boostRuns(track.samples.slice(0, track.length));
}

function boostRuns(samples) {
  const runs = [];
  let from = null;
  let side = 0;
  for (const p of samples) {
    if (p.boost && from === null) {
      from = p.s;
      side = p.boostSide || 0;
    }
    if (!p.boost && from !== null) {
      runs.push([from, p.s, side]);
      from = null;
    }
  }
  if (from !== null) runs.push([from, samples[samples.length - 1].s + 1, side]);
  return runs;
}

// 道の上の白い矢印（進む向きを指す。左右の車線に1つずつ）
function roadArrows() {
  return canvasTexture(128, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#f4f4f4';
    for (const cx of [w * 0.2, w * 0.8]) {
      g.beginPath();
      g.moveTo(cx - 12, h * 0.95);
      g.lineTo(cx - 12, h * 0.45);
      g.lineTo(cx - 24, h * 0.45);
      g.lineTo(cx, h * 0.05);
      g.lineTo(cx + 24, h * 0.45);
      g.lineTo(cx + 12, h * 0.45);
      g.lineTo(cx + 12, h * 0.95);
      g.fill();
    }
  });
}

function islandMesh(isl) {
  const g = new THREE.Group();
  if (isl.brick) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(isl.r, isl.r + 12, 40), new THREE.MeshLambertMaterial({ color: 0xc06a4a }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(isl.x, 0.04, isl.z);
    g.add(ring);
  }
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(isl.r, isl.r, 0.25, 32), new THREE.MeshLambertMaterial({ color: 0x5aa04a }));
  grass.position.set(isl.x, 0.125, isl.z);
  g.add(grass);
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, (2 * Math.PI * isl.r) / 24), new THREE.MeshLambertMaterial({ color: k % 2 ? 0xf2f2f2 : 0x222222 }));
    block.position.set(isl.x + Math.cos(a) * (isl.r + 0.2), 0.15, isl.z + Math.sin(a) * (isl.r + 0.2));
    block.rotation.y = -a;
    g.add(block);
  }
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.5, 6), new THREE.MeshLambertMaterial({ color: 0x7a5a3a }));
  trunk.position.set(isl.x, 1.4, isl.z);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), new THREE.MeshLambertMaterial({ color: 0x3f8f3a }));
  leaf.position.set(isl.x, 3.6, isl.z);
  g.add(trunk, leaf);
  return g;
}

// マレーシアのバンプの標識: 黄色いひし形に黒いでっぱりの絵、その下に白い板の「BONGGOL」。道の左の歩道に立てる
function bumpSign(track, s) {
  const n = track.samples.length;
  const p = track.samples[((Math.round(s) % n) + n) % n];
  const d = p.wall - 1.2;
  const g = new THREE.Group();
  g.position.set(p.x + Math.sin(p.h) * d, 0, p.z - Math.cos(p.h) * d); // 左側（右向きのベクトルの反対）
  g.rotation.y = -p.h - Math.PI / 2; // 板の表が、走ってくる車の方を向く
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), new THREE.MeshLambertMaterial({ color: 0x9aa0a6 }));
  pole.position.y = 1.3;
  const diamond = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: canvasTexture(64, 64, (c, w, h) => {
    c.fillStyle = '#111';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffd400';
    c.fillRect(3, 3, w - 6, h - 6);
    c.fillStyle = '#111';
    c.save();
    c.translate(w / 2, h / 2);
    c.rotate(-Math.PI / 4); // ひし形に回すので、絵は逆に回して描く
    c.beginPath();
    c.moveTo(-22, 8);
    c.quadraticCurveTo(0, -18, 22, 8);
    c.lineTo(-22, 8);
    c.fill();
    c.fillRect(-24, 8, 48, 4);
    c.restore();
  }), side: THREE.DoubleSide }));
  diamond.rotation.z = Math.PI / 4;
  diamond.position.set(0, 2.55, 0.08);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.35), new THREE.MeshBasicMaterial({ map: canvasTexture(128, 40, (c, w, h) => {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#111';
    c.lineWidth = 3;
    c.strokeRect(2, 2, w - 4, h - 4);
    c.fillStyle = '#111';
    c.font = 'bold 26px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('BONGGOL', w / 2, h / 2 + 1);
  }), side: THREE.DoubleSide }));
  plate.position.set(0, 1.75, 0.08);
  g.add(pole, diamond, plate);
  return g;
}

// 遠くの山。サーキットはまわりをぐるりと。Kampar Town は写真のとおり、北（-z）と東（+x）に高く
const MOUNTAIN = new THREE.MeshLambertMaterial({ color: 0x7c9a6b });
function mountains(track) {
  const g = new THREE.Group();
  const town = ['town', 'world'].includes(track.def.theme);
  const reach = Math.max(...track.samples.map((p) => Math.hypot(p.x, p.z)));
  const radius = 700;
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    let h = 150 + ((k * 37) % 5) * 40;
    if (town) {
      const north = Math.max(0, -Math.sin(a)); // -z の向き
      const east = Math.max(0, Math.cos(a)); // +x の向き
      h = 90 + 260 * Math.max(north, east) + ((k * 37) % 5) * 25;
    }
    const cone = new THREE.Mesh(new THREE.ConeGeometry(h * 1.4, h, 7), MOUNTAIN);
    // 街では、山のすそがコースにかからないよう、すその広さの分だけ遠くに置く
    const r = town ? reach + h * 1.4 + 60 : radius;
    cone.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r);
    g.add(cone);
  }
  return g;
}

// バンプの立体（長さ3m・高さ35cm、道の幅いっぱい。上と横は黄色と黒のななめのしま。2026-10-15 のユーザー依頼「もっと大きく目立つように」）
export const BUMP_SIZE = { length: 3, height: 0.35 };
let bumpTexture = null;
function bumpMesh(track, s) {
  const n = track.samples.length;
  const p = track.samples[((Math.round(s) % n) + n) % n];
  if (!bumpTexture) {
    bumpTexture = canvasTexture(128, 32, (g, w, h) => {
      g.fillStyle = '#ffd400';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#111';
      for (let x = -h; x < w + h; x += 24) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + 12, 0);
        g.lineTo(x + 12 + h, h);
        g.lineTo(x + h, h);
        g.fill();
      }
    });
    bumpTexture.wrapS = THREE.RepeatWrapping;
    bumpTexture.repeat.set(4, 1);
  }
  const geo = new THREE.BoxGeometry(BUMP_SIZE.length, BUMP_SIZE.height, p.half * 2 + 2);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: bumpTexture }));
  m.position.set(p.x, (p.y ?? 0) + BUMP_SIZE.height / 2, p.z);
  m.rotation.y = -p.h;
  return m;
}

// バンプの手前の道の模様（白と黒のななめのしまに、黒い「BUMP」の文字。前は絵の上）
let bumpRoad = null;
function BUMP_ROAD_MAT() {
  if (!bumpRoad) {
    const tex = canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = '#f4f4f4';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#111';
      for (let x = -w; x < w * 2; x += 32) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + 14, 0);
        g.lineTo(x + 14 + 40, 40);
        g.lineTo(x + 40, 40);
        g.fill();
        g.beginPath();
        g.moveTo(x, h - 40);
        g.lineTo(x + 14, h - 40);
        g.lineTo(x + 14 + 40, h);
        g.lineTo(x + 40, h);
        g.fill();
      }
      g.font = 'bold 44px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('BUMP', w / 2, h / 2);
    });
    bumpRoad = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92 });
  }
  return bumpRoad;
}

// 横断歩道（白い太いしま。道の幅いっぱい）
let zebra = null;
function ZEBRA_MAT() {
  if (!zebra) {
    const tex = canvasTexture(128, 16, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#f4f4f4';
      for (let x = 4; x < w; x += 12) g.fillRect(x, 0, 6, h);
    });
    zebra = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  }
  return zebra;
}

// 直角の角の前後、まっすぐな幅の道で描く長さ（m）。この中のコースの道は、丸い縁石と両はしの白線を描かない
const CORNER_REACH = 30;
export function inCornerZone(c, x, z) {
  const o = cornerUW(c, x, z);
  return o.u > -CORNER_REACH && o.w > -CORNER_REACH && o.u < c.W + 2 && o.w < c.W + 2;
}

// 点が、直角の角の外側の四角の中か（内側の角の丸い柵・縁石はそのまま）
export function inCornerOuter(c, x, z) {
  const o = cornerUW(c, x, z);
  return o.u > -c.W + 1 && o.w > -c.W + 1 && o.u < c.W + 1 && o.w < c.W + 1;
}

// 直角の角の外側の壁（w = W と u = W の線）の、通行止めの道の口であける所（線ごとに [から, まで]）。
// 口は角の丸めのため、角から 6〜9m ほどの所にあるので、線より手前の口も数える（最終レビュー: あかない角があった）
export function cornerWallCuts(c, mouths) {
  const W = c.W;
  const out = { u: [], w: [] };
  for (const m of mouths) {
    const o = cornerUW(c, m.x, m.z);
    for (const line of ['w', 'u']) {
      const along = line === 'w' ? o.u : o.w;
      const off = line === 'w' ? o.w : o.u;
      if (Math.abs(along) < W + m.width / 2 && off > 3 && off < W + 3) out[line].push([along - m.width / 2, along + m.width / 2]);
    }
  }
  return out;
}

// 直角の角の外側の、2本のまっすぐな低い壁（w = W と u = W）。通行止めの道の口の所はあける
function cornerWalls(corners, mouths) {
  const pos = [];
  const H = 0.9;
  const quad = (a, b) => {
    pos.push(a[0], 0, a[1], b[0], 0, b[1], b[0], H, b[1], a[0], 0, a[1], b[0], H, b[1], a[0], H, a[1]);
  };
  for (const c of corners) {
    const W = c.W;
    const P = (u, w) => [c.x + c.ux * u - c.vx * w, c.z + c.uz * u - c.vz * w];
    const cutsOf = cornerWallCuts(c, mouths);
    for (const line of ['w', 'u']) {
      const cuts = cutsOf[line];
      let from = -W;
      const pieces = [];
      for (const [a, b] of cuts.sort((x, y) => x[0] - y[0])) {
        if (a > from) pieces.push([from, Math.min(a, W)]);
        from = Math.max(from, b);
      }
      if (from < W) pieces.push([from, W]);
      for (const [a, b] of pieces) quad(line === 'w' ? P(a, W) : P(W, a), line === 'w' ? P(b, W) : P(W, b));
    }
  }
  return mesh(pos, { color: 0xd8d4cc });
}

// 通行止めの道の面（コースと同じ道の絵: 両はしの白線と真ん中の破線）と、角のまん中の四角。
// コースの道より少し下に描き、口はコースの道の下まで少し入れて、すき間なくつなぐ
function junctionMesh(track, mouths, corners, asphalt) {
  const group = new THREE.Group();
  const pos = [];
  const uv = [];
  const y = 0.025;
  for (const m of mouths) {
    const c = Math.cos(m.ry);
    const s = Math.sin(m.ry);
    const w = m.width;
    const P = (lx, lz) => [m.x + lx * c + lz * s, y, m.z - lx * s + lz * c];
    const [z0, z1] = [3, -m.length];
    const a = P(-w / 2, z0), b = P(w / 2, z0), cc = P(-w / 2, z1), d = P(w / 2, z1);
    pos.push(...a, ...cc, ...b, ...b, ...cc, ...d);
    const v0 = -z0 / 4, v1 = -z1 / 4;
    uv.push(0, v0, 0, v1, 1, v0, 1, v0, 0, v1, 1, v1);
  }
  group.add(mesh(pos, { color: 0xffffff, uv, map: asphalt }));
  // 直角の角の四角（2本の道が重なる所から、外側の壁まで）。コースの道の下に、コースと同じ道の絵の、線のない所を貼る（色がそろうように）
  const box = [];
  const boxUv = [];
  for (const c of corners) {
    const h = c.W;
    // 通行止めの道（y）より少し下（重なってちらつかないように）
    const P = (u, w) => [c.x + c.ux * u - c.vx * w, y - 0.006, c.z + c.uz * u - c.vz * w];
    // 入ってくる道と曲がった先の道を、角の前後 CORNER_REACH m まで、まっすぐな幅で（内側の角は芝生のまま）
    const a = -track.roadHalf;
    // コースの道は角の手前から少し丸いので、その下まで長めにしく（すき間ができないように）
    const L = -CORNER_REACH - 15;
    for (const [u0, u1, w0, w1] of [[L, h, a, -a], [a, -a, L, h], [a, h, a, h]]) {
      const p1 = P(u0, w0), p2 = P(u1, w0), p3 = P(u1, w1), p4 = P(u0, w1);
      for (const tri of [[p1, p2, p3], [p1, p3, p4]]) {
        // 上向きの面にする（コースの道と同じ明るさに）
        const [q0, q1, q2] = tri;
        const ny = (q1[2] - q0[2]) * (q2[0] - q0[0]) - (q1[0] - q0[0]) * (q2[2] - q0[2]);
        for (const q of ny >= 0 ? tri : [q0, q2, q1]) {
          box.push(...q);
          boxUv.push(0.25, 0.75); // 白線のない所
        }
      }
    }
  }
  // 内側の角の、直角の縁石（2本のまっすぐな白黒）
  const curbPos = [];
  const curbCol = [];
  const col = new THREE.Color();
  for (const c of corners) {
    const a = track.roadHalf;
    const P = (u, w) => [c.x + c.ux * u - c.vx * w, 0.04, c.z + c.uz * u - c.vz * w];
    for (let t = -CORNER_REACH; t < -a; t += 2) {
      for (const [p1, p2, p3, p4] of [[P(t, -a), P(t + 2, -a), P(t + 2, -a - 1), P(t, -a - 1)], [P(-a, t), P(-a, t + 2), P(-a - 1, t + 2), P(-a - 1, t)]]) {
        curbPos.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4);
        col.setHex(Math.floor(t / 2) % 2 ? 0xf2f2f2 : 0x222222);
        for (let k = 0; k < 6; k++) curbCol.push(col.r, col.g, col.b);
      }
    }
  }
  if (curbPos.length) group.add(mesh(curbPos, { colors: curbCol }));
  if (box.length) group.add(mesh(box, { color: 0xffffff, uv: boxUv, map: asphalt }));
  return group;
}

// 逆走を止める柵の見た目: 道の幅いっぱいの低い板（赤と白のしま。高さ約 0.9m）と、両はしの柱。前（ジャンプで来る側）から見ると低いので、飛んでくる車の上にはかからない。
// 板は地面までとどかせて、下にすき間を作らない（2026-10-22 のユーザー依頼「通れるような隙間が見える」）
export function oneWayFences(track) {
  const b = createBuilder();
  const STRIPE = 2; // しまの幅（m）
  for (const g of track.oneWays) {
    const w = g.vwall;
    b.push(g.vx, g.y, g.vz, Math.atan2(Math.cos(g.vh), Math.sin(g.vh)));
    const n = Math.max(1, Math.round((2 * w) / STRIPE));
    for (let k = 0; k < n; k++) {
      const x = -w + ((k + 0.5) * 2 * w) / n;
      b.box((2 * w) / n, 0.9, 0.25, k % 2 ? 0xffffff : 0xd8262b, x, 0, 0);
    }
    for (const x of [-w, w]) b.box(0.3, 1.2, 0.3, 0x333333, x, 0, 0); // 両はしの柱
    b.pop();
  }
  const g = b.build();
  g.traverse((o) => { o.userData.oneWayFence = true; });
  return g;
}
