// 石のアーチ橋（Soki Forest。2026-10-16 のユーザー依頼「下の道の上に大きな橋を」）。
// 本線の橋の点（p.bridge）に沿って、石の板（道の下）・石の手すり・橋脚と、橋脚の間のアーチを作る。
// 下の道（ほかの道）の上は、橋脚を置かず、大きなアーチにする
import { createBuilder } from '../town/builder.js?v=667e655';
import { span } from '../../game/track.js?v=667e655';

const STONE = 0x9a958c; // 橋の石
const STONE_DARK = 0x8a857c; // アーチの内側（少し暗く）
const RAIL = 0xb5afa4; // 手すり
const DECK = 1.4; // 道の下の板の厚さ（m）
const PIER_EVERY = 10; // 橋脚の間（m）
const UNDER_CLEAR = 13; // 下の道の真ん中から、橋脚を置かない長さ（m）

export function buildBridge(track) {
  const b = createBuilder();
  const { samples } = track;
  const pts = samples.slice(0, track.length).filter((p) => p.bridge);
  if (!pts.length) return b.build();
  // 橋のはば: 車が通れる所（柵 p.wall）のはしに、手すりの内がわを合わせる
  const wall = pts[0].wall;
  const width = 2 * wall + 1.2;
  // 走る向きを部品の +z にする回転
  const ryOf = (p) => Math.PI / 2 - p.h;
  // 道の下の板と、両はしの手すり（2m ごと）
  for (let k = 0; k < pts.length; k += 2) {
    const p = pts[k];
    b.push(p.x, p.y - DECK, p.z, ryOf(p));
    b.box(width, DECK, 2.3, STONE, 0, 0, 0);
    for (const x of [-(width / 2 - 0.3), width / 2 - 0.3]) b.box(0.6, DECK + 1.0, 2.3, RAIL, x, 0, 0);
    b.pop();
  }
  // 橋脚とアーチ（2026-10-17 のユーザー依頼「写真のように橋の足を増やして」）: ふだんは PIER_EVERY m おき、
  // 下の道の上は track.bridgePiers（せまいすき間。ぶつかるとスピン）。橋脚と橋脚の間は、アーチの線より上を石でうめる
  const unders = (track.bridges ?? []).map((br) => br.s);
  const nearUnder = (p) => unders.some((s) => Math.min(span(track, s, p.s), span(track, p.s, s)) < UNDER_CLEAR);
  const pierS = [];
  pts.forEach((p, k) => {
    if (k % PIER_EVERY === 0 && !nearUnder(p)) pierS.push(p.s);
  });
  for (const pier of track.bridgePiers ?? []) pierS.push(pier.s);
  pierS.sort((a, c) => a - c);
  for (const s of pierS) {
    const p = samples[Math.round(s + track.length) % track.length];
    const top = p.y - DECK;
    if (top <= 0.5) continue;
    b.push(p.x, 0, p.z, ryOf(p));
    b.box(width, top, 2.0, STONE, 0, 0, 0);
    b.pop();
  }
  for (const p of pts) {
    const top = p.y - DECK;
    if (top <= 0.5) continue;
    // 前と後ろの橋脚
    let prev = -Infinity;
    let next = Infinity;
    for (const s of pierS) {
      if (s <= p.s && s > prev) prev = s;
      if (s > p.s && s < next) next = s;
    }
    if (!Number.isFinite(prev) || !Number.isFinite(next) || p.s - prev < 1 || next - p.s < 1) continue;
    const half = (next - prev) / 2;
    const u = p.s - (prev + next) / 2;
    // アーチの穴の上のふち: 真ん中は板のすぐ下（apex）、橋脚の所は低い（spring）
    const apex = top - 0.6;
    const spring = top * (half < 5 ? 0.6 : 0.4);
    const arch = spring + (apex - spring) * Math.sqrt(Math.max(0, 1 - (u / half) ** 2));
    const h = top - arch;
    if (h <= 0.05) continue;
    b.push(p.x, arch, p.z, ryOf(p));
    b.box(width, h, 1.05, STONE_DARK, 0, 0, 0);
    b.pop();
  }
  return b.build();
}
