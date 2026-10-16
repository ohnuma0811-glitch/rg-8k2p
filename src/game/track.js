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

// 開いたなめらかな線（分かれ道）。はしの外に、はしの向きのまま延ばした点を足して、はしまでなめらかに
// （同じ点をくり返すと、なめらかにする計算が 0 で割ることになる）
function smoothOpen(points) {
  const n = points.length;
  const at = (i) => {
    if (i < 0) return [2 * points[0][0] - points[1][0], 2 * points[0][1] - points[1][1]];
    if (i > n - 1) return [2 * points[n - 1][0] - points[n - 2][0], 2 * points[n - 1][1] - points[n - 2][1]];
    return points[i];
  };
  const line = [];
  for (let i = 0; i < n - 1; i++) line.push(...catmullRom(at(i - 1), at(i), at(i + 1), at(i + 2), 40));
  line.push(points[n - 1]);
  return line;
}

// 開いた折れ線の、はしからはしまでを、約 1m ごとに取り直す（はしの2点はのぞく）
function resampleOpen(line) {
  const seg = [];
  let total = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const d = Math.hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]);
    seg.push(d);
    total += d;
  }
  const count = Math.max(1, Math.round(total / SAMPLE_STEP) - 1);
  const step = total / (count + 1);
  const out = [];
  let j = 0;
  let acc = 0;
  for (let k = 1; k <= count; k++) {
    const want = k * step;
    while (j < seg.length - 1 && acc + seg[j] < want) {
      acc += seg[j];
      j++;
    }
    const t = seg[j] > 0 ? (want - acc) / seg[j] : 0;
    out.push({ x: line[j][0] + (line[j + 1][0] - line[j][0]) * t, z: line[j][1] + (line[j + 1][1] - line[j][1]) * t });
  }
  return { points: out, step, total };
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

// スタートのとき、バスを置かない所（スタートの線から前へ・うしろへ m）と、その間にバスが動く長さ（13m/s で 3秒のカウント＋3秒）
export const BUS_HIDE_AHEAD = 300;
export const BUS_HIDE_BACK = 200;
const BUS_HIDE_MOVE = 13 * 6;

// 直角の角の、ほんとうの角（道の真ん中の線どうしが交わる所）と、入ってくる向き u・曲がった先の向き v
export function cornerCenter(track, s) {
  const n = track.samples.length;
  const at = (k) => track.samples[((Math.round(k) % n) + n) % n];
  // 向きは、角の丸めの外の2点を結んで決める
  const a1 = at(s - 32), a2 = at(s - 16), b1 = at(s + 16), b2 = at(s + 32);
  const ul = Math.hypot(a2.x - a1.x, a2.z - a1.z), vl = Math.hypot(b2.x - b1.x, b2.z - b1.z);
  const ux = (a2.x - a1.x) / ul, uz = (a2.z - a1.z) / ul;
  const vx = (b2.x - b1.x) / vl, vz = (b2.z - b1.z) / vl;
  const den = ux * vz - uz * vx;
  const k = ((b1.x - a2.x) * vz - (b1.z - a2.z) * vx) / den;
  return { x: a2.x + ux * k, z: a2.z + uz * k, ux, uz, vx, vz, s: at(s).s };
}

