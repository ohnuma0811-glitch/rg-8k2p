// 石のアーチ橋（Soki Forest。2026-10-16 のユーザー依頼「下の道の上に大きな橋を」）。
// 本線の橋の点（p.bridge）に沿って、石の板（道の下）・石の手すり・橋脚と、橋脚の間のアーチを作る。
// 下の道（ほかの道）の上は、橋脚を置かず、大きなアーチにする
import { createBuilder } from '../town/builder.js';

const STONE = 0x9a958c; // 橋の石
const STONE_DARK = 0x8a857c; // アーチの内側（少し暗く）
const RAIL = 0xb5afa4; // 手すり
const DECK = 1.4; // 道の下の板の厚さ（m）
const PIER_EVERY = 10; // 橋脚の間（m）
const UNDER_CLEAR = 13; // 下の道の真ん中から、橋脚を置かない長さ（m）

// 雪山（Kyugo Mountain。2026-10-18）: 雪のつもった石の橋
const SNOW_STONE = 0xb8bec6;
const SNOW_STONE_DARK = 0xa4aab3;
const SNOW_RAIL = 0xd0d5db;
const SNOW = 0xf4f7fb;

// 橋の点を、同じ道の next でつながる続きごとに分ける（本線の橋も、分かれ道の橋も。2026-10-18）
function bridgeRuns(samples) {
  const runs = [];
  const seen = new Set();
  samples.forEach((p, i) => {
    if (!p.bridge || seen.has(i)) return;
    const prev = samples[p.prev];
    if (prev.bridge && prev.path === p.path && prev !== p) return; // 続きのとちゅう
    const run = [];
    for (let k = i; samples[k].bridge && samples[k].path === p.path && !seen.has(k); k = samples[k].next) {
      seen.add(k);
      run.push(samples[k]);
    }
    runs.push(run);
  });
  // 本線の輪がまるごと橋（続きの始まりがない）ことはないので、残りはなし
  return runs;
}

export function buildBridge(track, { snow = false } = {}) {
  const b = createBuilder();
  for (const pts of bridgeRuns(track.samples)) buildRun(b, track, pts, snow);
  return b.build();
}

function buildRun(b, track, pts, snow) {
  const stone = snow ? SNOW_STONE : STONE;
  const stoneDark = snow ? SNOW_STONE_DARK : STONE_DARK;
  const rail = snow ? SNOW_RAIL : RAIL;
  // 橋のはば: 車が通れる所（柵 p.wall）のはしに、手すりの内がわを合わせる
  const wall = pts[0].wall;
  const width = 2 * wall + 1.2;
  // 走る向きを部品の +z にする回転
  const ryOf = (p) => Math.PI / 2 - p.h;
  // 道の下の板と、両はしの手すり（2m ごと）。雪山は、坂でも段々に見えないよう、src/render/trackMesh.js で坂にそった形にする
  for (let k = 0; k < (snow ? 0 : pts.length); k += 2) {
    const p = pts[k];
    b.push(p.x, p.y - DECK, p.z, ryOf(p));
    b.box(width, DECK, 2.3, stone, 0, 0, 0);
    for (const x of [-(width / 2 - 0.3), width / 2 - 0.3]) {
      b.box(0.6, DECK + 1.0, 2.3, rail, x, 0, 0);
      if (snow) b.box(0.7, 0.15, 2.3, SNOW, x, DECK / 2 + 1.0 + 0.07, 0);
    }
    b.pop();
  }
  // 橋脚とアーチ（2026-10-17 のユーザー依頼「写真のように橋の足を増やして」）: ふだんは PIER_EVERY m おき、
  // 下の道の上は track.bridgePiers（せまいすき間。ぶつかるとスピン）。橋脚と橋脚の間は、アーチの線より上を石でうめる
  // 場所は、続きの中の番号 k（1m ごと）で数える
  const index = new Map(pts.map((p, k) => [p, k]));
  const unders = (track.bridges ?? []).filter((br) => index.has(track.samples[br.i])).map((br) => index.get(track.samples[br.i]));
  const nearUnder = (k) => unders.some((u) => Math.abs(u - k) < UNDER_CLEAR);
  // 柱や石をそこに立てると、下を通るほかの道（車の通る所）にかかる所（最終レビュー: ななめに交わる所で、柱が下の道の中に立った）
  const lower = track.samples.filter((q) => q.y !== null && !q.bridge);
  const blocked = pts.map((p) => {
    const [ax, az] = [p.x + Math.sin(p.h) * (width / 2), p.z - Math.cos(p.h) * (width / 2)];
    const [bx, bz] = [p.x - Math.sin(p.h) * (width / 2), p.z + Math.cos(p.h) * (width / 2)];
    // 下の道のいちばん高い所（なければ null）
    let below = null;
    for (const q of lower) {
      if (q.y >= p.y - DECK || Math.abs(q.x - p.x) > width + 20 || Math.abs(q.z - p.z) > width + 20) continue;
      const dx = bx - ax;
      const dz = bz - az;
      const u = Math.max(0, Math.min(1, ((q.x - ax) * dx + (q.z - az) * dz) / (dx * dx + dz * dz)));
      if (Math.hypot(ax + dx * u - q.x, az + dz * u - q.z) < q.wall + 1.5) below = Math.max(below ?? -Infinity, q.y);
    }
    return below;
  });
  const pierK = [];
  pts.forEach((p, k) => {
    if (k % PIER_EVERY === 0 && !nearUnder(k) && blocked[k] === null) pierK.push(k);
  });
  for (const pier of track.bridgePiers ?? []) if (index.has(track.samples[pier.i])) pierK.push(index.get(track.samples[pier.i]));
  pierK.sort((a, c) => a - c);
  for (const k of pierK) {
    const p = pts[k];
    const top = p.y - DECK;
    if (top <= 0.5) continue;
    b.push(p.x, 0, p.z, ryOf(p));
    b.box(width, top, 2.0, stone, 0, 0, 0);
    b.pop();
  }
  pts.forEach((p, k) => {
    const top = p.y - DECK;
    if (top <= 0.5) return;
    // 前と後ろの橋脚
    let prev = -Infinity;
    let next = Infinity;
    for (const q of pierK) {
      if (q <= k && q > prev) prev = q;
      if (q > k && q < next) next = q;
    }
    if (!Number.isFinite(prev) || !Number.isFinite(next) || k - prev < 1 || next - k < 1) return;
    const half = (next - prev) / 2;
    const u = k - (prev + next) / 2;
    // アーチの穴の上のふち: 真ん中は板のすぐ下（apex）、橋脚の所は低い（spring）
    const apex = top - 0.6;
    const spring = top * (half < 5 ? 0.6 : 0.4);
    const arch = spring + (apex - spring) * Math.sqrt(Math.max(0, 1 - (u / half) ** 2));
    const h = top - arch;
    // 下の道の車（高さ 4m まで）にかかる石は作らない
    if (h <= 0.05 || (blocked[k] !== null && arch < blocked[k] + 4)) return;
    b.push(p.x, arch, p.z, ryOf(p));
    b.box(width, h, 1.05, stoneDark, 0, 0, 0);
    b.pop();
  });
}
