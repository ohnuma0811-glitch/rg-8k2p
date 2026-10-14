// コースの見た目: 道（白線）、縁石、ダート、柵、ジャンプ台、加速板、スタートライン、観客席、木と看板
import * as THREE from '../../vendor/three.module.min.js?v=8536e82';

const COLORS = {
  dirt: 0xb08850,
  red: 0xd8262b,
  white: 0xffffff,
};

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
    const a = [p.x + rpx * offA, yOf(p), p.z + rpz * offA];
    const b = [p.x + rpx * offB, yOf(p), p.z + rpz * offB];
    const cc = [q.x + rqx * offA, yOf(q), q.z + rqz * offA];
    const d = [q.x + rqx * offB, yOf(q), q.z + rqz * offB];
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
    const px = p.x + rpx * off;
    const pz = p.z + rpz * off;
    const qx = q.x + rqx * off;
    const qz = q.z + rqz * off;
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
export function strip(track, from, to, y, material, tiles = 1) {
  const { samples, roadHalf } = track;
  const pos = [];
  const uv = [];
  const list = samples.filter((p) => p.s >= from && p.s < to);
  for (let k = 0; k + 1 < list.length; k++) {
    const p = list[k];
    const q = list[k + 1];
    const [rpx, rpz] = rightOf(p);
    const [rqx, rqz] = rightOf(q);
    const v0 = (k / (list.length - 1)) * tiles;
    const v1 = ((k + 1) / (list.length - 1)) * tiles;
    const a = [p.x - rpx * roadHalf, y(p), p.z - rpz * roadHalf];
    const b = [p.x + rpx * roadHalf, y(p), p.z + rpz * roadHalf];
    const c = [q.x - rqx * roadHalf, y(q), q.z - rqz * roadHalf];
    const d = [q.x + rqx * roadHalf, y(q), q.z + rqz * roadHalf];
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
export function fenceSides(track) {
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

// 木（土手の上、土手がない所は柵の外）と看板（柵と土手の間）。高く大きく（マリオカート64 のように）
function roadside(track, sides) {
  const { samples } = track;
  const start = samples[track.startIndex];
  const trees = [];
  const signs = [];
  for (let i = 0; i < samples.length; i += 5) {
    const p = samples[i];
    if (p.y !== 0) continue;
    const [rx, rz] = rightOf(p);
    for (const side of [-1, 1]) {
      if (Math.hypot(p.x - start.x, p.z - start.z) < 45) continue;
      if ((i / 5 + (side > 0 ? 1 : 0)) % 4 === 0) {
        const d = p.wall + 1.5;
        signs.push({ x: p.x + rx * side * d, z: p.z + rz * side * d, h: p.h });
        continue;
      }
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
  const { samples, roadHalf } = track;
  const dirt = track.def.dirt;
  const group = new THREE.Group();
  const hasGround = (p) => p.y !== null;
  const flat = (p) => p.y === 0 && !p.ramp;
  const stripes = (len) => (p) => (Math.floor(p.s / len) % 2 ? COLORS.white : COLORS.red);

  // 道: 灰色に、真ん中の白い破線と、両はしの白線
  const asphalt = canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#55585e';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8e8e8';
    g.fillRect(w / 2 - 1, 0, 2, h / 2);
    g.fillRect(2, 0, 2, h);
    g.fillRect(w - 4, 0, 2, h);
  });
  group.add(ribbon(samples, -roadHalf, roadHalf, (p) => p.y + 0.03, hasGround, { color: 0xffffff, map: asphalt, vScale: 4 }));
  // 縁石（赤白）
  group.add(ribbon(samples, -roadHalf - 1, -roadHalf, (p) => p.y + 0.04, hasGround, { colorOf: stripes(2) }));
  group.add(ribbon(samples, roadHalf, roadHalf + 1, (p) => p.y + 0.04, hasGround, { colorOf: stripes(2) }));
  group.add(ribbon(samples, -roadHalf - dirt, -roadHalf - 1, () => 0.02, flat, { color: COLORS.dirt }));
  group.add(ribbon(samples, roadHalf + 1, roadHalf + dirt, () => 0.02, flat, { color: COLORS.dirt }));

  // 柵（ほかの道をふさぐ所だけ開ける）。ジャンプ台は道のすぐ横に側面と柵
  const fences = fenceSides(track);
  const index = new Map(samples.map((p, i) => [p, i]));
  for (const side of [-1, 1]) {
    const fenceOk = (p) => fences[index.get(p)][side];
    group.add(fence(samples, side * (roadHalf + dirt), () => 0, () => 2.5, fenceOk, stripes(4))); // 柵（高さ2.5m）
    // ジャンプ台の側面は、黄色と黒のしま（ジャンプ台だと分かるように）
    group.add(fence(samples, side * roadHalf, () => 0, (p) => p.y + 0.03, (p) => p.ramp, (p) => (Math.floor(p.s / 2) % 2 ? 0xffd000 : 0x222222)));
    group.add(fence(samples, side * roadHalf, (p) => p.y, (p) => p.y + 1, (p) => p.ramp, stripes(4)));
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

  if (track.cross) {
    const b = track.def.jump.boost;
    const r = track.def.jump.ramp;
    // 加速板: オレンジに黄色の矢印
    group.add(strip(track, track.cross.sA + b.from, track.cross.sA + b.to, () => 0.06,
      new THREE.MeshBasicMaterial({ map: chevrons('#ff8a00', '#fff36b') }), 1));
    // ジャンプ台: 赤に黄色の矢印をくり返し（飛び出す方向を指す）
    group.add(strip(track, track.cross.sA + r.from, track.cross.sA + r.to, (p) => p.y + 0.06,
      new THREE.MeshBasicMaterial({ map: chevrons('#d8262b', '#ffd800') }), 6));
  }

  group.add(grandstand(track));
  const sides = bankSides(track);
  group.add(bank(track, sides, -1), bank(track, sides, 1));
  group.add(roadside(track, sides));
  return group;
}
