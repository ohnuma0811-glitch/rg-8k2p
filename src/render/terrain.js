// 道の高さに合わせた地面（Soki Forest。2026-10-16 のユーザー依頼「道が上下に波打つ」）。
// 地面は、近い道の高さから、道のふちから FALL m で 0 へなめらかに下がる。川の上は低くする
import * as THREE from '../../vendor/three.module.min.js?v=0f5aefc';
import { TUNNEL_HEIGHT } from './snow/tunnel.js?v=0f5aefc';

const FALL = 60; // 道のふちから、高さが 0 になるまで（m）
const NEAR = 2; // 道のふちからこの距離までは、道より高くしない（m）
const RIVER_DEPTH = -1.5; // 川の真ん中の地面の高さ（m）
const RIVER_FULL = 5; // 川の線からこの距離までは、いちばん深い（m）
const RIVER_EDGE = 12; // 川の線からこの距離で、もとの高さ（m）
const CELL = 20; // 点を探すます目（m）
export const GRID = 10; // 地面のます目（m）
const MARGIN = 200; // コースのはしから、地面を作る広さ（m）
const SHOULDER = 10; // 道のふちの外の、草の坂の幅（m。地面のます目のすき間をうめる）
const COLOR = 0x5f9e4a;
const SNOW_COLOR = 0xf2f6fb; // 雪山（Kyugo Mountain）
const PEAK_CLEAR = 40; // 道のふち（＋地面のます目 1つ）から、この距離で山の高さになる（m）
const COVER = 8; // トンネルの柵の外、この距離まで山でおおう（m）
const STAND_FLAT = 32; // 観客席の真ん中から、この距離までは平ら（m）
export const GAP_DROP = 6; // ジャンプの地面のない所の地面は、両はしの道よりこれだけ低く（m）

const smooth = (a, b, x) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// 点を探すます目と、川の線（コースの座標）。track ごとに一度だけ作る
const cache = new WeakMap();
function prep(track) {
  if (cache.has(track)) return cache.get(track);
  const grid = new Map();
  // 橋の上の点、ジャンプ台、地面のない所（川の上）は、地面を引っぱらない（ジャンプ台の下も川が見えるように）
  // トンネルの中の道（Kyugo Mountain）も、地面を引っぱらない（上を山でおおう）
  const pts = track.samples.filter((p) => p.y !== null && !p.bridge && !p.ramp && !p.tunnel);
  for (const p of pts) {
    const key = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(p);
  }
  const river = (track.def.river ?? []).map(([x, z]) => track.toWorld(x, z));
  const tunnel = new Map();
  for (const p of track.samples) {
    if (!p.tunnel) continue;
    const key = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`;
    if (!tunnel.has(key)) tunnel.set(key, []);
    tunnel.get(key).push(p);
  }
  // 観客席の所（Kyugo Mountain）: 観客席の下とまわりは、道の高さより上げない（雪山の坂にうまらないように）
  let stand = null;
  const gs = track.def.grandstand;
  if (gs && track.marks?.[gs.at] !== undefined) {
    const p = track.samples[Math.round(track.marks[gs.at]) % track.length];
    const d = p.wall + 13;
    stand = { x: p.x - Math.sin(p.h) * gs.side * d, z: p.z + Math.cos(p.h) * gs.side * d, y: p.y ?? 0 };
  }
  // ジャンプの地面のない所（Kyugo Mountain。2026-10-19 のユーザー依頼「着地するところがわかりにくい。崖をしっかり描いて」）:
  // 地面は、両はしの道より GAP_DROP m 低く（着地の道の手前まで、道と同じ高さの雪が続いて見えないように）
  const gaps = new Map();
  for (let i = 0; i < track.length; i++) {
    const p = track.samples[i];
    if (p.y !== null || p.tunnel) continue;
    let a = p;
    let b = p;
    for (let k = 0; k < 200 && a.y === null; k++) a = track.samples[a.prev];
    for (let k = 0; k < 200 && b.y === null; k++) b = track.samples[b.next];
    if (a.y === null || b.y === null) continue;
    const key = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`;
    if (!gaps.has(key)) gaps.set(key, []);
    gaps.get(key).push({ p, floor: Math.min(a.y, b.y) - GAP_DROP });
  }
  const c = { grid, river, tunnel, stand, gaps, reach: Math.max(...pts.map((p) => p.wall)) + FALL };
  cache.set(track, c);
  return c;
}

