// Kampar Town のコースマップ（上から見た図）を SVG で書き出す。KENTA が場所を指示するための図
// 使い方: node scripts/kampar-map.mjs > docs/reference/kampar-course-map.svg
import { buildTrack, markS } from '../src/game/track.js';
import { COURSE2 } from '../src/data/tracks.js';
import { KAMPAR_SCENERY } from '../src/data/kampar.js';

const t = buildTrack(COURSE2);
const xs = t.samples.map((p) => p.x);
const zs = t.samples.map((p) => p.z);
const pad = 90;
const minX = Math.min(...xs) - pad;
const minZ = Math.min(...zs) - pad;
const W = Math.max(...xs) + pad - minX;
const H = Math.max(...zs) + pad - minZ;
const P = (p) => [(p.x - minX).toFixed(1), (p.z - minZ).toFixed(1)];
const at = (s) => t.samples[((Math.round(s) % t.length) + t.length) % t.length];
const side = (s, d) => {
  const p = at(s);
  return { x: p.x - Math.sin(p.h) * d, z: p.z + Math.cos(p.h) * d };
};
const road = t.samples.map((p, i) => `${i ? 'L' : 'M'}${P(p).join(' ')}`).join(' ') + ' Z';
const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${(H + 60).toFixed(0)}" width="${(W * 1.3).toFixed(0)}" font-family="sans-serif">`);
out.push(`<rect width="100%" height="100%" fill="#eef3e8"/>`);
out.push(`<path d="${road}" fill="none" stroke="#9aa0a6" stroke-width="30" stroke-linejoin="round"/>`);
out.push(`<path d="${road}" fill="none" stroke="#55585e" stroke-width="24" stroke-linejoin="round"/>`);
out.push(`<path d="${road}" fill="none" stroke="#fff" stroke-width="1.2" stroke-dasharray="6 6"/>`);
// 走る向きの矢印（100m ごと）
for (let s = 50; s < t.length; s += 150) {
  const p = at(s);
  const [x, y] = P(p);
  out.push(`<g transform="translate(${x} ${y}) rotate(${((p.h * 180) / Math.PI).toFixed(1)})"><path d="M-6 -5 L6 0 L-6 5" fill="none" stroke="#ffd400" stroke-width="2.5"/></g>`);
}
// ロータリー
for (const isl of t.islands) {
  const [x, y] = P(isl);
  out.push(`<circle cx="${x}" cy="${y}" r="${isl.r}" fill="#5aa04a" stroke="#fff" stroke-width="1.5"/>`);
}
// スタート
{
  const p = at(0);
  const a = side(0, 14);
  const b = side(0, -14);
  out.push(`<line x1="${P(a)[0]}" y1="${P(a)[1]}" x2="${P(b)[0]}" y2="${P(b)[1]}" stroke="#fff" stroke-width="5"/>`);
  const l = side(0, 40);
  out.push(`<text x="${P(l)[0]}" y="${P(l)[1]}" font-size="16" font-weight="bold" fill="#111">START</text>`);
}
// バンプ
for (const b of t.bumps) {
  const a = side(b, 13);
  const c = side(b, -13);
  out.push(`<line x1="${P(a)[0]}" y1="${P(a)[1]}" x2="${P(c)[0]}" y2="${P(c)[1]}" stroke="#ffd400" stroke-width="5"/>`);
  const l = side(b, -34);
  out.push(`<text x="${P(l)[0]}" y="${P(l)[1]}" font-size="12" fill="#b07a00" font-weight="bold" text-anchor="middle">BUMP</text>`);
}
// 牛
for (const c of t.cows) {
  const [x, y] = P(at(c.s));
  out.push(`<circle cx="${x}" cy="${y}" r="4" fill="#8a5a33" stroke="#fff"/>`);
}
{
  const l = side(t.cows[1].s, 34);
  out.push(`<text x="${P(l)[0]}" y="${P(l)[1]}" font-size="12" fill="#8a5a33" text-anchor="middle">牛</text>`);
}
// 目印（大きな建物）
const names = {
  footbridge: '歩道橋', westlakeVillas: 'WestLake Villas', westlakeSchool: '学校', hospitalUtar: '病院', kamparSign: 'KAMPAR看板', curvedMall: '曲がった屋根', museumSign: '博物館', gBuilding: 'Gの建物', hotel: 'ホテル', waterTowerBB: '給水塔', utarHall: 'UTAR大ホール', archGate: 'アーチの門', waterTowerUtar: 'UTAR給水塔',
};
for (const it of KAMPAR_SCENERY) {
  if (!names[it.part]) continue;
  const s = markS(t, it.at);
  const l = side(s, (it.side || 1) * 42);
  out.push(`<text x="${P(l)[0]}" y="${P(l)[1]}" font-size="11" fill="#2a4f8a" text-anchor="middle">${names[it.part]}</text>`);
}
// 区間の印 A〜J（道の外側に大きく）
// 道の上に小さな点、曲がる外側に大きな丸と文字
for (const [m, s] of Object.entries(t.marks)) {
  const [px, py] = P(at(s));
  // 曲がる向きの外側に出す（右へ曲がる角は左、左へ曲がる角は右）
  const turn = Math.atan2(Math.sin(at(s + 25).h - at(s - 25).h), Math.cos(at(s + 25).h - at(s - 25).h));
  const [x, y] = P(side(s, turn < -0.3 ? 38 : -38));
  out.push(`<line x1="${px}" y1="${py}" x2="${x}" y2="${y}" stroke="#d8262b" stroke-width="2"/><circle cx="${px}" cy="${py}" r="3.5" fill="#d8262b"/>`);
  out.push(`<circle cx="${x}" cy="${y}" r="13" fill="#d8262b" stroke="#fff" stroke-width="2"/><text x="${x}" y="${(+y + 6).toFixed(1)}" font-size="17" font-weight="bold" fill="#fff" text-anchor="middle">${m}</text>`);
}
out.push(`<text x="16" y="${(H + 40).toFixed(0)}" font-size="14" fill="#333">Kampar Town（1周 ${t.length}m・時計回り）　赤丸 = 区間の印　緑の丸 = ロータリー　黄色の線 = バンプ　茶色の点 = 牛</text>`);
out.push('</svg>');
console.log(out.join('\n'));
