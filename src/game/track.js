// コースのデータから1mごとの点の並びを作り、位置からコース上の場所を求める
export const SAMPLE_STEP = 1;

// 4つの点 p0〜p3 のうち、p1 から p2 までをなめらかにつなぐ線（centripetal Catmull-Rom）
function catmullRom(p0, p1, p2, p3, steps) {
  const knot = (a, b) => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1]));
  const t1 = knot(p0, p1);
  const t2 = t1 + knot(p1, p2);
  const t3 = t2 + knot(p2, p3);
  const mix = (a, b, ta, tb, t) => [
    ((tb - t) * a[0] + (t - ta) * b[0]) / (tb - ta),
    ((tb - t) * a[1] + (t - ta) * b[1]) / (tb - ta),
  ];
  const out = [];
  for (let k = 0; k < steps; k++) {
    const t = t1 + ((t2 - t1) * k) / steps;
    const a1 = mix(p0, p1, 0, t1, t);
    const a2 = mix(p1, p2, t1, t2, t);
    const a3 = mix(p2, p3, t2, t3, t);
    const b1 = mix(a1, a2, 0, t2, t);
    const b2 = mix(a2, a3, t1, t3, t);
    out.push(mix(b1, b2, t1, t2, t));
  }
  return out;
}

// 閉じたなめらかな線を細かい折れ線にする
function smoothLoop(points) {
  const n = points.length;
  const line = [];
  for (let i = 0; i < n; i++) {
    line.push(...catmullRom(points[(i - 1 + n) % n], points[i], points[(i + 1) % n], points[(i + 2) % n], 40));
  }
  return line;
}

// 折れ線を、決めた長さ（m）に大きくして、1m ごとに点を取り直す。真ん中が (0, 0) になるように置く
function resample(line, length) {
  const seg = line.map((p, i) => Math.hypot(line[(i + 1) % line.length][0] - p[0], line[(i + 1) % line.length][1] - p[1]));
  const raw = seg.reduce((a, b) => a + b, 0);
  const k = length / raw;
  const xs = line.map((p) => p[0]);
  const zs = line.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const n = Math.round(length / SAMPLE_STEP);
  const out = [];
  let j = 0;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const want = ((i * length) / n) / k;
    while (acc + seg[j] < want) {
      acc += seg[j];
      j++;
    }
    const a = line[j];
    const b = line[(j + 1) % line.length];
    const t = seg[j] > 0 ? (want - acc) / seg[j] : 0;
    out.push({ x: (a[0] + (b[0] - a[0]) * t - cx) * k, z: (a[1] + (b[1] - a[1]) * t - cz) * k, s: (i * length) / n });
  }
  return out;
}

// 中心線が自分と交わる所を探す（となり合う部分は除く）
function findCrossings(samples) {
  const n = samples.length;
  const found = [];
  for (let i = 0; i < n; i++) {
    const a = samples[i];
    const b = samples[(i + 1) % n];
    for (let j = i + 50; j < n; j++) {
      if (n - (j - i) < 50) continue;
      const c = samples[j];
      const d = samples[(j + 1) % n];
      const den = (b.x - a.x) * (d.z - c.z) - (b.z - a.z) * (d.x - c.x);
      if (den === 0) continue;
      const t = ((c.x - a.x) * (d.z - c.z) - (c.z - a.z) * (d.x - c.x)) / den;
      const u = ((c.x - a.x) * (b.z - a.z) - (c.z - a.z) * (b.x - a.x)) / den;
      if (t >= 0 && t < 1 && u >= 0 && u < 1) {
        found.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, sA: a.s + t * SAMPLE_STEP, sB: c.s + u * SAMPLE_STEP, iA: i, iB: j });
      }
    }
  }
  return found;
}

function inRange(s, from, to) {
  return s >= from && s < to;
}

export function buildTrack(def) {
  const samples = resample(smoothLoop(def.points), def.length);
  const n = samples.length;
  for (let i = 0; i < n; i++) {
    const p = samples[i];
    const q = samples[(i + 1) % n];
    p.h = Math.atan2(q.z - p.z, q.x - p.x);
  }
  // ジャンプがあるコースは、交わる所がちょうど1か所
  let cross = null;
  if (def.jump) {
    const crossings = findCrossings(samples);
    if (crossings.length !== 1) throw new Error(`コースの交わる所は1か所のはず: ${crossings.length}`);
    cross = crossings[0];
  }
  const j = def.jump;
  const at = (d) => cross.sA + d;
  const fullWall = def.roadHalf + def.dirt;
  for (const p of samples) {
    p.y = 0;
    p.wall = fullWall;
    p.ramp = false;
    p.boost = false;
    p.noWall = false;
    if (!cross) continue;
    p.boost = inRange(p.s, at(j.boost.from), at(j.boost.to));
    if (inRange(p.s, at(j.ramp.from), at(j.ramp.to))) {
      p.ramp = true;
      p.y = (j.ramp.height * (p.s - at(j.ramp.from))) / (j.ramp.to - j.ramp.from);
      p.wall = def.roadHalf;
    }
    if (inRange(p.s, at(j.gap.from), at(j.gap.to))) {
      p.y = null;
      p.wall = def.roadHalf;
    }
    const dx = p.x - cross.x;
    const dz = p.z - cross.z;
    p.noWall = p.y === 0 && dx * dx + dz * dz < def.noWallRadius ** 2;
  }
  const startS = cross ? cross.sB - def.startBeforeCross : 0;
  const startIndex = samples.findIndex((p) => p.s >= startS);
  return { def, samples, length: def.length, roadHalf: def.roadHalf, startIndex, cross };
}

// 位置 (x, z) に一番近いコースの点を探す。hint（前の点の番号）があれば、その前後だけを探す
// （交わる所で、もう一方の道の点を拾わないため）
export function locate(track, x, z, hint = null, win = 40) {
  const { samples, length, roadHalf } = track;
  const n = samples.length;
  let best = 0;
  let bestD = Infinity;
  const scan = (i) => {
    const p = samples[i];
    const dx = x - p.x;
    const dz = z - p.z;
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  };
  if (hint === null) {
    for (let i = 0; i < n; i++) scan(i);
  } else {
    for (let k = -win; k <= win; k++) scan((((hint + k) % n) + n) % n);
  }
  const p = samples[best];
  const fx = Math.cos(p.h);
  const fz = Math.sin(p.h);
  const dx = x - p.x;
  const dz = z - p.z;
  // 右向きの距離（右が正）
  const lateral = dx * -fz + dz * fx;
  const s = ((((p.s + dx * fx + dz * fz) % length) + length) % length);
  const a = Math.abs(lateral);
  const surface = a <= roadHalf ? 'road' : a <= p.wall ? 'dirt' : 'out';
  return {
    i: best,
    s,
    lateral,
    heading: p.h,
    ground: p.y,
    wall: p.wall,
    surface,
    boost: p.boost && a <= roadHalf,
  };
}

// 落ちた所 i から戻って、平らな地面が10m続いた所を、戻る場所にする
export function respawnIndex(track, i) {
  const { samples } = track;
  const n = samples.length;
  let run = 0;
  for (let k = 1; k < n; k++) {
    const j = (((i - k) % n) + n) % n;
    const p = samples[j];
    const flat = p.y === 0 && !p.ramp && !p.boost;
    run = flat ? run + 1 : 0;
    if (run >= 10) return j;
  }
  return track.startIndex;
}