function riverDistance(river, x, z) {
  let best = Infinity;
  for (let k = 0; k + 1 < river.length; k++) {
    const a = river[k];
    const b = river[k + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(a.x + dx * u - x, a.z + dz * u - z));
  }
  return best;
}

// (x, z) の地面の高さ（m）
export function terrainHeight(track, x, z) {
  const { grid, river, tunnel, stand, gaps, reach } = prep(track);
  const span = Math.ceil(reach / CELL);
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  let sum = 0;
  let weight = 0;
  let cap = Infinity; // すぐ近くの道より高くしない
  let onRoad = false;
  // 道のふちから NEAR m までは、いちばん近い道の点より高くしない（坂で、少し後ろの低い点に引っぱられないように）
  let bestE = Infinity;
  const close = [];
  const edgeNear = []; // ふちから 4m 以内の道の点
  for (let gx = cx - span; gx <= cx + span; gx++) {
    for (let gz = cz - span; gz <= cz + span; gz++) {
      for (const p of grid.get(`${gx},${gz}`) ?? []) {
        const e = Math.hypot(p.x - x, p.z - z) - p.wall; // 道のふちからの距離（道の上はマイナス）
        if (e > FALL) continue;
        if (e <= 0) cap = Math.min(cap, p.y); // その場所を通る道より高くしない
        if (e <= NEAR) close.push([e, p.y]);
        if (e <= 4) edgeNear.push(p);
        bestE = Math.min(bestE, e);
        if (e <= 0) onRoad = true;
        // 近い道ほど強く効く（遠い道に引っぱられないように）
        const w = 1 / Math.max(e, 0.5) ** 4;
        sum += w * p.y * (1 - smooth(0, FALL, e));
        weight += w;
      }
    }
  }
  // いちばん近い点とほぼ同じ近さ（0.15m 以内）の点だけで、高さの上限を決める
  for (const [e, y] of close) if (e <= bestE + 0.15) cap = Math.min(cap, y);
  let y = weight ? Math.min(sum / weight, cap) : 0;
  // 雪山（Kyugo Mountain）: 道から離れた所に山。トンネルの上は、天井より高い山でおおう
  if (track.peaks?.length && !onRoad) {
    let peak = 0;
    for (const pk of track.peaks) {
      const d = Math.hypot(pk.x - x, pk.z - z);
      if (d < pk.r) peak = Math.max(peak, pk.h * (1 - (d / pk.r) ** 2) ** 2);
    }
    y = Math.max(y, Math.min(y + peak, y + peak * smooth(GRID, GRID + PEAK_CLEAR, bestE)));
  }
  if (stand) {
    const f = 1 - smooth(STAND_FLAT, STAND_FLAT + 30, Math.hypot(stand.x - x, stand.z - z));
    y = y * (1 - f) + Math.min(y, stand.y - 0.1) * f;
  }
  // 川（山の中でも、川の所は低く）
  if (!onRoad && river.length > 1) {
    const f = 1 - smooth(RIVER_FULL, RIVER_EDGE, riverDistance(river, x, z));
    y = y * (1 - f) + RIVER_DEPTH * f;
  }
  // ジャンプの地面のない所の下は低く（下を通るほかの道のふちから 4m までは、その道に合わせたまま）
  const L = track.length;
  for (let gx = cx - 1; gx <= cx + 1; gx++) {
    for (let gz = cz - 1; gz <= cz + 1; gz++) {
      for (const { p, floor } of gaps.get(`${gx},${gz}`) ?? []) {
        let low = floor;
        for (const q of edgeNear) if (q.path !== p.path || Math.min(Math.abs(q.s - p.s), L - Math.abs(q.s - p.s)) > 60) low = Math.max(low, q.y);
        const fwd = (x - p.x) * Math.cos(p.h) + (z - p.z) * Math.sin(p.h);
        const lat = -(x - p.x) * Math.sin(p.h) + (z - p.z) * Math.cos(p.h);
        if (Math.abs(fwd) <= 0.6 && Math.abs(lat) <= p.wall + 3) y = Math.min(y, low);
      }
    }
  }
  // トンネルの横と上だけ（トンネルの点から、道に直角の向きに COVER m まで）をおおう。入口・出口の手前の道にはかぶせない。
  // ほかの道（トンネルでない道）の上にもかぶせない（2026-10-18 のユーザー依頼「入口が壁のようにふさがれて見える」）
  let cover = -Infinity;
  if (bestE > NEAR) {
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gz = cz - 1; gz <= cz + 1; gz++) {
        for (const p of tunnel.get(`${gx},${gz}`) ?? []) {
          const fwd = (x - p.x) * Math.cos(p.h) + (z - p.z) * Math.sin(p.h);
          const lat = -(x - p.x) * Math.sin(p.h) + (z - p.z) * Math.cos(p.h);
          if (Math.abs(fwd) <= 1.5 && Math.abs(lat) < p.wall + COVER) cover = Math.max(cover, p.y + TUNNEL_HEIGHT + 2);
        }
      }
    }
  }
  return Math.max(y, cover);
}

