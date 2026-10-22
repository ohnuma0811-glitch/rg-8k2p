// 「?」の箱（設計書 docs/superpowers/specs/2026-10-22-items-design.md の 2章）: 道を横切る1列。取ったら消えて2秒で戻る
import { markS, span } from './track.js';

export const BOX_RESPAWN = 2; // 取ってから戻るまで（秒）
export const BOX_REACH = 2.2; // 車の中心と箱の中心がこれより近いと取る（m）
export const BOX_SIZE = 1.6; // 箱の一辺（見た目、m）
export const ROW_CLEAR = 15; // 列の前後この m は、ふつうの道（ジャンプ台・加速板などでない）

// 点 i の前後 ROW_CLEAR m が、ふつうの道か
function clearAt(track, i) {
  let a = i;
  let b = i;
  for (let k = 0; k <= ROW_CLEAR; k++) {
    for (const j of [a, b]) {
      const p = track.samples[j];
      if (p.y === null || p.ramp || p.boost || p.bridge || p.auto || p.void || p.kick || p.median > 0) return false;
    }
    a = track.samples[a].next;
    b = track.samples[b].prev;
  }
  return true;
}

// 点 i から前と後ろへ順に見て、いちばん近いふつうの道の点
function findSpot(track, i) {
  let a = i;
  let b = i;
  for (let k = 0; k < 400; k++) {
    if (clearAt(track, a)) return a;
    if (clearAt(track, b)) return b;
    a = track.samples[a].next;
    b = track.samples[b].prev;
  }
  return null;
}

// 箱の列の場所（点の番号）。周回のあるコースはスタートから半周の所。World Cities は def.itemRows（印の書き方）。
// 本線の点の番号は s と同じ（1m ごと）。その s を通らない分かれ道には、分かれ道の上の同じ s の所にもう1列
export function rowSpots(track) {
  const L = track.length;
  const refs = track.def.itemRows;
  const targets = refs ? refs.map((ref) => Math.round(markS(track, ref)) % L) : [Math.round(track.samples[track.startIndex].s + L / 2) % L];
  const spots = [];
  for (const s of targets) {
    const i = findSpot(track, s);
    if (i !== null) spots.push(i);
    for (const p of track.paths ?? []) {
      if (p.fork == null) continue;
      const from = track.samples[p.fork].s;
      const to = track.samples[p.join].s;
      if (span(track, from, s) >= span(track, from, to)) continue;
      let best = p.start;
      for (let k = p.start; k < p.start + p.count; k++) {
        if (Math.abs(track.samples[k].s - s) < Math.abs(track.samples[best].s - s)) best = k;
      }
      const j = findSpot(track, best);
      if (j !== null && track.samples[j].path === track.samples[best].path) spots.push(j);
    }
  }
  return spots;
}

// 点 i の所の1列。道幅に合わせて4〜6個、柵から 2m あけて同じ間かくに
export function rowBoxes(track, i) {
  const p = track.samples[i];
  const n = Math.max(4, Math.min(6, Math.floor((2 * p.half) / 4.5)));
  const gap = (2 * p.half - 4) / (n - 1);
  return Array.from({ length: n }, (_, k) => {
    const lat = (k - (n - 1) / 2) * gap;
    return { x: p.x - Math.sin(p.h) * lat, z: p.z + Math.cos(p.h) * lat, y: p.y, i };
  });
}

// コースの全部の箱。gone は戻るまでの残り秒（0 なら出ている）
export function createBoxes(track) {
  return rowSpots(track).flatMap((i, row) => rowBoxes(track, i).map((b) => ({ ...b, row, gone: 0 })));
}

export function stepBoxes(boxes, dt) {
  for (const b of boxes) if (b.gone > 0) b.gone = Math.max(0, b.gone - dt);
}

// 車が触れた箱を消す。1つでも触れたら true（アイテムをもらえるかは items.js が決める）
export function touchBoxes(boxes, kart) {
  let took = false;
  for (const b of boxes) {
    if (b.gone > 0 || Math.abs((kart.y ?? 0) - b.y) > 2.5) continue;
    if (Math.hypot(kart.x - b.x, kart.z - b.z) < BOX_REACH) {
      b.gone = BOX_RESPAWN;
      took = true;
    }
  }
  return took;
}
