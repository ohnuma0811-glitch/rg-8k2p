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

// 折れ線を、決めた長さ（m）にするための大きさの倍率 k と、真ん中 (cx, cz)
function fitOf(line, length) {
  const seg = line.map((p, i) => Math.hypot(line[(i + 1) % line.length][0] - p[0], line[(i + 1) % line.length][1] - p[1]));
  const raw = seg.reduce((a, b) => a + b, 0);
  const xs = line.map((p) => p[0]);
  const zs = line.map((p) => p[1]);
  return { seg, k: length / raw, cx: (Math.min(...xs) + Math.max(...xs)) / 2, cz: (Math.min(...zs) + Math.max(...zs)) / 2 };
}

// 折れ線を、決めた長さ（m）に大きくして、1m ごとに点を取り直す。真ん中が (0, 0) になるように置く
function resample(line, length) {
  const { seg, k, cx, cz } = fitOf(line, length);
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

// カーブの半径が minR より小さい所だけを、少しずつならす（カーブの内側で、道・柵・土手が折れ返らないように）
// 形と長さは保つ（ならしたあと、もう一度 1m ごとに取り直す）。直らなければ、ならす範囲を広げていく
function limitCurvature(samples, minR, length) {
  let pts = samples.map((p) => [p.x, p.z]);
  for (let round = 0; round < 300; round++) {
    const n = pts.length;
    const radius = (i) => {
      const a = pts[(i - 3 + n) % n];
      const b = pts[i];
      const c = pts[(i + 3) % n];
      const h1 = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const h2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
      const turn = Math.abs(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1)));
      // 3m ずつの2本の弦の向きの差が、円の 3m 分の角度（半径 = 3m ÷ 角度）
      return turn < 1e-9 ? Infinity : Math.hypot(c[0] - a[0], c[1] - a[1]) / 2 / turn;
    };
    const bad = new Set();
    for (let i = 0; i < n; i++) {
      if (radius(i) < minR) for (let k = -8 - (round >> 3); k <= 8 + (round >> 3); k++) bad.add((i + k + n) % n);
    }
    if (bad.size === 0) break;
    for (let pass = 0; pass < 2; pass++) {
      const next = pts.map((p) => [...p]);
      for (const i of bad) {
        const a = pts[(i - 1 + n) % n];
        const c = pts[(i + 1) % n];
        next[i] = [pts[i][0] + 0.5 * ((a[0] + c[0]) / 2 - pts[i][0]), pts[i][1] + 0.5 * ((a[1] + c[1]) / 2 - pts[i][1])];
      }
      pts = next;
    }
    pts = resample(pts, length).map((p) => [p.x, p.z]);
  }
  return resample(pts, length);
}

// 絵の点 pt の、コースの上の場所 s（一番近い1mごとの点）
function pointS(samples, fit, pt) {
  const x = (pt[0] - fit.cx) * fit.k;
  const z = (pt[1] - fit.cz) * fit.k;
  let best = samples[0];
  let bestD = Infinity;
  for (const p of samples) {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best.s;
}

// ロータリーの島の、道を広げる長さ（島の中心から前後に m）
export function islandReach(track, island) {
  return island.r + track.roadHalf + 12;
}

// s のまわりにある島（なければ null）
export function islandNear(track, s) {
  return (track.islands ?? []).find((isl) => Math.min(span(track, isl.s, s), span(track, s, isl.s)) < islandReach(track, isl)) ?? null;
}

// a から b まで、走る向きに進む長さ（m）
export function span(track, a, b) {
  const L = track.length;
  return (((b - a) % L) + L) % L;
}

// 場所の書き方: 'S' はスタート（s = 0）。[from, to, t] は印 from から印 to へ t の割合（to が 'S' なら1周の終わり）
export function markS(track, ref) {
  if (ref === 'S') return 0;
  const [from, to, t] = ref;
  const a = from === 'S' ? 0 : track.marks[from];
  const b = to === 'S' ? track.length : track.marks[to];
  const d = to === 'S' ? b - a : span(track, a, b);
  return a + d * t;
}

// s が from から to の間か（1周の切れ目をまたいでもよい）
export function between(track, s, from, to) {
  return span(track, from, s) < span(track, from, to);
}

export function buildTrack(def) {
  const line = smoothLoop(def.points);
  const fit = fitOf(line, def.length);
  let samples = resample(line, def.length);
  // 柵まで（道幅の半分＋ダート）より半径が小さいカーブは、ならす
  samples = limitCurvature(samples, def.roadHalf + def.dirt + 0.5, def.length);
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
    p.half = def.roadHalf; // 道の半分の幅（ロータリーの所は広い）
    p.median = 0; // 分離帯の半分の幅（なければ 0）
    p.boostTime = 0; // 加速板の加速の時間（秒）
    if (!cross) continue;
    p.boost = inRange(p.s, at(j.boost.from), at(j.boost.to));
    if (p.boost) p.boostTime = 1.0;
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
  const t = { def, samples, length: def.length, roadHalf: def.roadHalf, startIndex, cross, marks: {} };
  for (const [name, i] of Object.entries(def.marks ?? {})) t.marks[name] = pointS(samples, fit, def.points[i]);
  // ロータリー: 真ん中に島を置き、島のまわりだけ道を広げる（島の両側を道の幅で走れる）
  t.islands = [];
  for (const rb of def.roundabouts ?? []) {
    const p = samples[Math.round(markS(t, rb.at)) % samples.length];
    const island = { x: p.x, z: p.z, r: rb.r, s: p.s };
    t.islands.push(island);
    const reach = islandReach(t, island);
    for (const q of samples) {
      const d = Math.min(span(t, island.s, q.s), span(t, q.s, island.s));
      if (d >= reach) continue;
      // なめらかに広げる（中心で島の半径だけ広い）
      const bulge = rb.r * Math.cos(((d / reach) * Math.PI) / 2) ** 2;
      q.half = Math.max(q.half, def.roadHalf + bulge);
      q.wall = q.half + def.dirt;
    }
  }
  for (const m of def.medians ?? []) {
    const from = markS(t, m.from);
    const to = markS(t, m.to);
    // ロータリーの所には分離帯を通さない
    for (const p of samples) if (between(t, p.s, from, to) && p.half === def.roadHalf) p.median = m.half;
  }
  for (const pad of def.pads ?? []) {
    const at = markS(t, pad.at);
    for (const p of samples) {
      if (between(t, p.s, at, at + pad.len)) {
        p.boost = true;
        p.boostTime = pad.time;
      }
    }
  }
  return t;
}

// 位置 (x, z) に一番近いコースの点を探す。hint（前の点の番号）があれば、その前後だけを探す
// （交わる所で、もう一方の道の点を拾わないため）
export function locate(track, x, z, hint = null, win = 40) {
  const { samples, length } = track;
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
  // 分離帯（芝生）の上はダートと同じ
  const onRoad = a <= p.half && !(p.median > 0 && a < p.median);
  const surface = onRoad ? 'road' : a <= p.wall ? 'dirt' : 'out';
  return {
    i: best,
    s,
    lateral,
    heading: p.h,
    ground: p.y,
    wall: p.wall,
    half: p.half,
    surface,
    boost: p.boost && onRoad,
    boostTime: p.boostTime,
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