// 点 (x, z) の、角 c の向きでの場所: u（入ってくる向き）と w（曲がる向きと反対 = 外側の向き -v）
export function cornerUW(c, x, z) {
  const dx = x - c.x;
  const dz = z - c.z;
  return { u: dx * c.ux + dz * c.uz, w: -(dx * c.vx + dz * c.vz) };
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
    // 点のつながり（分かれ道があるコースでも、本線の点は 0〜n-1 の輪）
    p.path = 0;
    p.next = (i + 1) % n;
    p.prev = (i - 1 + n) % n;
    p.along = p.s;
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
    const island = { x: p.x, z: p.z, r: rb.r, s: p.s, brick: !!rb.brick };
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
  // 町の直角の角（2026-10-15 のユーザー依頼「交差点はカーブではなく直角に」）: 道の真ん中の線は少し丸いままだが、
  // 角の外側は四角くし、四角のすみまで走れるようにする（外側の壁は、四角の2本のまっすぐな線 u = W と w = W）
  t.corners = [];
  for (const ref of def.squareCorners ?? []) {
    const c = cornerCenter(t, markS(t, ref));
    c.W = fullWall;
    t.corners.push(c);
    for (const p of samples) {
      if (Math.min(span(t, c.s, p.s), span(t, p.s, c.s)) > 45) continue;
      // 外側（右か左か）と、その向き
      const rx = -Math.sin(p.h), rz = Math.cos(p.h);
      const side = rx * (c.ux - c.vx) + rz * (c.uz - c.vz) > 0 ? 1 : -1;
      const nx = rx * side, nz = rz * side;
      const o = cornerUW(c, p.x, p.z);
      const nu = nx * c.ux + nz * c.uz;
      const nw = -(nx * c.vx + nz * c.vz);
      let d = Infinity;
      if (nu > 1e-6) d = Math.min(d, (c.W - o.u) / nu);
      if (nw > 1e-6) d = Math.min(d, (c.W - o.w) / nw);
      if (!(d > p.wall) || d === Infinity) continue;
      p.outerSide = side;
      p.wallOuter = Math.min(d, c.W * 2.5);
    }
  }
  t.bumps = (def.bumps ?? []).map((ref) => markS(t, ref)); // バンプの場所（s）
  // 牛: 区間の中に等しい間をあけて並べ、牛ごとに動く速さとタイミングをずらす
  // イノシシ（Soki Forest。2026-10-16）: at の所。side はかくれている側、period は周期（秒）、phase はずらし（秒）
  t.boars = (def.boars ?? []).map((b) => ({ s: markS(t, b.at), side: b.side, period: b.period, phase: b.phase }));
  t.cows = [];
  if (def.cows) {
    const from = markS(t, def.cows.from);
    const len = span(t, from, markS(t, def.cows.to));
    for (let k = 0; k < def.cows.count; k++) {
      t.cows.push({ s: (from + (len * (k + 0.5)) / def.cows.count) % t.length, period: 24 + k * 5, phase: k * 2.1 });
    }
  }
  // スクールバス（2026-10-16 のユーザー依頼）: 1周に等しい間をあけて並べる。動きは src/game/hazards.js の busPose
  t.buses = [];
  // スタートの前後（うしろ BUS_HIDE_BACK m 〜 前 BUS_HIDE_AHEAD m）には、スタートの前（カメラが回る間・カウント）から
  // スタートして少しの間まで、バスが見えないように並べる（2026-10-16 のユーザー依頼）。その外に等しい間で
  if (def.buses) {
    const from = BUS_HIDE_AHEAD + BUS_HIDE_MOVE;
    const to = t.length - BUS_HIDE_BACK - BUS_HIDE_MOVE;
    for (let k = 0; k < def.buses; k++) t.buses.push({ s0: from + ((to - from) * k) / Math.max(1, def.buses - 1) });
  }
  for (const pad of def.pads ?? []) {
    const at = markS(t, pad.at);
    for (const p of samples) {
      if (between(t, p.s, at, at + pad.len)) {
        p.boost = true;
        p.boostTime = pad.time;
        p.boostSide = pad.side ?? 0; // 片側だけの加速板（1 右、-1 左、0 道の幅いっぱい）
      }
    }
  }
  applyHeights(t, def);
  applyJumps(t, def);
  addBranches(t, def, fit);
  return t;
}

// 場所の書き方（'S'、印の名前、[印, 印, 割合]）→ s
function refS(t, ref) {
  if (ref === 'S') return 0;
  if (typeof ref === 'string') return t.marks[ref];
  return markS(t, ref);
}

