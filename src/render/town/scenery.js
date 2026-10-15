// 置き場所のデータから、コースの景色を作る（部品の前が道を向くように、道ぞいに置く）
import * as kit from './kit.js?v=bcb4702';
import * as landmarks from './landmarks.js?v=bcb4702';
import { createBuilder } from './builder.js?v=bcb4702';
import { markS, span } from '../../game/track.js?v=bcb4702';

const PARTS = { ...kit, ...landmarks.PARTS };

// コースの s の、side 側（-1 左、1 右、0 真ん中）の、道のふちから back m 奥の場所。部品の前（+z）が道を向く
export function placeSpot(track, s, side, back) {
  const n = track.samples.length;
  const p = track.samples[((Math.round(s) % n) + n) % n];
  const d = side === 0 ? 0 : p.wall + back;
  const x = p.x - Math.sin(p.h) * side * d;
  const z = p.z + Math.cos(p.h) * side * d;
  const ry = side === 0 ? Math.PI / 2 - p.h : Math.atan2(side * Math.sin(p.h), -side * Math.cos(p.h));
  return { x, z, ry, s: p.s, side };
}

// 半径 radius の物を spot に置いても、ほかの区間の道や、ほかの区間のロータリーの島にかからないか
// 自分の前の道（大きい物ほど長く）は数えない（spot は自分の道のふちの外にあるので）
export function sceneryClear(track, spot, radius) {
  const near = (spot.side === 0 ? 40 : 25) + radius * 1.5;
  const along = (s) => Math.min(span(track, s, spot.s), span(track, spot.s, s));
  for (const q of track.samples) {
    if (along(q.s) < near) continue;
    if (Math.hypot(q.x - spot.x, q.z - spot.z) < q.wall + radius) return false;
  }
  for (const isl of track.islands ?? []) {
    if (spot.side === 0 || spot.side === 2) continue;
    // 自分の前のロータリーは、島（道の真ん中）より道のふちの外にあるので、かからない
    const r = along(isl.s) < near ? isl.r : isl.r + 12 + radius;
    if (Math.hypot(isl.x - spot.x, isl.z - spot.z) < r) return false;
  }
  return true;
}

// 直角の角の「正面に続く道」の口の場所: 角に入ってくる向きのまま、まっすぐ進んで、コースの道のふちの所。前（+z）が角の方を向く
// mode が 'back' のときは、曲がった先の道の反対側（T字路・十字路の、曲がる先の道の続き）
export function aheadSpot(track, s, mode = true) {
  const n = track.samples.length;
  const at = (k) => track.samples[((Math.round(k) % n) + n) % n];
  const back = mode === 'back';
  // 角に入ってくる道と、曲がった先の道のまっすぐな線が交わる所が、ほんとうの角（道の真ん中）
  // 向きは、角の丸めの外の2点を結んで決める
  const a1 = at(s - 32), a2 = at(s - 16), b1 = at(s + 16), b2 = at(s + 32);
  const ul = Math.hypot(a2.x - a1.x, a2.z - a1.z), vl = Math.hypot(b2.x - b1.x, b2.z - b1.z);
  const pin = a2, pout = b1;
  const ux = (a2.x - a1.x) / ul, uz = (a2.z - a1.z) / ul;
  const vx = (b2.x - b1.x) / vl, vz = (b2.z - b1.z) / vl;
  const den = ux * vz - uz * vx;
  const k = ((pout.x - pin.x) * vz - (pout.z - pin.z) * vx) / den;
  const cx = pin.x + ux * k, cz = pin.z + uz * k;
  // 正面の道は入ってくる向きのまま、反対側の道は曲がった先の道の逆向きに、道のふちまで（コースの道につながるように）
  const dx = back ? -vx : ux;
  const dz = back ? -vz : uz;
  // 角の丸めで道のふちが内へ入っているので、角から外へ進んで、道（の面）が終わる所を口にする
  const onRoad = (x, z) => track.samples.some((q) => Math.hypot(q.x - x, q.z - z) < q.half);
  let d = 0;
  while (d < track.roadHalf * 2 && onRoad(cx + dx * d, cz + dz * d)) d += 0.25;
  return { x: cx + dx * d, z: cz + dz * d, ry: Math.atan2(-dx, -dz), s: at(s).s, side: 2 };
}

