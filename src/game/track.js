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

// らせん（Kyugo Mountain。2026-10-18）: def.helix の at の点のあとに、右へ曲がり続ける円の点を turns 周ぶん足す。
// 地図の点は画素なので、1周の長さ def.length に合わせたときの 1画素の m（k）を先に計算して、半径 r m を画素にする
export const HELIX_PER_TURN = 16;
export function expandHelix(def) {
  if (!def.helix) return def;
  const { at, r, turns } = def.helix;
  const ai = def.marks[at];
  const line = smoothLoop(def.points);
  let px = 0;
  for (let k = 0; k < line.length; k++) {
    const a = line[k];
    const b = line[(k + 1) % line.length];
    px += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const k = (def.length - 2 * Math.PI * r * turns) / px; // m / 画素（らせんの長さを引いた残りに、絵の道を合わせる）
  const rp = r / k;
  const p = def.points[ai];
  const q = def.points[ai + 1];
  const h = Math.atan2(q[1] - p[1], q[0] - p[0]);
  // 円の中心は、入る向き h の右（x - sin h, z + cos h）。円の上の点は h から右回りに進む
  const cx = p[0] - Math.sin(h) * rp;
  const cz = p[1] + Math.cos(h) * rp;
  const circle = [];
  for (let n = 1; n <= turns * HELIX_PER_TURN; n++) {
    const a = h + (2 * Math.PI * n) / HELIX_PER_TURN;
    circle.push([cx + Math.sin(a) * rp, cz - Math.cos(a) * rp]);
  }
  const points = [...def.points.slice(0, ai + 1), ...circle, ...def.points.slice(ai + 1)];
  const marks = {};
  for (const [m, i] of Object.entries(def.marks)) marks[m] = i > ai ? i + circle.length : i;
  for (let n = 0; n <= turns; n++) marks[`HX${n}`] = ai + n * HELIX_PER_TURN;
  return { ...def, points, marks };
}

// 点が m のコース（Global City。2026-10-20）: 地図の画素ではなく m で書く。全長は点の並び（なめらかにした線）の長さ
function lineLength(line) {
  let total = 0;
  for (let i = 0; i < line.length; i++) {
    const a = line[i];
    const b = line[(i + 1) % line.length];
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return total;
}

export function buildTrack(def) {
  // 点が m のコース: らせんの半径も m のまま（expandHelix は def.length から 1画素の m を求めるので、先に点の長さを入れる）
  // scale: 全体の大きさの倍率（Global City は 0.8。名所の座標も toWorld で同じ倍率）
  const scale = def.meters ? def.scale ?? 1 : 1;
  if (def.meters) {
    def = { ...def, points: def.points.map(([x, z]) => [x * scale, z * scale]) };
    def = expandHelix({ ...def, length: Math.round(lineLength(smoothLoop(def.points))) });
    def = { ...def, length: Math.round(lineLength(smoothLoop(def.points))) };
  } else {
    def = expandHelix(def);
  }
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
  if (def.helix) {
    // らせんの段は上から見て同じ場所なので、印 HX1〜 は、前の段から道にそって1周（約 2πr）先の、いちばん近い点
    const turn = 2 * Math.PI * def.helix.r;
    for (let k = 1; k <= def.helix.turns; k++) {
      const a = samples[Math.round(t.marks[`HX${k - 1}`]) % n];
      let best = null;
      for (let d = Math.round(turn * 0.8); d <= Math.round(turn * 1.2); d++) {
        const q = samples[(Math.round(t.marks[`HX${k - 1}`]) + d) % n];
        const dd = Math.hypot(q.x - a.x, q.z - a.z);
        if (!best || dd < best.dd) best = { dd, s: q.s };
      }
      t.marks[`HX${k}`] = best.s;
    }
    t.helix = { from: Math.round(t.marks.HX0), to: Math.round(t.marks[`HX${def.helix.turns}`]), r: def.helix.r };
  }
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
  // 3頭の親子（真ん中が親、両わきが子。走ってくる車から見て横に BOAR_GAP m ずつ。2026-10-16 のユーザー依頼「縦ではなく横に」）が、同時に渡る
  t.boars = (def.boars ?? []).flatMap((b, f) => [-1, 0, 1].map((k) => ({
    s: markS(t, b.at) % t.length, offset: k * BOAR_GAP, side: b.side, period: b.period, phase: b.phase, family: f, size: k === 0 ? 1 : 0.7,
  })));
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
  applyHeights(t, def);
  applyJumps(t, def);
  applyKicks(t, def);
  for (const pad of def.pads ?? []) {
    let at = markS(t, pad.at);
    // crest: でこぼこの頂上（近くでいちばん高い所）に置く（2026-10-16 のユーザー依頼「底にあると踏めないことがある」）
    if (pad.crest) {
      let best = at;
      for (let d = -pad.crest; d <= pad.crest; d++) {
        const q = samples[Math.round(at + d + t.length) % t.length];
        if (q.y !== null && q.y > samples[Math.round(best + t.length) % t.length].y) best = at + d;
      }
      at = best - pad.len / 2;
    }
    for (const p of samples) {
      if (between(t, p.s, at, at + pad.len)) {
        p.boost = true;
        p.boostTime = pad.time;
        p.boostSide = pad.side ?? 0; // 片側だけの加速板（1 右、-1 左、0 道の幅いっぱい）
      }
    }
  }
  addBranches(t, def, fit);
  if (scale !== 1) {
    const toWorld = t.toWorld;
    t.toWorld = (x, z) => toWorld(x * scale, z * scale);
  }
  applyGrip(t, def);
  // 片道のコース（Global City。2026-10-20）: END から GB までは「無い道」（描かない・通れない）。ゴールは finish の印
  if (def.open) {
    t.open = true;
    t.finish = refS(t, def.open.finish);
    const from = refS(t, def.open.end);
    const to = refS(t, def.open.back);
    for (let i = 0; i < t.length; i++) {
      const p = t.samples[i];
      if (p.s === from || !between(t, p.s, from, to)) continue;
      p.void = true;
      p.y = null;
      p.wall = p.half;
    }
  }
  // ステージ（Global City）: 印の所から、その名前のステージ
  t.stages = (def.stages ?? []).map((st) => ({ name: st.name, s: refS(t, st.at) })).sort((a, b) => a.s - b.s);
  // 自動の区間（Global City）: from から legs の最後の to までの本線の点に p.auto
  t.autos = (def.autos ?? []).map((a) => ({ id: a.id, from: refS(t, a.from), legs: a.legs.map((l) => ({ to: refS(t, l.to), time: l.time })) }));
  for (const a of t.autos) {
    const to = a.legs[a.legs.length - 1].to;
    for (let i = 0; i < t.length; i++) if (between(t, t.samples[i].s, a.from, to)) t.samples[i].auto = a.id;
  }
  // トンネル（Kyugo Mountain・Global City）: いくつでも。dark のトンネルの点だけ暗くする（p.tunnel）。見た目は p.tunnelLook
  const tunnels = def.tunnels ?? (def.tunnel ? [{ ...def.tunnel, look: 'snow', dark: true }] : []);
  for (const tn of tunnels) {
    const from = refS(t, tn.from);
    const to = refS(t, tn.to);
    for (let i = 0; i < t.length; i++) {
      if (!between(t, t.samples[i].s, from, to)) continue;
      t.samples[i].tunnelLook = tn.look;
      if (tn.dark) t.samples[i].tunnel = true;
    }
  }
  // 雪山（地図の座標 → m）
  t.peaks = (def.peaks ?? []).map((pk) => ({ ...t.toWorld(pk.at[0], pk.at[1]), h: pk.h, r: pk.r, shape: pk.shape }));
  // スローの板（Kyugo Mountain）: 長さ 30m、はば 道の30%。道のはしに寄せる
  t.slows = (def.slows ?? []).map((sl) => {
    const from = Math.round(markS(t, sl.at)) % t.length;
    const half = 0.3 * def.roadHalf;
    return { from, to: (from + 30) % t.length, lateral: sl.side * (def.roadHalf - half), half };
  });
  // らせんの段（Kyugo Mountain）: 上から見て、同じ道のほかの段と重なる点
  if (t.helix) {
    for (let i = t.helix.from; i <= t.helix.to; i++) {
      for (let j = i + 60; j <= t.helix.to; j++) {
        if (Math.hypot(samples[i].x - samples[j].x, samples[i].z - samples[j].z) < samples[i].wall * 2) {
          samples[i].stacked = true;
          samples[j].stacked = true;
        }
      }
    }
  }
  // 恐竜（Soki Forest。2026-10-16）: ジャンプ at の川。from〜to は、食べられる所（at からの m。川の上）
  if (def.dino) {
    const j = (def.jumps ?? []).find((q) => q.at === def.dino.at);
    t.dino = { s: markS(t, [def.dino.at, def.dino.at, 0]), period: def.dino.period, phase: def.dino.phase, from: j.gap[0] - 2, to: j.gap[1] + 14 };
  }
  // ぬかるみ（Soki Forest。2026-10-16）: at は [道の id, 割合]、lateral は道の真ん中からの横の位置（m）、r は半径（m）
  t.muds = (def.muds ?? []).map((m) => {
    const path = t.paths.find((q) => q.id === m.at[0]);
    const i = path.start + Math.round(m.at[1] * (path.count - 1));
    const p = t.samples[i];
    return { i, r: m.r, x: p.x - Math.sin(p.h) * m.lateral, z: p.z + Math.cos(p.h) * m.lateral, y: p.y ?? 0 };
  });
  // 雪だるま（Kyugo Mountain。2026-10-18）: 1体ずつ、左右に動く周期と跳ねるタイミングをずらす
  t.snowmen = (def.snowmen ?? []).map((m, k) => {
    let i;
    const path = Array.isArray(m.at) && m.at.length === 2 ? t.paths.find((q) => q.id === m.at[0]) : null;
    if (path) i = path.start + Math.round(m.at[1] * (path.count - 1));
    else i = Math.round(refS(t, typeof m.at === 'string' ? [m.at, m.at, 0] : m.at) + (m.off ?? 0)) % t.length;
    return { i, s: t.samples[i].s, path: t.samples[i].path, period: 4 + (k % 3), phase: k * 1.3 };
  });
  // コブ（Kyugo Mountain）
  t.moguls = (def.moguls ?? []).map(([d, lateral]) => {
    const i = Math.round(refS(t, ['MG', 'MG', 0]) + d) % t.length;
    const p = t.samples[i];
    return { i, r: def.moguR, x: p.x - Math.sin(p.h) * lateral, z: p.z + Math.cos(p.h) * lateral, y: p.y ?? 0 };
  });
  // 道の上の動かない木（Soki Forest。2026-10-18 のユーザー依頼「コース中に30本、ランダムに」）
  t.trees = def.trees ? placeTrees(t, def.trees) : [];
  // サル（Soki Forest。2026-10-16）: at は [道の id, その道の上の割合]。木は side 側の道のふちから 3m 外
  t.monkeys = (def.monkeys ?? []).map((m) => {
    const path = t.paths.find((q) => q.id === m.at[0]);
    const i = path.start + Math.round(m.at[1] * (path.count - 1));
    const p = t.samples[i];
    const d = p.wall + 3;
    return { i, path: p.path, side: m.side, x: p.x - Math.sin(p.h) * m.side * d, z: p.z + Math.cos(p.h) * m.side * d, y: p.y ?? 0 };
  });
  return t;
}

// 道の上の木の場所: 決まった乱数（seed）で、本線と分かれ道の点からばらばらに選ぶ。置かない所:
// スタートの前後 100m、ジャンプ台・地面のない所・橋・加速板（とその前後）、分かれる所・合流する所の近く（ほかの道が近い所）、
// ぬかるみ・恐竜・イノシシの所。木どうしは TREE_GAP m より離す
const TREE_GAP = 25;
function placeTrees(t, { count, seed = 1 }) {
  const { samples } = t;
  let h = seed >>> 0;
  const rand = () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let x = Math.imul(h ^ (h >>> 15), 1 | h);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const s0 = samples[t.startIndex].s;
  const nearMain = (p, d) => p.path === 0 && Math.min(span(t, p.s, d), span(t, d, p.s));
  const okAt = (i) => {
    const p = samples[i];
    if (p.y === null || p.ramp || p.bridge) return false;
    if (p.path === 0 && nearMain(p, s0) < 100) return false;
    // 前後 15 点に、地面のない所・ジャンプ台・加速板がない
    for (const dir of ['next', 'prev']) {
      let k = i;
      for (let c = 0; c < 15; c++) {
        k = samples[k][dir];
        const q = samples[k];
        if (q.y === null || q.ramp || q.boost) return false;
      }
    }
    // ほかの道が近い所（分かれる所・合流する所・横に並ぶ所）
    for (const q of samples) {
      if (q.path === p.path || q.y === null) continue;
      if (Math.abs(q.x - p.x) < 40 && Math.abs(q.z - p.z) < 40 && Math.hypot(q.x - p.x, q.z - p.z) < p.wall + q.wall + 10 && Math.abs(q.y - p.y) < 4) return false;
    }
    // 上を別の道（橋）が通る所の近く（木の葉が橋の上に出て見えた。2026-10-19 のユーザー依頼）
    for (const q of samples) {
      if (q.y !== null && q.y > p.y + 1 && Math.abs(q.x - p.x) < 20 && Math.abs(q.z - p.z) < 20 && Math.hypot(q.x - p.x, q.z - p.z) <= 20) return false;
    }
    if ((t.muds ?? []).some((m) => Math.hypot(m.x - p.x, m.z - p.z) < m.r + 15)) return false;
    if (t.dino && p.path === 0 && nearMain(p, t.dino.s) < 70) return false;
    if ((t.boars ?? []).some((b) => p.path === 0 && nearMain(p, b.s) < 20)) return false;
    return true;
  };
  const out = [];
  for (let tries = 0; out.length < count && tries < 5000; tries++) {
    const i = Math.floor(rand() * samples.length);
    if (!okAt(i)) continue;
    const p = samples[i];
    const lateral = (rand() * 2 - 1) * (p.half - 3);
    const x = p.x - Math.sin(p.h) * lateral;
    const z = p.z + Math.cos(p.h) * lateral;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < TREE_GAP)) continue;
    out.push({ i, x, z, y: p.y, path: p.path, s: p.s, k: out.length });
  }
  return out;
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

// すべりやすさ（Kyugo Mountain。2026-10-18）: 点の grip（1 ふつう、小さいほどすべる）
export const GRIP_SNOW = 0.4; // 2026-10-18 のユーザー依頼「もう少し滑りやすく」で 0.6 から
export const GRIP_ICE = 0.05; // 同じく 0.25 から 0.12、2026-10-19 のユーザー依頼「凍結路面の滑り方があまり変化がない」で 0.05
function applyGrip(t, def) {
  for (const p of t.samples) p.grip = def.grip ?? 1;
  for (const a of def.asphalt ?? []) {
    const from = refS(t, a.from);
    const to = refS(t, a.to);
    for (let i = 0; i < t.length; i++) if (between(t, t.samples[i].s, from, to)) t.samples[i].grip = 1;
  }
  t.ices = (def.ices ?? []).map((ice) => {
    const from = Math.round(markS(t, ice.at)) % t.length;
    for (let k = 0; k < ice.len; k++) t.samples[(from + k) % t.length].grip = GRIP_ICE;
    return { from, to: (from + ice.len) % t.length };
  });
}

// 小さなジャンプ（Kyugo Mountain。2026-10-18）: 地面のある所で、ジャンプ台のいちばん上から決まった速さで小さく飛ぶ
function applyKicks(t, def) {
  t.kicks = [];
  for (const j of def.kicks ?? []) {
    const at = refS(t, [j.at, j.at, 0]);
    const rel = (s) => ((s - at + t.length * 1.5) % t.length) - t.length / 2;
    let top = null;
    for (let i = 0; i < t.length; i++) {
      const p = t.samples[i];
      const d = rel(p.s);
      if (d >= j.boost[0] && d < j.boost[1]) { p.boost = true; p.boostTime = 1.0; }
      if (d >= j.ramp[0] && d < j.ramp[1]) {
        p.ramp = true;
        p.y += (j.ramp[2] * (d - j.ramp[0])) / (j.ramp[1] - j.ramp[0]);
        if (top === null || rel(t.samples[top].s) < d) top = i;
      }
    }
    t.samples[top].kick = true;
    // 台のいちばん上の先に、同じ高さのふちを 1m（飛ぶ前に、下の地面へ下がりはじめないように）
    const lip = t.samples[t.samples[top].next];
    lip.y = t.samples[top].y;
    lip.ramp = true;
    t.kicks.push({ s: t.samples[top].s, top });
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
    const given = b.points.map(([x, z]) => { const w = t.toWorld(x, z); return [w.x, w.z]; });
    // 高速道路の合流（b.merge m）: 合流する所の手前 merge m は、本線の横に並び、だんだん近づいて1本になる
    const taper = [];
    if (b.merge) {
      const p0 = samples[(join - b.merge + t.length) % t.length];
      const [lx, lz] = given[given.length - 1];
      const side = Math.sign(-Math.sin(p0.h) * (lx - p0.x) + Math.cos(p0.h) * (lz - p0.z)) || 1;
      for (let d = b.merge; d > 4; d -= 8) {
        const p = samples[(join - d + t.length) % t.length];
        const lat = side * (def.roadHalf + half) * (1 - Math.cos((Math.PI * d) / b.merge)) / 2;
        taper.push([p.x - Math.sin(p.h) * lat, p.z + Math.cos(p.h) * lat]);
      }
    }
    const pts = [[pf.x, pf.z], ...given, ...taper, [pj.x, pj.z]];
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
    const bms = (def.bumpy ?? []).filter((q) => q.path === b.id);
    for (let k = 0; k < count; k++) {
      const p = samples[start + k];
      p.y = smoothKeys(hk, k + 1, count + 1, false);
      for (const bm of bms) {
        if (k / count < bm.from || k / count > bm.to) continue;
        const a = bm.from * count;
        p.y += bump(bm.amp, bm.wave, (k - a) * step, (bm.to - bm.from) * count * step);
        p.bumpy = true;
      }
    }
    // 合流で本線の横に並ぶ所は、本線と同じ高さ（段差なし）。その手前 40m でなめらかに近づける
    if (b.merge) {
      for (let k = 0; k < count; k++) {
        const d = (count - k) * step; // 合流する所までの長さ
        if (d > b.merge + 40) continue;
        const m = samples[(join - Math.round(d) + t.length) % t.length];
        const w = d <= b.merge ? 1 : (1 - Math.cos((Math.PI * (b.merge + 40 - d)) / 40)) / 2;
        const p = samples[start + k];
        p.y = p.y * (1 - w) + (m.y ?? 0) * w;
      }
    }
    // 分かれ道の加速板（Kyugo Mountain。at は分かれ道の上の割合）
    for (const pad of b.pads ?? []) {
      const a = Math.round(pad.at * (count - 1));
      for (let k = 0; k < pad.len; k++) {
        const q = samples[start + Math.min(count - 1, a + k)];
        q.boost = true;
        q.boostTime = pad.time;
        q.boostSide = 0;
      }
    }
    (t.forks[fork] ??= []).push(pathIndex);
    (t.joins[join] ??= []).push(samples.length - 1);
    t.paths.push({ id: b.id, start, count: points.length, fork, join, len: total });
  }
  markBridges(t);
}

// 橋（2026-10-16 のユーザー依頼。2026-10-18 に、分かれ道が上の所も）: 高さが 4m 以上ちがうほかの道の上を通る所の、
// 上の道の前後 BRIDGE_REACH m を、橋の点にする
export const BRIDGE_REACH = 40;
export const PIER_HALF_THICK = 1.0; // 橋脚の厚さの半分（本線の向き。m）
const PIER_OFFSETS = [-10.5, -3.5, 3.5, 10.5]; // 交わる所からの橋脚の場所（本線の向き。m）。すき間は 5m
const BOAR_GAP = 3.5; // イノシシの親子の間（m）
function markBridges(t) {
  const { samples } = t;
  t.bridges = [];
  // 上の道にそって前後へ BRIDGE_REACH 個（分かれ道のはしは本線へつながるので、ほかの道に出たら止める）
  const reachMark = (i) => {
    samples[i].bridge = true;
    for (const dir of ['next', 'prev']) {
      let k = i;
      for (let c = 0; c < BRIDGE_REACH; c++) {
        k = samples[k][dir];
        if (samples[k].path !== samples[i].path) break;
        samples[k].bridge = true;
      }
    }
  };
  for (let i = t.length; i < samples.length; i++) {
    const q = samples[i];
    for (let j = 0; j < t.length; j++) {
      const p = samples[j];
      if (p.y === null || q.y === null || Math.abs(p.y - q.y) < 4 || Math.hypot(p.x - q.x, p.z - q.z) > 1.5) continue;
      const [up, down] = p.y > q.y ? [j, i] : [i, j];
      const u = samples[up];
      if (t.bridges.some((b) => samples[b.i].path === u.path && Math.hypot(samples[b.i].x - u.x, samples[b.i].z - u.z) < BRIDGE_REACH)) continue;
      t.bridges.push({ s: u.s, i: up, under: down, path: u.path });
      reachMark(up);
    }
  }
  // 下の道の上の橋脚（2026-10-17 のユーザー依頼「写真のように橋の足を増やして、下を通りにくく」）。
  // 橋のはばいっぱいの石の壁を、本線にそって PIER_GAP m おきに。下の道は、壁と壁のすき間を通る（本線の橋だけ。def.piers が false のコースはなし）
  t.bridgePiers = [];
  if (t.def.piers === false) return;
  for (const b of t.bridges.filter((q) => q.path === 0)) {
    for (const off of PIER_OFFSETS) {
      const i = Math.round(b.s + off + t.length) % t.length;
      const p = samples[i];
      t.bridgePiers.push({ i, s: b.s + off, x: p.x, z: p.z, h: p.h, halfThick: PIER_HALF_THICK, halfLen: p.wall + 0.6, top: (p.y ?? 0) - 1.4 });
    }
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
// 点を探すます目（NEAR_CELL m ごとに、その中の点の番号）。track ごとに一度だけ作る
const NEAR_CELL = 30;
const nearGrids = new WeakMap();
function nearGrid(track) {
  if (!nearGrids.has(track)) {
    const grid = new Map();
    track.samples.forEach((p, i) => {
      const key = `${Math.floor(p.x / NEAR_CELL)},${Math.floor(p.z / NEAR_CELL)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(i);
    });
    nearGrids.set(track, grid);
  }
  return nearGrids.get(track);
}

// 点 i の前後 win 個に、分かれる所・合流する所がなく、ひと続きの道か（点ごとに覚えておく）
const straightMemo = new WeakMap();
function straightAround(track, i, win) {
  let memo = straightMemo.get(track);
  if (!memo || memo.win !== win) {
    memo = { win, ok: new Uint8Array(track.samples.length) };
    const { samples } = track;
    const n = samples.length;
    const special = (j) => (track.forks?.[j]?.length ?? 0) > 0 || (track.joins?.[j]?.length ?? 0) > 0;
    for (let k = 0; k < n; k++) {
      let ok = !special(k);
      const seen = new Set([k]);
      let a = k;
      let b = k;
      for (let d = 0; d < win && ok; d++) {
        a = samples[a].next;
        b = samples[b].prev;
        // 輪が短くて、前と後ろが出会う・同じ点にもどる所は、ふつうのたどり方で
        if (a === undefined || b === undefined || seen.has(a) || seen.has(b) || a === b) ok = false;
        else {
          seen.add(a);
          seen.add(b);
          // 分かれる所・合流する所の点そのものは見てよいが、その先へは、ふつうのたどり方で（最後の1個はその先へ行かない）
          if (d < win - 1 && (special(a) || special(b))) ok = false;
        }
      }
      memo.ok[k] = ok ? 1 : 0;
    }
    straightMemo.set(track, memo);
  }
  return memo.ok[i] === 1;
}

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
  // 分かれる所・合流する所がない所は、前と後ろへまっすぐたどるだけ（下のたどり方と同じ点を、同じ順に見る。
  // 毎回 Set や配列を作らないので速い。2026-10-19 のユーザー依頼「47fps くらいで重たい」）
  const plain = hint !== null && straightAround(track, hint, win);
  if (hint === null) {
    for (let i = 0; i < n; i++) scan(i);
  } else if (plain) {
    scan(hint);
    let a = hint;
    let b = hint;
    for (let d = 0; d < win; d++) {
      a = samples[a].next;
      b = samples[b].prev;
      scan(a);
      scan(b);
    }
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
  if (hint !== null) {
    // 分かれ道のあるコース: たどった道で道のはばの外なら、まわりの点（ほかの道も）からも探す。
    // 合流で横に並ぶ所・分かれる所・合流する所は、つながりをたどると遠いので（最終レビュー: 見えない壁）
    if (track.paths?.length > 1 && Math.sqrt(bestD) > samples[best].half) {
      const grid = nearGrid(track);
      const cx = Math.floor(x / NEAR_CELL);
      const cz = Math.floor(z / NEAR_CELL);
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gz = cz - 1; gz <= cz + 1; gz++) {
          // 地面のない所（ジャンプの上）の点は、高さで比べられないので、ここでは拾わない（つながりをたどれば拾える。
          // 2026-10-18: B の上で浮いた車が、近くの A のジャンプの上へワープして落ちた）
          // 車の高さとちがう道（橋の上・下、立体交差の近く）の点も拾わない（最終レビュー: 道のはしで上の道へワープした）
          for (const i of grid.get(`${gx},${gz}`) ?? []) if (samples[i].y !== null && (y === null || Math.abs(samples[i].y - y) <= 2)) scan(i);
        }
      }
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
    // 地面のある、ジャンプ台・加速板でない所（坂の道でもよい。2026-10-16: 高さのあるコースで、ずっと後ろまで戻されていた）
    const flat = p.y !== null && !p.ramp && !p.boost && !p.bridge;
    run = flat ? run + 1 : 0;
    if (run >= 10) return j;
  }
  return track.startIndex;
}

// 本線の s の所の位置・高さ・向き（となりの点の間をつなぐ。自動の区間で車を動かすのに使う）
export function sampleAt(track, s) {
  const L = track.length;
  const u = ((s % L) + L) % L;
  const i = Math.floor(u) % L;
  const p = track.samples[i];
  const q = track.samples[p.next];
  const f = u - Math.floor(u);
  const py = p.y ?? 0;
  const qy = q.y ?? py;
  return { x: p.x + (q.x - p.x) * f, y: py + (qy - py) * f, z: p.z + (q.z - p.z) * f, h: p.h, i };
}

// rel（スタートからの m）が、どのステージか（0 から）。ステージのないコースは 0
export function stageAt(track, rel) {
  let k = 0;
  (track.stages ?? []).forEach((st, i) => { if (rel >= st.s) k = i; });
  return k;
}