// キーの間を、なめらかに（1 - cos）つなぐ。keys = [[位置, 高さ], ...]（位置の順）。位置は 0〜len、loop なら輪
function smoothKeys(keys, x, len, loop) {
  if (!keys.length) return 0;
  let a = keys[keys.length - 1];
  let b = keys[0];
  for (let k = 0; k < keys.length; k++) {
    if (keys[k][0] > x) {
      b = keys[k];
      a = k > 0 ? keys[k - 1] : loop ? [keys[keys.length - 1][0] - len, keys[keys.length - 1][1]] : keys[0];
      break;
    }
    if (k === keys.length - 1) {
      a = keys[k];
      b = loop ? [keys[0][0] + len, keys[0][1]] : keys[k];
    }
  }
  if (b[0] === a[0]) return a[1];
  const f = (x - a[0]) / (b[0] - a[0]);
  return a[1] + (b[1] - a[1]) * (1 - Math.cos(Math.PI * f)) / 2;
}

// でこぼこ: amp × sin(2π × 長さ / wave)。はしの wave/2 で 0 から立ち上げる
function bump(amp, wave, d, len) {
  const edge = Math.min(1, Math.min(d, len - d) / (wave / 2));
  return amp * Math.sin((2 * Math.PI * d) / wave) * Math.max(0, edge);
}

// ジャンプ（Soki Forest。2026-10-16 のユーザー依頼「川をジャンプで2回飛び越える」）: 印 at からの m で、加速板・ジャンプ台・地面のない所
function applyJumps(t, def) {
  for (const j of def.jumps ?? []) {
    const at = refS(t, [j.at, j.at, 0]);
    const inSpan = (s, [a, b]) => { const d = ((s - at + t.length * 1.5) % t.length) - t.length / 2; return d >= a && d < b; };
    const rel = (s) => ((s - at + t.length * 1.5) % t.length) - t.length / 2;
    for (let i = 0; i < t.length; i++) {
      const p = t.samples[i];
      if (inSpan(p.s, j.boost)) { p.boost = true; p.boostTime = 1.0; }
      if (inSpan(p.s, j.ramp)) {
        p.ramp = true;
        p.y += (j.ramp[2] * (rel(p.s) - j.ramp[0])) / (j.ramp[1] - j.ramp[0]);
        p.wall = def.roadHalf;
      }
      if (inSpan(p.s, j.gap)) { p.y = null; p.wall = def.roadHalf; }
    }
  }
}

// 本線の道の高さ（2026-10-16 のユーザー依頼「上下に波打つ」）と、でこぼこ
function applyHeights(t, def) {
  if (!def.heights && !def.bumpy) return;
  const keys = (def.heights ?? []).map(([ref, y]) => [refS(t, ref) % t.length, y]).sort((a, b) => a[0] - b[0]);
  const bumps = (def.bumpy ?? []).filter((b) => b.path === 'main').map((b) => ({ ...b, a: refS(t, b.from), b: refS(t, b.to) }));
  for (let i = 0; i < t.length; i++) {
    const p = t.samples[i];
    if (p.y === null) continue;
    p.y += smoothKeys(keys, p.s, t.length, true);
    for (const b of bumps) {
      if (!between(t, p.s, b.a, b.b)) continue;
      p.y += bump(b.amp, b.wave, span(t, b.a, p.s), span(t, b.a, b.b));
      p.bumpy = true;
    }
  }
}

