// 置き場所のデータから、コースの景色を作る（部品の前が道を向くように、道ぞいに置く）
import * as kit from './kit.js?v=396317d';
import * as landmarks from './landmarks.js?v=396317d';
import * as forestKit from '../forest/kit.js?v=396317d';
import { createBuilder } from './builder.js?v=396317d';
import { markS, span, cornerCenter, locate } from '../../game/track.js?v=396317d';

const PARTS = { ...kit, ...landmarks.PARTS };
// 森のコースは、森の部品を使う（しげみ bush などは森の形）
const FOREST_PARTS = { ...PARTS, ...forestKit };
const PARTS_ALL = PARTS;

// コースの s の、side 側（-1 左、1 右、0 真ん中）の、道のふちから back m 奥の場所。部品の前（+z）が道を向く
export function placeSpot(track, s, side, back) {
  const n = track.length;
  return placeAt(track.samples[((Math.round(s) % n) + n) % n], side, back);
}
// 点 p（本線でも分かれ道でも）の横の場所
function placeAt(p, side, back) {
  const d = side === 0 ? 0 : p.wall + back;
  const x = p.x - Math.sin(p.h) * side * d;
  const z = p.z + Math.cos(p.h) * side * d;
  const ry = side === 0 ? Math.PI / 2 - p.h : Math.atan2(side * Math.sin(p.h), -side * Math.cos(p.h));
  return { x, z, ry, s: p.s, side, path: p.path ?? 0 };
}