// コースのまわりの地面（GRID m のます目）。道の下の所は少し下げる（ます目の間で、道の上に地面が出ないように）
export function buildTerrain(track) {
  const { samples } = track;
  const xs = samples.map((p) => p.x);
  const zs = samples.map((p) => p.z);
  const x0 = Math.min(...xs) - MARGIN;
  const z0 = Math.min(...zs) - MARGIN;
  const nx = Math.ceil((Math.max(...xs) + MARGIN - x0) / GRID);
  const nz = Math.ceil((Math.max(...zs) + MARGIN - z0) / GRID);
  const meshY = meshHeightOf(track);
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = x0 + i * GRID;
      const z = z0 + j * GRID;
      pos.set([x, meshY(x, z), z], (j * (nx + 1) + i) * 3);
    }
  }
  const index = [];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + nx + 1;
      const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: track.def.theme === 'snow' ? SNOW_COLOR : COLOR })));
  group.add(buildShoulders(track));
  return group;
}

// 地面の形の、ます目の点の高さ（buildTerrain と、道のふちの土手の外のはし。2026-10-18: 土手だけが急な坂になっていた）
// 道の下の点は少し下げる（ます目の間で、道の上に地面が出ないように）
const meshCache = new WeakMap();
function meshHeightOf(track) {
  if (meshCache.has(track)) return meshCache.get(track);
  const { grid } = prep(track);
  const under = (x, z) => {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gz = cz - 1; gz <= cz + 1; gz++) {
        for (const p of grid.get(`${gx},${gz}`) ?? []) if (Math.hypot(p.x - x, p.z - z) < p.wall) return true;
      }
    }
    return false;
  };
  // トンネル（Kyugo Mountain）: トンネルの道と、両わき（壁の外 2 × GRID m）までの地面のます目の点は、道より下へ。雪山はその外がわ。
  // ます目は粗い（GRID m）ので、トンネルの上に山の面を作ると、ます目の三角がトンネルの中を横切って、入口や中が白い面でふさがって見えた
  // （2026-10-18 のユーザー依頼「入口がふさがって見える」「トンネル内で壁のように」）
  const { tunnel } = prep(track);
  const outOfTunnel = (x, z, y) => {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    let out = y;
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gz = cz - 1; gz <= cz + 1; gz++) {
        for (const p of tunnel.get(`${gx},${gz}`) ?? []) {
          const fwd = (x - p.x) * Math.cos(p.h) + (z - p.z) * Math.sin(p.h);
          const lat = -(x - p.x) * Math.sin(p.h) + (z - p.z) * Math.cos(p.h);
          if (Math.abs(fwd) > GRID || Math.abs(lat) > p.wall + 0.5 + 2 * GRID) continue;
          out = Math.min(out, p.y - 1);
        }
      }
    }
    return out;
  };
  // 雪山（Kyugo Mountain）: 道のふちから地面のます目 1つ分までの点は、近くの道より高くしない（ます目の三角が道の上にかぶらないように）
  const snow = track.def.theme === 'snow';
  const nearRoadY = (x, z) => {
    let low = Infinity;
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gz = cz - 1; gz <= cz + 1; gz++) {
        for (const p of grid.get(`${gx},${gz}`) ?? []) if (Math.hypot(p.x - x, p.z - z) < p.wall + GRID * 1.5) low = Math.min(low, p.y);
      }
    }
    return low;
  };
  const fn = (x, z) => {
    let y = terrainHeight(track, x, z) - 0.15 - (under(x, z) ? 1 : 0);
    if (snow) y = Math.min(y, nearRoadY(x, z) - 0.3);
    if (snow) y = outOfTunnel(x, z, y);
    return y;
  };
  meshCache.set(track, fn);
  return fn;
}

