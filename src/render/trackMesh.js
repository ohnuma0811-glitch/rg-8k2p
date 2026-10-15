// コースの見た目: 道（白線）、縁石、ダート、柵、ジャンプ台、加速板、スタートライン、観客席、木と看板
import * as THREE from '../../vendor/three.module.min.js';
import { buildScenery, stubMouths, inMouth } from './town/scenery.js';
import { buildJungle } from './town/jungle.js';
import { BUMP_STRIPE_M } from '../game/hazards.js';

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
    const q = samples[(i + 1) % n];
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
    const q = samples[(i + 1) % n];
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

// コースを横切る板（スタートライン、加速板、ジャンプ台の模様）。from〜to は s（m）。tiles は模様をくり返す回数
// side が 1 なら道の右半分（分離帯の外）だけ、-1 なら左半分だけ
export function strip(track, from, to, y, material, tiles = 1, side = 0) {
  const { samples } = track;
  const pos = [];
  const uv = [];
  const list = samples.filter((p) => p.s >= from && p.s < to);
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
  const p = track.samples[track.startIndex];
  const base = p.wall + 4;
  const [r0x, r0z] = rightOf(p);
  const side = insideLoop(track.samples, p.x + r0x * (base + 6), p.z + r0z * (base + 6)) ? -1 : 1;
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
  const stand = new THREE.MeshLambertMaterial({ color: 0x9aa3ad });
  for (let k = 0; k < steps; k++) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(length, 1 + k * 1.2, 2), stand);
    const d = base + k * 2;
    box.position.set(p.x + rx * d, (1 + k * 1.2) / 2, p.z + rz * d);
    box.rotation.y = -p.h;
    group.add(box);
  }
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
// mouths: 通行止めの道の口（src/render/town/scenery.js の stubMouths）。口の前の壁はあける
export function fenceSides(track, mouths = []) {
  const { samples, roadHalf } = track;
  const n = samples.length;
  const near = nearIndex(samples);
  return samples.map((p, i) => {
    const ok = {};
    for (const side of [-1, 1]) {
      ok[side] = false;
      if (p.y !== 0 || p.ramp) continue;
      const x = p.x - Math.sin(p.h) * side * p.wall;
      const z = p.z + Math.cos(p.h) * side * p.wall;
      if (mouths.some((m) => inMouth(m, x, z))) continue;
      ok[side] = !near(x, z, roadHalf + 1, (j) => {
        const gap = Math.min(Math.abs(i - j), n - Math.abs(i - j));
        const q = samples[j];
        return gap >= 60 && q.y !== null && Math.hypot(q.x - x, q.z - z) <= roadHalf + 1;
      });
    }
    return ok;
  });
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

export function buildTrackMesh(track) {
  const { samples } = track;
  const dirt = track.def.dirt;
  const town = track.def.theme === 'town';
  const group = new THREE.Group();
  const hasGround = (p) => p.y !== null;
  const flat = (p) => p.y === 0 && !p.ramp;
  const stripes = (len) => (p) => (Math.floor(p.s / len) % 2 ? COLORS.white : COLORS.red);
  // 街の縁石は白黒のしま
  const curb = town ? (p) => (Math.floor(p.s / 2) % 2 ? 0xf2f2f2 : 0x222222) : stripes(2);
  const half = (p) => p.half;

  // 道: 灰色に、真ん中の白い破線と、両はしの白線
  const asphalt = canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#55585e';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8e8e8';
    g.fillRect(w / 2 - 1, 0, 2, h / 2);
    g.fillRect(2, 0, 2, h);
    g.fillRect(w - 4, 0, 2, h);
  });
  group.add(ribbon(samples, (p) => -p.half, half, (p) => p.y + 0.03, hasGround, { color: 0xffffff, map: asphalt, vScale: 4 }));
  // 縁石
  group.add(ribbon(samples, (p) => -p.half - 1, (p) => -p.half, (p) => p.y + 0.04, hasGround, { colorOf: curb }));
  group.add(ribbon(samples, half, (p) => p.half + 1, (p) => p.y + 0.04, hasGround, { colorOf: curb }));
  // 道の外: サーキットはダート。街は歩道を描かない（地面のまま。2026-10-15 のユーザー依頼）
  if (!town) {
    group.add(ribbon(samples, (p) => -p.half - dirt, (p) => -p.half - 1, () => 0.02, flat, { color: COLORS.dirt }));
    group.add(ribbon(samples, (p) => p.half + 1, (p) => p.half + dirt, () => 0.02, flat, { color: COLORS.dirt }));
  }

  // 柵（ほかの道をふさぐ所だけ開ける）。街は低いコンクリートの壁。ジャンプ台は道のすぐ横に側面と柵
  const fences = fenceSides(track, town ? stubMouths(track, track.def.scenery ?? []) : []);
  const index = new Map(samples.map((p, i) => [p, i]));
  for (const side of [-1, 1]) {
    const fenceOk = (p) => fences[index.get(p)][side];
    const off = (p) => side * p.wall;
    if (town) group.add(fence(samples, off, () => 0, () => 0.9, fenceOk, () => 0xd8d4cc)); // 低いコンクリートの壁（高さ0.9m）
    else group.add(fence(samples, off, () => 0, () => 2.5, fenceOk, stripes(4))); // 柵（高さ2.5m）
    // ジャンプ台の側面は、黄色と黒のしま（ジャンプ台だと分かるように）
    group.add(fence(samples, side * track.roadHalf, () => 0, (p) => p.y + 0.03, (p) => p.ramp, (p) => (Math.floor(p.s / 2) % 2 ? 0xffd000 : 0x222222)));
    group.add(fence(samples, side * track.roadHalf, (p) => p.y, (p) => p.y + 1, (p) => p.ramp, stripes(4)));
  }

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

  // 加速板: オレンジに黄色の矢印（続いている所ごとに1枚）
  const padMat = new THREE.MeshBasicMaterial({ map: chevrons('#ff8a00', '#fff36b') });
  for (const [from, to, side] of boostRuns(samples)) group.add(strip(track, from, to, () => 0.06, padMat, 1, side));
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
    group.add(buildJungle(track, avoid));
  }

  // 観客席・土手・木と看板は、サーキットだけ
  if (track.def.theme === 'circuit') {
    group.add(grandstand(track));
    const sides = bankSides(track);
    group.add(bank(track, sides, -1), bank(track, sides, 1));
    group.add(roadside(track, sides));
  }
  return group;
}

// 加速板が続いている所（s の始まりと終わり）
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
  const town = track.def.theme === 'town';
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
