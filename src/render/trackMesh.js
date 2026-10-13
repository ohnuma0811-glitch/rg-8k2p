// コースの見た目: 道（白線）、縁石、ダート、柵、ジャンプ台、加速板、スタートライン、観客席、木と看板
import * as THREE from '../../vendor/three.module.min.js?v=87675a6';

const COLORS = {
  dirt: 0xb08850,
  rampSide: 0x8a6d4a,
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

// コースを横切る板（スタートライン、加速板）。from〜to は s（m）
function strip(track, from, to, y, material) {
  const { samples, roadHalf } = track;
  const pos = [];
  const uv = [];
  const list = samples.filter((p) => p.s >= from && p.s < to);
  for (let k = 0; k + 1 < list.length; k++) {
    const p = list[k];
    const q = list[k + 1];
    const [rpx, rpz] = rightOf(p);
    const [rqx, rqz] = rightOf(q);
    const v0 = k / (list.length - 1);
    const v1 = (k + 1) / (list.length - 1);
    const a = [p.x - rpx * roadHalf, y(p), p.z - rpz * roadHalf];
    const b = [p.x + rpx * roadHalf, y(p), p.z + rpz * roadHalf];
    const c = [q.x - rqx * roadHalf, y(q), q.z - rqz * roadHalf];
    const d = [q.x + rqx * roadHalf, y(q), q.z + rqz * roadHalf];
    pos.push(...a, ...c, ...b, ...b, ...c, ...d);
    uv.push(0, v0, 0, v1, 1, v0, 1, v0, 0, v1, 1, v1);
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

// スタートラインの横（コースの外側、柵の外）に、段になった観客席と観客
function grandstand(track) {
  const group = new THREE.Group();
  const p = track.samples[track.startIndex];
  const base = p.wall + 4;
  const [r0x, r0z] = rightOf(p);
  const side = insideLoop(track.samples, p.x + r0x * (base + 6), p.z + r0z * (base + 6)) ? -1 : 1;
  const rx = r0x * side;
  const rz = r0z * side;
  const length = 50;
  const steps = 6;
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

// 柵の外に、木と看板を並べる（流れていく物があると速く感じる）。ほかの道や観客席には置かない
function roadside(track) {
  const { samples } = track;
  const start = samples[track.startIndex];
  const trees = [];
  const signs = [];
  for (let i = 0; i < samples.length; i += 5) {
    const p = samples[i];
    if (p.y !== 0) continue;
    const [rx, rz] = rightOf(p);
    for (const side of [-1, 1]) {
      const d = p.wall + 2 + ((i * 7) % 3);
      const x = p.x + rx * side * d;
      const z = p.z + rz * side * d;
      if (distToTrack(samples, x, z) < p.wall + 2.5) continue;
      if (Math.hypot(x - start.x, z - start.z) < 45) continue;
      if ((i / 5 + (side > 0 ? 1 : 0)) % 4 === 0) signs.push({ x, z, h: p.h });
      else trees.push({ x, z });
    }
  }
  const group = new THREE.Group();
  const m = new THREE.Matrix4();
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.4, 2, 6), new THREE.MeshLambertMaterial({ color: 0x7a4b25 }), trees.length);
  const leaves = new THREE.InstancedMesh(new THREE.ConeGeometry(2.2, 5, 7), new THREE.MeshLambertMaterial({ color: 0x2f7d32 }), trees.length);
  trees.forEach((t, k) => {
    trunk.setMatrixAt(k, m.makeTranslation(t.x, 1, t.z));
    leaves.setMatrixAt(k, m.makeTranslation(t.x, 4.2, t.z));
  });
  const board = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 2, 0.2), new THREE.MeshLambertMaterial(), signs.length);
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 2.5, 5), new THREE.MeshLambertMaterial({ color: 0xdddddd }), signs.length);
  const c = new THREE.Color();
  const palette = [0xffd84a, 0x3fa9ff, 0xff5a5f, 0x7bd389];
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  signs.forEach((s, k) => {
    q.setFromAxisAngle(up, -s.h);
    board.setMatrixAt(k, m.compose(new THREE.Vector3(s.x, 3.3, s.z), q, new THREE.Vector3(1, 1, 1)));
    board.setColorAt(k, c.setHex(palette[k % palette.length]));
    pole.setMatrixAt(k, m.makeTranslation(s.x, 1.25, s.z));
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

  // 柵（交わる所のまわりは開ける）。ジャンプ台は道のすぐ横に側面と柵
  const fenceOk = (p) => p.y === 0 && !p.noWall && !p.ramp;
  for (const side of [-1, 1]) {
    group.add(fence(samples, side * (roadHalf + dirt), () => 0, () => 1, fenceOk, stripes(4)));
    group.add(fence(samples, side * roadHalf, () => 0, (p) => p.y + 0.03, (p) => p.ramp, () => COLORS.rampSide));
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
    const arrows = canvasTexture(64, 64, (g, w, h) => {
      g.fillStyle = '#ff8a00';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff36b';
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
    const b = track.def.jump.boost;
    group.add(strip(track, track.cross.sA + b.from, track.cross.sA + b.to, () => 0.06, new THREE.MeshBasicMaterial({ map: arrows })));
  }

  group.add(grandstand(track));
  group.add(roadside(track));
  return group;
}