// 半径 radius の物を spot に置いても、ほかの区間の道や、ほかの区間のロータリーの島にかからないか
// 自分の前の道（大きい物ほど長く）は数えない（spot は自分の道のふちの外にあるので）
export function sceneryClear(track, spot, radius) {
  const near = (spot.side === 0 ? 40 : 25) + radius * 1.5;
  const along = (s) => Math.min(span(track, s, spot.s), span(track, spot.s, s));
  for (const q of track.samples) {
    // 自分の道の近くは数えない（分かれ道は、ほかの道なら近くても数える）
    if ((q.path ?? 0) === (spot.path ?? 0) && along(q.s) < near) continue;
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
  const c = cornerCenter(track, s);
  const back = mode === 'back';
  // 正面の道は入ってくる向きのまま、反対側の道は曲がった先の道の逆向きに、道のふちまで（コースの道につながるように）
  const dx = back ? -c.vx : c.ux;
  const dz = back ? -c.vz : c.uz;
  // 角の丸めで道のふちが内へ入っているので、角から外へ進んで、道（の面）が終わる所を口にする
  const onRoad = (x, z) => track.samples.some((q) => Math.hypot(q.x - x, q.z - z) < q.half);
  let d = 0;
  while (d < track.roadHalf * 2 && onRoad(c.x + dx * d, c.z + dz * d)) d += 0.25;
  return { x: c.x + dx * d, z: c.z + dz * d, ry: Math.atan2(-dx, -dz), s: c.s, side: 2 };
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
  const length = item.length ?? STUB_REACH;
  if (item.ahead) return { ...aheadSpot(track, s, item.ahead), width, length, corner: cornerCenter(track, s) };
  const n = track.samples.length;
  const p = track.samples[((Math.round(s) % n) + n) % n];
  // 横道は、コースの道のふちから始まる
  return { ...placeSpot(track, s, item.side ?? -1, p.half - p.wall), width, length };
}
// 点 (x, z) が、口の前のコースの壁の所か（口の幅の中で、道のふちから少し外まで）
export function inMouth(m, x, z) {
  const dx = x - m.x;
  const dz = z - m.z;
  const lx = dx * Math.cos(m.ry) - dz * Math.sin(m.ry);
  const lz = dx * Math.sin(m.ry) + dz * Math.cos(m.ry);
  return Math.abs(lx) < m.width / 2 + 0.5 && lz > -8 && lz < 1.5;
}

// 半径 radius の物を spot に置くと、通行止めの道（口から STUB_REACH m 先まで）や、角のまん中にかかるか
export const STUB_REACH = 34;
// 道の上をまたぐ物（地面の上の走れる所の判定はしない）
const OVERHEAD = new Set(['banner', 'archGate', 'footbridge', 'stubRoad', 'pipeBridge']);
export function onStub(mouths, spot, radius) {
  return mouths.some((m) => {
    const dx = spot.x - m.x;
    const dz = spot.z - m.z;
    const lx = dx * Math.cos(m.ry) - dz * Math.sin(m.ry);
    const lz = dx * Math.sin(m.ry) + dz * Math.cos(m.ry);
    if (Math.abs(lx) < m.width / 2 + radius && lz < radius && lz > -m.length - radius) return true;
    const c = m.corner;
    return c && Math.hypot(spot.x - c.x, spot.z - c.z) < (m.width / 2) * 1.42 + radius;
  });
}

// groundY(x, z): 置く所の地面の高さ（森の坂。省けば 0）
export function buildScenery(track, list, groundY = () => 0) {
  const PARTS = track.def.theme === 'forest' ? FOREST_PARTS : PARTS_ALL;
  const mouths = stubMouths(track, list);
  const b = createBuilder();
  const spots = [];
  const skippedLandmarks = [];
  // 横道（通行止めの道）の場所。並べる建物は、ここをあけて置く
  const openings = list.filter((i) => i.part === 'stubRoad' && i.at).map((i) => ({ s: markS(track, i.at), side: i.side }));
  const opened = (item, s) => item.every && openings.some((o) => o.side === item.side && Math.min(span(track, o.s, s), span(track, s, o.s)) < 11);
  // p: 分かれ道の上の点（本線なら null で、s の所）
  const put = (item, s, p = null) => {
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
    // 直角の角を基準に置く物: corner: [u, w]（u は入ってくる向きに、w は曲がる向きと反対へ。m）。前（+z）は走ってくる車の方
    if (item.corner) {
      const c = cornerCenter(track, s);
      const [u, w] = item.corner;
      const spot = { x: c.x + c.ux * u - c.vx * w, z: c.z + c.uz * u - c.vz * w, ry: Math.atan2(c.ux, c.uz), s: c.s, side: 2, radius: item.radius ?? 2, part: item.part };
      spots.push(spot);
      b.push(spot.x, 0, spot.z, spot.ry);
      PARTS[item.part](b, { ...item, side: 0 });
      b.pop();
      return;
    }
    // 角の正面に置く物（T字路の正面の看板など）: 道のふちから back m 奥
    if (item.ahead) {
      const spot = aheadSpot(track, s, item.ahead);
      const back = item.back ?? 4;
      // 直角の角の外側は、角から W（道の半分＋道の外）まで走れるので、その外から back m 奥に（最終レビュー）
      const c = cornerCenter(track, s);
      const dx = -Math.sin(spot.ry), dz = -Math.cos(spot.ry);
      const d0 = (spot.x - c.x) * dx + (spot.z - c.z) * dz;
      const d = Math.max(d0, track.roadHalf + track.def.dirt + 0.5) + back;
      spot.x = c.x + dx * d;
      spot.z = c.z + dz * d;
      spot.radius = item.radius ?? 1;
      spot.part = item.part;
      spots.push(spot);
      b.push(spot.x, 0, spot.z, spot.ry);
      PARTS[item.part](b, item);
      b.pop();
      return;
    }
    if (!p && opened(item, s)) return;
    const spot = p ? placeAt(p, item.side ?? -1, item.back ?? 2) : placeSpot(track, s, item.side ?? -1, item.back ?? 2);
    spot.radius = item.radius ?? 1;
    spot.anywhere = !!item.anywhere; // ロータリーの島の上の標識（分離帯がなくても置く）
    // 道の真ん中に置く物は、分離帯のある所だけ（道の上に立たないように）
    const n = track.samples.length;
    if (spot.side === 0 && !item.anywhere && !(track.samples[((Math.round(s) % n) + n) % n].median > 0)) return;
    // 地面に立つ物は、カートが走れる所（直角の角の外側の四角も）に置かない（最終レビュー）
    const onCourse = !OVERHEAD.has(item.part) && spot.side !== 0 && !item.anywhere && locate(track, spot.x, spot.z).surface !== 'out';
    spot.y = groundY(spot.x, spot.z);
    const inWater = !OVERHEAD.has(item.part) && spot.y < -0.5; // 川の中には立てない
    if (onCourse || inWater || !sceneryClear(track, spot, spot.radius) || (item.part !== 'trafficLight' && onStub(mouths, spot, spot.radius))) {
      if (landmarks.PARTS[item.part]) skippedLandmarks.push(item.part);
      return;
    }
    spot.part = item.part;
    spots.push(spot);
    b.push(spot.x, spot.y, spot.z, spot.ry);
    PARTS[item.part](b, item);
    b.pop();
  };
  for (let item of list) {
    // 分かれ道の上: path（道の id）と、その道の上の割合
    // （at: ['middle', 0.5] のように、道の id と割合でも書ける）
    const byAt = Array.isArray(item.at) && item.at.length === 2;
    const pathId = byAt ? item.at[0] : item.path;
    const path = pathId && pathId !== 'main' ? (track.paths ?? []).find((q) => q.id === pathId) : null;
    if (path) {
      if (byAt) item = { ...item, at: item.at[1] };
      const at = (f) => path.start + Math.min(path.count - 1, Math.max(0, Math.round(f * (path.count - 1))));
      if (item.at !== undefined) put(item, 0, track.samples[at(item.at)]);
      else {
        const step = Math.max(1, Math.round(item.every / (path.len / path.count)));
        for (let i = at(item.from); i <= at(item.to); i += step) put(item, 0, track.samples[i]);
      }
      continue;
    }
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