// 通行止めの道の口（コースの道のふちの所）と幅。コースの壁は、ここだけあける
export function stubMouths(track, list) {
  const out = [];
  for (const item of list) {
    if (item.part !== 'stubRoad' || !item.at) continue;
    out.push(stubSpot(track, item, markS(track, item.at)));
  }
  return out;
}
function stubSpot(track, item, s) {
  const width = item.width ?? (item.ahead === 'back' || item.ahead === true ? track.roadHalf * 2 : 14);
  if (item.ahead) return { ...aheadSpot(track, s, item.ahead), width };
  const n = track.samples.length;
  const p = track.samples[((Math.round(s) % n) + n) % n];
  // 横道は、コースの道のふちから始まる
  return { ...placeSpot(track, s, item.side ?? -1, p.half - p.wall), width };
}
// 点 (x, z) が、口の前のコースの壁の所か（口の幅の中で、道のふちから少し外まで）
export function inMouth(m, x, z) {
  const dx = x - m.x;
  const dz = z - m.z;
  const lx = dx * Math.cos(m.ry) - dz * Math.sin(m.ry);
  const lz = dx * Math.sin(m.ry) + dz * Math.cos(m.ry);
  return Math.abs(lx) < m.width / 2 + 0.5 && lz > -8 && lz < 1.5;
}

export function buildScenery(track, list) {
  const b = createBuilder();
  const spots = [];
  const skippedLandmarks = [];
  // 横道（通行止めの道）の場所。並べる建物は、ここをあけて置く
  const openings = list.filter((i) => i.part === 'stubRoad' && i.at).map((i) => ({ s: markS(track, i.at), side: i.side }));
  const opened = (item, s) => item.every && openings.some((o) => o.side === item.side && Math.min(span(track, o.s, s), span(track, s, o.s)) < 11);
  const put = (item, s) => {
    if (item.part === 'stubRoad') {
      const spot = stubSpot(track, item, s);
      spot.radius = 1;
      spot.side = item.ahead ? 2 : spot.side;
      spot.part = item.part;
      spots.push(spot);
      b.push(spot.x, 0, spot.z, spot.ry);
      PARTS[item.part](b, { ...item, width: spot.width });
      b.pop();
      return;
    }
    // 角の正面に置く物（T字路の正面の看板など）: 道のふちから back m 奥
    if (item.ahead) {
      const spot = aheadSpot(track, s, item.ahead);
      const back = item.back ?? 4;
      spot.x -= Math.sin(spot.ry) * back;
      spot.z -= Math.cos(spot.ry) * back;
      spot.radius = item.radius ?? 1;
      spot.part = item.part;
      spots.push(spot);
      b.push(spot.x, 0, spot.z, spot.ry);
      PARTS[item.part](b, item);
      b.pop();
      return;
    }
    if (opened(item, s)) return;
    const spot = placeSpot(track, s, item.side ?? -1, item.back ?? 2);
    spot.radius = item.radius ?? 1;
    spot.anywhere = !!item.anywhere; // ロータリーの島の上の標識（分離帯がなくても置く）
    // 道の真ん中に置く物は、分離帯のある所だけ（道の上に立たないように）
    const n = track.samples.length;
    if (spot.side === 0 && !item.anywhere && !(track.samples[((Math.round(s) % n) + n) % n].median > 0)) return;
    if (!sceneryClear(track, spot, spot.radius)) {
      if (landmarks.PARTS[item.part]) skippedLandmarks.push(item.part);
      return;
    }
    spot.part = item.part;
    spots.push(spot);
    b.push(spot.x, 0, spot.z, spot.ry);
    PARTS[item.part](b, item);
    b.pop();
  };
  for (const item of list) {
    if (item.at) put(item, markS(track, item.at));
    else {
      const from = markS(track, item.from);
      const len = span(track, from, markS(track, item.to));
      for (let d = 0; d <= len; d += item.every) put(item, from + d);
    }
  }
  const group = b.build();
  group.userData = { placed: spots.length, spots, skippedLandmarks };
  return group;
}
