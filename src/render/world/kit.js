// Global City の部品（2026-10-20）: 箱・円柱・球・棒だけで作る。名所は src/render/world/<都市>.js
import * as THREE from '../../../vendor/three.module.min.js?v=996c4bd';
import { markS, sampleAt } from '../../game/track.js?v=996c4bd';

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

// 英語の看板（名所の名前。2026-10-21 のユーザー依頼「看板を立てるなりして」）: 道の s の所の横（side は 1 右、-1 左）に、走ってくる方へ向けて立てる
export function roadSign(group, b, track, s, side, text, name, { bg = '#2a2a30', fg = '#f2ead2' } = {}) {
  const p = pointAt(track, s);
  const c = beside(p, side * (p.wall + 4));
  landmark(group, name, c.x, p.y ?? 0, c.z);
  b.push(c.x, p.y ?? 0, c.z, Math.atan2(Math.cos(p.h), Math.sin(p.h)) + Math.PI);
  for (const x of [-4.5, 4.5]) b.box(0.4, 2.4, 0.4, 0x5a5048, x, 0, 0);
  b.box(11, 2.8, 0.5, 0x3a3a40, 0, 2.2, 0);
  b.label(textSign(text, { bg, fg, font: 'bold 64px serif' }), [768, 160], 0, 3.6, 0.3, 0, 10.4, 2.4);
  b.pop();
}

// 香港のネオン看板の絵（2026-10-21 のユーザー依頼「中国語の看板に溢れているはず」）: 黒っぽい板に、光る漢字を縦に並べ、光るふちどり
export function neonSign(text, color) {
  const draw = (g, w, h) => {
    g.fillStyle = '#120a18';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = color;
    g.lineWidth = 10;
    g.shadowColor = color;
    g.shadowBlur = 24;
    g.strokeRect(12, 12, w - 24, h - 24);
    g.fillStyle = '#ffffff';
    g.font = `bold ${Math.floor(w * 0.62)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const chars = [...text];
    const step = (h - 40) / chars.length;
    chars.forEach((ch, k) => {
      g.shadowColor = color;
      g.shadowBlur = 30;
      g.fillStyle = color;
      g.fillText(ch, w / 2, 20 + step * (k + 0.5));
      g.shadowBlur = 0;
      g.fillStyle = '#ffffffcc';
      g.fillText(ch, w / 2, 20 + step * (k + 0.5));
    });
  };
  draw.key = `neon:${text}:${color}`;
  return draw;
}

// 道をまたぐ横断幕（名所の名前。2026-10-21 のユーザー依頼「看板が全く読めない。横断幕にするなど視認性をよく」）:
// 道の両がわの柱と、道の上 6.5m の大きな布。字は大きく、両面に
export function roadBanner(group, b, track, s, text, name, { bg = '#b01a10', fg = '#ffffff' } = {}) {
  const p = pointAt(track, s);
  const w = p.wall + 1.5;
  const o = landmark(group, name, p.x, (p.y ?? 0) + 8, p.z);
  o.userData.banner = text;
  b.push(p.x, p.y ?? 0, p.z, Math.atan2(Math.cos(p.h), Math.sin(p.h)));
  for (const side of [-1, 1]) b.box(0.6, 10.5, 0.6, 0x4a4a52, side * w, 0, 0);
  b.box(2 * w + 0.6, 0.4, 0.4, 0x4a4a52, 0, 10.2, 0);
  b.box(2 * w - 1, 3.4, 0.2, 0xf4f0e6, 0, 6.5, 0);
  const draw = textSign(text, { bg, fg, font: 'bold 110px sans-serif' });
  b.label(draw, [1024, 160], 0, 8.2, -0.15, Math.PI, 2 * w - 1.4, 3.2); // 走ってくる方
  b.label(draw, [1024, 160], 0, 8.2, 0.15, 0, 2 * w - 1.4, 3.2);
  b.pop();
}

// 信号機（2026-10-21 のユーザー依頼「青信号や赤信号を設置」）: 道の s の所の横（side 1 右、-1 左）に、走ってくる方へ向けて。
// 柱と、3つの灯（青・黄・赤）の箱。点いている灯（green / red）だけ光る
export function trafficLight(group, b, glow, track, s, side, color) {
  const p = pointAt(track, s);
  const c = beside(p, side * (p.wall + 1.2));
  const o = landmark(group, 'trafficLight', c.x, p.y ?? 0, c.z);
  o.userData.color = color;
  const ry = Math.atan2(Math.cos(p.h), Math.sin(p.h)) + Math.PI; // 走ってくる方
  const y = p.y ?? 0;
  b.cyl(0.18, 0.22, 7, 6, 0x3a3e44, c.x, y, c.z); // 柱
  b.push(c.x, y, c.z, ry);
  b.box(3.4, 0.2, 0.2, 0x3a3e44, side * -1.6, 6.8, 0); // 道の上へのびる腕
  b.box(2.6, 0.9, 0.6, 0x2a2e34, side * -2.6, 6.2, 0); // 灯の箱（横に3つ）
  b.pop();
  // 灯（左から青・黄・赤）。点いている灯は明るく、ほかは暗い色
  const colors = [color === 'green' ? 0x2de07a : 0x123a22, 0x3a3a14, color === 'red' ? 0xff3a2a : 0x3a1414];
  glow.push(c.x, y, c.z, ry);
  [-0.8, 0, 0.8].forEach((dx, k) => glow.sphere(0.3, colors[k], side * -2.6 - dx * side, 6.2, 0.35, 8)); // 箱の、走ってくるカートの方の面（反対を向いていた。2026-10-21 のユーザー依頼）
  glow.pop();
}
