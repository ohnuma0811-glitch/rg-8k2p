// コースを真上から見た図（SVG）を作る。使い方: node scripts/course-map.mjs docs/reference/course1-layout.svg
import { writeFileSync } from 'node:fs';
import { buildTrack } from '../src/game/track.js';
import { COURSE1 } from '../src/data/tracks.js';
const t = buildTrack(COURSE1);
const S = t.samples;
const pad = 40;
const xs = S.map((p) => p.x), zs = S.map((p) => p.z);
const minX = Math.min(...xs) - pad, minZ = Math.min(...zs) - pad;
const W = Math.max(...xs) + pad - minX, H = Math.max(...zs) + pad - minZ;
const P = (p) => `${(p.x - minX).toFixed(1)},${(p.z - minZ).toFixed(1)}`;
const path = (from, to) => S.filter((p) => p.s >= from && p.s < to).map(P).join(' ');
const poly = S.map(P).join(' ') + ' ' + P(S[0]);
const c = t.cross, J = COURSE1.jump;
const mark = (s, color, r) => { const p = S[Math.round(s + t.length) % t.length]; return `<circle cx="${(p.x - minX).toFixed(1)}" cy="${(p.z - minZ).toFixed(1)}" r="${r}" fill="${color}"/>`; };
const st = S[t.startIndex];
const arrows = [100, 400, 700, 1000, 1200].map((s) => { const p = S[s]; const a = p.h * 180 / Math.PI; return `<g transform="translate(${(p.x - minX).toFixed(1)},${(p.z - minZ).toFixed(1)}) rotate(${a.toFixed(1)})"><path d="M-7,-6 L7,0 L-7,6 Z" fill="#fff"/></g>`; }).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${(H + 40).toFixed(0)}" width="${(W * 1.2).toFixed(0)}">
<rect width="100%" height="100%" fill="#5fae4b"/>
<polyline points="${poly}" fill="none" stroke="#b08850" stroke-width="${2 * (COURSE1.roadHalf + COURSE1.dirt)}" stroke-linejoin="round"/>
<polyline points="${poly}" fill="none" stroke="#55585e" stroke-width="${2 * COURSE1.roadHalf}" stroke-linejoin="round"/>
<polyline points="${path(c.sA + J.ramp.from, c.sA + J.ramp.to)}" fill="none" stroke="#8a6d4a" stroke-width="${2 * COURSE1.roadHalf}"/>
<polyline points="${path(c.sA + J.boost.from, c.sA + J.boost.to)}" fill="none" stroke="#ff8a00" stroke-width="${2 * COURSE1.roadHalf}"/>
<polyline points="${path(c.sA + J.gap.from, c.sA + J.gap.to)}" fill="none" stroke="#9fd0ff" stroke-width="${2 * COURSE1.roadHalf}" stroke-dasharray="4 3"/>
${arrows}
<line x1="${(st.x - minX - Math.sin(-st.h) * 0).toFixed(1)}" y1="0" x2="0" y2="0" stroke="none"/>
${mark(t.startIndex, '#fff', 7)}${mark(t.startIndex, '#111', 4)}
<text x="10" y="${(H + 28).toFixed(0)}" font-family="sans-serif" font-size="18" fill="#fff">1周 ${t.length}m ／ ●スタート　オレンジ: 加速板　茶: ジャンプ台　水色: 飛び越える所　▶: 走る向き</text>
</svg>`;
writeFileSync(process.argv[2], svg);
console.log('ok', W.toFixed(0), H.toFixed(0));
