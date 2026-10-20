// Global City の部品（2026-10-20）: 箱・円柱・球・棒だけで作る。名所は src/render/world/<都市>.js
import * as THREE from '../../../vendor/three.module.min.js';
import { markS, sampleAt } from '../../game/track.js';

// 名所の印（テストと確かめ用。見えない）
export function landmark(group, name, x, y, z) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  o.userData.landmark = name;
  group.add(o);
  return o;
}

// 向き（度。北 0、時計回り）→ builder の ry（+z が前）
export function ryOf(deg) {
  return Math.PI - (deg * Math.PI) / 180;
}

// 地図の座標 [x, z]（m）→ 世界の座標
export function worldAt(track, [x, z]) {
  return track.toWorld(x, z);
}

// 道の印（'TT' か [from, to, t]）の s
export function sOf(track, ref) {
  if (ref === 'S') return 0;
  return typeof ref === 'string' ? track.marks[ref] : markS(track, ref);
}

// 道の s の所の点（位置・高さ・向きは sampleAt でなめらかに。道の幅 wall・half などは、その点の値）
export function pointAt(track, s) {
  const q = sampleAt(track, s);
  return { ...track.samples[q.i], ...q };
}

// 道の印 from〜to を step m ごとにたどる。fn(p, s)（p は pointAt）
export function along(track, from, to, step, fn) {
  const a = sOf(track, from);
  const b = sOf(track, to);
  for (let s = a; s <= b; s += step) fn(pointAt(track, s), s);
}

// 道の点 p から、右へ lat m の所（左はマイナス）
export function beside(p, lat) {
  return { x: p.x - Math.sin(p.h) * lat, z: p.z + Math.cos(p.h) * lat };
}

// 高層ビル: はば w、奥行き d、高さ h。窓のしま（4m ごと）。glow（光る builder）があれば、窓はそこに夜の明かりで
export function tower(b, x, z, ry, w, d, h, color, { glow = null, win = 0xbfd8ea, crown = 0, y = 0 } = {}) {
  b.push(x, y, z, ry);
  b.box(w, h, d, color, 0, 0, 0);
  const wb = glow ?? b;
  if (glow) glow.push(x, y, z, ry);
  for (let yy = 3; yy < h - 2; yy += 4) wb.box(w + 0.3, 1.2, d + 0.3, win, 0, yy, 0);
  if (glow) glow.pop();
  if (crown) b.box(w * 0.6, crown, d * 0.6, color, 0, h, 0);
  b.pop();
}

// 文字の看板の絵（builder の label 用。正式なロゴはまねない。2026-10-20）
export function textSign(text, { bg = '#ffffff', fg = '#111111', font = 'bold 72px sans-serif' } = {}) {
  const draw = (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2);
  };
  draw.key = `sign:${text}:${bg}:${fg}:${font}`;
  return draw;
}

// 満開の桜: 茶色の幹と、ピンクの丸い花のかたまり
export function sakura(b, x, y, z, s = 1) {
  b.push(x, y, z, 0);
  b.cyl(0.35 * s, 0.5 * s, 3.2 * s, 5, 0x5a3a2a, 0, 0, 0, true);
  for (const [dx, dy, dz, r] of [[0, 4.6, 0, 2.9], [1.8, 4, 0.9, 2.1], [-1.6, 4.1, -1, 2.2], [0.4, 5.6, -1.4, 1.8]]) b.sphere(r * s, 0xffc3d8, dx * s, dy * s, dz * s, 7);
  b.pop();
}

// 緑の木（丸い葉）
export function roundTree(b, x, y, z, s = 1, leaf = 0x4f8a3a) {
  b.push(x, y, z, 0);
  b.cyl(0.35 * s, 0.45 * s, 3 * s, 5, 0x6b4a2b, 0, 0, 0, true);
  b.sphere(2.6 * s, leaf, 0, 4.4 * s, 0, 6);
  b.pop();
}

// 円すいの木（松・杉・もみ）
export function coneTree(b, x, y, z, s = 1, leaf = 0x2f5d3a) {
  b.push(x, y, z, 0);
  b.cyl(0.3 * s, 0.35 * s, 1.6 * s, 5, 0x6b4a2b, 0, 0, 0, true);
  b.cyl(0, 2.6 * s, 6 * s, 6, leaf, 0, 1.4 * s, 0, true);
  b.pop();
}

// 落ちてくる桜の花びら（ピンクの点。main.js が毎フレーム少しずつ下げて、下まで来たら上に戻す）
export function petals(center, size, count = 260) {
  const pos = [];
  for (let k = 0; k < count; k++) {
    const u = ((k * 9301 + 49297) % 233280) / 233280;
    const v = ((k * 4271 + 1193) % 9973) / 9973;
    const w = ((k * 7919 + 17) % 6007) / 6007;
    pos.push(center.x + (u - 0.5) * size, 1 + w * 12, center.z + (v - 0.5) * size);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffb6cf, size: 0.35 }));
  pts.userData.petals = true;
  pts.userData.keep = true; // まとめない（動かす）
  return pts;
}

// 新幹線の高架（2026-10-21 のユーザー依頼「カーブで線路がちぎれて見える」）: 道の横 off m の線を、10m ごとの点と点を結ぶ板でつなぐ（カーブでもすき間ができない）。
// 柱は 25m ごと。from・to は道の s
export function viaduct(b, track, from, to, off, y) {
  const rail = (s) => beside(pointAt(track, s), off);
  for (let s = from; s < to; s += 10) {
    const a = rail(s);
    const c = rail(Math.min(s + 10, to));
    const len = Math.hypot(c.x - a.x, c.z - a.z);
    if (len < 0.5) continue;
    b.push((a.x + c.x) / 2, 0, (a.z + c.z) / 2, Math.atan2(c.x - a.x, c.z - a.z)); // z が線路の向き
    b.box(13, 1.6, len + 0.6, 0xc8ccd2, 0, y, 0); // 橋げた
    for (const x of [-3, 3]) b.box(0.3, 0.3, len + 0.6, 0x444a50, x, y + 1.6, 0); // レール
    b.pop();
  }
  for (let s = from; s <= to; s += 25) {
    const a = rail(s);
    b.cyl(1.4, 1.6, y, 8, 0xb8bcc2, a.x, 0, a.z); // 柱
  }
}