// 分かれ道（2026-10-16 のユーザー依頼「複数の分岐」）: 点を samples の後ろに足し、分かれる所・合流する所とつなぐ。
// 分かれ道の点の s は、本線でいうとどこにあたるか（分かれる所の s から合流する所の s まで、長さに比例して増える）
function addBranches(t, def, fit) {
  const { samples } = t;
  t.paths = [{ id: 'main', start: 0, count: t.length, fork: null, join: null, len: t.length }];
  t.forks = {};
  t.joins = {};
  t.toWorld = (x, z) => ({ x: (x - fit.cx) * fit.k, z: (z - fit.cz) * fit.k });
  const half = def.branchHalf ?? def.roadHalf;
  for (const b of def.branches ?? []) {
    const [fromPath, fromAt] = b.from;
    let fork;
    if (fromPath === 'main') fork = Math.round(markS(t, [fromAt, fromAt, 0])) % t.length;
    else {
      const fp = t.paths.find((q) => q.id === fromPath);
      fork = fp.start + Math.round(fromAt * (fp.count - 1));
    }
    const join = Math.round(markS(t, [b.to, b.to, 0])) % t.length;
    const pf = samples[fork];
    const pj = samples[join];
    const pts = [[pf.x, pf.z], ...b.points.map(([x, z]) => { const w = t.toWorld(x, z); return [w.x, w.z]; }), [pj.x, pj.z]];
    const { points, step, total } = resampleOpen(smoothOpen(pts));
    const start = samples.length;
    const pathIndex = t.paths.length;
    const sFork = pf.s;
    const sSpan = span(t, sFork, pj.s);
    points.forEach((q, k) => {
      samples.push({
        x: q.x,
        z: q.z,
        s: (sFork + (sSpan * (k + 1)) / (points.length + 1)) % t.length,
        path: pathIndex,
        along: pf.along + step * (k + 1),
        prev: k === 0 ? fork : start + k - 1,
        next: k === points.length - 1 ? join : start + k + 1,
        y: 0,
        wall: half + def.dirt,
        half,
        ramp: false,
        boost: false,
        noWall: false,
        median: 0,
        boostTime: 0,
      });
    });
    for (let i = start; i < samples.length; i++) {
      const p = samples[i];
      const q = samples[p.next];
      p.h = Math.atan2(q.z - p.z, q.x - p.x);
    }
    // 高さ: はしは分かれる所・合流する所の高さ、あいだは b.heights（[割合, 高さ]）をなめらかに。でこぼこも
    const count = points.length;
    const hk = [[0, pf.y ?? 0], ...(b.heights ?? []).map(([f, y]) => [f * (count + 1), y]), [count + 1, pj.y ?? 0]];
    const bm = (def.bumpy ?? []).find((q) => q.path === b.id);
    for (let k = 0; k < count; k++) {
      const p = samples[start + k];
      p.y = smoothKeys(hk, k + 1, count + 1, false);
      if (bm && k / count >= bm.from && k / count <= bm.to) {
        const a = bm.from * count;
        p.y += bump(bm.amp, bm.wave, (k - a) * step, (bm.to - bm.from) * count * step);
        p.bumpy = true;
      }
    }
    (t.forks[fork] ??= []).push(pathIndex);
    (t.joins[join] ??= []).push(samples.length - 1);
    t.paths.push({ id: b.id, start, count: points.length, fork, join, len: total });
  }
  markBridges(t);
}

// 橋（2026-10-16 のユーザー依頼）: 本線が、高さが 4m 以上ちがうほかの道の上を通る所の前後 BRIDGE_REACH m を、橋の点にする
export const BRIDGE_REACH = 40;
function markBridges(t) {
  const { samples } = t;
  t.bridges = [];
  for (let i = t.length; i < samples.length; i++) {
    const q = samples[i];
    for (let j = 0; j < t.length; j++) {
      const p = samples[j];
      if (p.y === null || p.y - q.y < 4 || Math.hypot(p.x - q.x, p.z - q.z) > 1.5) continue;
      if (!t.bridges.some((b) => Math.abs(b.s - p.s) < BRIDGE_REACH)) t.bridges.push({ s: p.s, i: j, under: i });
    }
  }
  for (const p of samples.slice(0, t.length)) {
    if (t.bridges.some((b) => Math.min(span(t, b.s, p.s), span(t, p.s, b.s)) < BRIDGE_REACH)) p.bridge = true;
  }
}

// 点 i から k 個先の点の番号。分かれる所では choose(i, 分かれる道の番号の配列) が返す道へ（null なら本線のまま）
export function ahead(track, i, k, choose = null) {
  for (let c = 0; c < k; c++) {
    const forks = track.forks?.[i];
    const pick = forks && choose ? choose(i, forks) : null;
    i = pick !== null && pick !== undefined ? track.paths[pick].start : track.samples[i].next;
  }
  return i;
}