// 道のふち（柵）の外の草の坂: 道の高さから、SHOULDER m 先の地面の高さへ。ほかの道の上にはかけない
function buildShoulders(track) {
  const { samples } = track;
  const meshY = meshHeightOf(track);
  const { grid } = prep(track);
  // (x, z) が、ほかの道（self の道の近くはのぞく）の柵の内側か
  const onOther = (x, z, self) => {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    for (let gx = cx - 2; gx <= cx + 2; gx++) {
      for (let gz = cz - 2; gz <= cz + 2; gz++) {
        for (const p of grid.get(`${gx},${gz}`) ?? []) {
          if (p.path === self.path && Math.min(Math.abs(p.s - self.s), track.length - Math.abs(p.s - self.s)) < 40) continue;
          if (Math.hypot(p.x - x, p.z - z) < p.wall + 1) return true;
        }
      }
    }
    return false;
  };
  const ok = (p) => p.y !== null && !p.bridge && !p.ramp && !p.tunnel;
  const pos = [];
  for (const side of [-1, 1]) {
    const edge = samples.map((p) => {
      if (!ok(p)) return null;
      const rx = -Math.sin(p.h) * side;
      const rz = Math.cos(p.h) * side;
      const ox = p.x + rx * (p.wall + SHOULDER);
      const oz = p.z + rz * (p.wall + SHOULDER);
      // 草の坂の、まん中や道のそばも、ほかの道にかからないか（分かれる所・合流する所）
      for (const f of [0.15, 0.5, 1]) {
        const d = p.wall + SHOULDER * f;
        if (onOther(p.x + rx * d, p.z + rz * d, p)) return null;
      }
      return {
        a: [p.x + rx * p.wall, p.y + 0.02, p.z + rz * p.wall],
        b: [ox, track.def.theme === 'snow' ? meshY(ox, oz) : terrainHeight(track, ox, oz) - 0.15, oz],
      };
    });
    samples.forEach((p, i) => {
      const q = p.next ?? (i + 1) % samples.length;
      const e = edge[i];
      const f = edge[q];
      if (!e || !f) return;
      // 表が上を向くように、側で順番を変える
      if (side > 0) pos.push(...e.a, ...f.a, ...e.b, ...e.b, ...f.a, ...f.b);
      else pos.push(...e.a, ...e.b, ...f.a, ...e.b, ...f.b, ...f.a);
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: track.def.theme === 'snow' ? SNOW_COLOR : COLOR, side: THREE.DoubleSide }));
}
