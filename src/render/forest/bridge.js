// 石のアーチ橋（Soki Forest。2026-10-16 のユーザー依頼「下の道の上に大きな橋を」）。
// 本線の橋の点（p.bridge）に沿って、石の板（道の下）・石の手すり・橋脚と、橋脚の間のアーチを作る。
// 下の道（ほかの道）の上は、橋脚を置かず、大きなアーチにする
import { createBuilder } from '../town/builder.js?v=ca732e7';
import { span } from '../../game/track.js?v=ca732e7';

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
  // 橋脚とアーチ: 下の道の上は大きなアーチ（橋脚なし）
  const unders = (track.bridges ?? []).map((br) => br.s);
  const nearUnder = (p) => unders.some((s) => Math.min(span(track, s, p.s), span(track, p.s, s)) < UNDER_CLEAR);
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k];
    const top = p.y - DECK;
    if (top <= 0.5) continue;
    const along = k % PIER_EVERY;
    if (!nearUnder(p) && along === 0) {
      // 橋脚（道の幅いっぱいの石の壁）
      b.push(p.x, 0, p.z, ryOf(p));
      b.box(width, top, 2.4, STONE, 0, 0, 0);
      b.pop();
      continue;
    }
    // アーチ: 橋脚と橋脚の間（下の道の上は、もっと大きく）。アーチの線より上を石でうめる
    const half = nearUnder(p) ? UNDER_CLEAR : PIER_EVERY / 2;
    const u = nearUnder(p) ? Math.min(...unders.map((s) => Math.min(span(track, s, p.s), span(track, p.s, s)))) : Math.abs(along - PIER_EVERY / 2);
    // アーチの穴の上のふち: 真ん中は板のすぐ下（apex）、橋脚の所は低い（spring）。その上から板までを石でうめる
    const apex = top - 0.6;
    const spring = nearUnder(p) ? Math.max(0.5, top * 0.35) : top * 0.4;
    const arch = spring + (apex - spring) * Math.sqrt(Math.max(0, 1 - (u / half) ** 2));
    const h = top - arch;
    if (h <= 0.05) continue;
    b.push(p.x, arch, p.z, ryOf(p));
    b.box(width, h, 1.05, STONE_DARK, 0, 0, 0);
    b.pop();
  }
  return b.build();
}
