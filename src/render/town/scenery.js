// 置き場所のデータから、コースの景色を作る（部品の前が道を向くように、道ぞいに置く）
import * as kit from './kit.js?v=aa4a14c';
import * as landmarks from './landmarks.js?v=aa4a14c';
import { createBuilder } from './builder.js?v=aa4a14c';
import { markS, span } from '../../game/track.js?v=aa4a14c';

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

// 直角の角の「正面に続く道」の場所: 角に入ってくる向きのまま、まっすぐ進んで、角の外の柵を越えた所。前（+z）が角の方を向く
// mode が 'back' のときは、曲がった先の道の反対側（交差点の4本目の道）
export function aheadSpot(track, s, mode = true) {
  const n = track.samples.length;
  const at = (k) => track.samples[((Math.round(k) % n) + n) % n];
  const back = mode === 'back';
  const p0 = at(back ? s + 40 : s - 40);
  const c = at(s);
  const dx = Math.cos(p0.h) * (back ? -1 : 1);
  const dz = Math.sin(p0.h) * (back ? -1 : 1);
  // 角の点まで進む長さ ＋ 角の外の柵まで
  const d = (c.x - p0.x) * dx + (c.z - p0.z) * dz + c.wall + 9;
  return { x: p0.x + dx * d, z: p0.z + dz * d, ry: Math.atan2(-dx, -dz), s: c.s, side: 2 };
}

export function buildScenery(track, list) {
  const b = createBuilder();
  const spots = [];
  const skippedLandmarks = [];
  // 横道（通行止めの道）の場所。並べる建物は、ここをあけて置く
  const openings = list.filter((i) => i.part === 'stubRoad' && i.at).map((i) => ({ s: markS(track, i.at), side: i.side }));
  const opened = (item, s) => item.every && openings.some((o) => o.side === item.side && Math.min(span(track, o.s, s), span(track, s, o.s)) < 11);
  const put = (item, s) => {
    if (item.ahead) {
      const spot = aheadSpot(track, s, item.ahead);
      spot.radius = 1;
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