// 道 path の上（分かれる所から合流する所まで）で、さらに分かれる道の数（3本を同じ確率で選ぶため）
export function branchesBeyond(track, path) {
  const p = track.paths[path];
  let k = 0;
  for (let i = p.start; i < p.start + p.count; i++) k += (track.forks[i] ?? []).length;
  return k;
}

// 点 i から k 個前の点の番号（分かれ道の最初の点からは、分かれる所へもどる）
export function behind(track, i, k) {
  for (let c = 0; c < k; c++) i = track.samples[i].prev;
  return i;
}

// 位置 (x, z) に一番近いコースの点を探す。hint（前の点の番号）があれば、その前後だけを探す
// （交わる所で、もう一方の道の点を拾わないため）
// y（車の高さ）があれば、高さのちがう道（橋の上と下）の点は拾いにくくする
export function locate(track, x, z, hint = null, win = 40, y = null) {
  const { samples, length } = track;
  const n = samples.length;
  let best = 0;
  let bestD = Infinity;
  const scan = (i) => {
    const p = samples[i];
    const dx = x - p.x;
    const dz = z - p.z;
    const dy = y !== null && p.y !== null ? 3 * (p.y - y) : 0;
    const d = dx * dx + dz * dz + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  };
  if (hint === null) {
    for (let i = 0; i < n; i++) scan(i);
  } else {
    // hint から、点のつながり（前・次、分かれる所・合流する所）をたどって win 個まで
    const seen = new Set([hint]);
    let front = [hint];
    scan(hint);
    for (let d = 0; d < win && front.length; d++) {
      const nextFront = [];
      for (const i of front) {
        const p = samples[i];
        const near = [p.next, p.prev];
        if (track.forks?.[i]) for (const k of track.forks[i]) near.push(track.paths[k].start);
        if (track.joins?.[i]) near.push(...track.joins[i]);
        for (const j of near) {
          if (j === undefined || seen.has(j)) continue;
          seen.add(j);
          scan(j);
          nextFront.push(j);
        }
      }
      front = nextFront;
    }
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
  // 町の直角の角の外側は、四角のすみまで（道と同じ）
  const outer = p.outerSide && Math.sign(lateral) === p.outerSide;
  const wall = outer ? p.wallOuter : p.wall;
  const onRoad = (a <= p.half || (outer && a <= wall - 1)) && !(p.median > 0 && a < p.median);
  const surface = onRoad ? 'road' : a <= wall ? 'dirt' : 'out';
  return {
    i: best,
    path: p.path,
    s,
    lateral,
    heading: p.h,
    ground: groundAt(samples, p, dx * fx + dz * fz),
    wall,
    half: p.half,
    surface,
    boost: p.boost && onRoad && (!p.boostSide || Math.sign(lateral) === p.boostSide),
    boostTime: p.boostTime,
  };
}

// 点 p から前へ d m の所の地面の高さ（となりの点との間をなめらかにつなぐ。坂で上下の速さがぎざぎざにならないように）
function groundAt(samples, p, d) {
  if (p.y === null) return null;
  const q = samples[d >= 0 ? p.next : p.prev];
  if (q === undefined || q.y === null) return p.y;
  const len = Math.hypot(q.x - p.x, q.z - p.z) || 1;
  const f = Math.min(1, Math.abs(d) / len);
  return p.y + (q.y - p.y) * f;
}

// 落ちた所 i から戻って、平らな地面が10m続いた所を、戻る場所にする
export function respawnIndex(track, i) {
  const { samples } = track;
  const n = samples.length;
  let run = 0;
  let j = i;
  for (let k = 1; k < n; k++) {
    j = samples[j].prev;
    const p = samples[j];
    const flat = p.y === 0 && !p.ramp && !p.boost;
    run = flat ? run + 1 : 0;
    if (run >= 10) return j;
  }
  return track.startIndex;
}
