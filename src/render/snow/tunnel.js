// トンネル（Kyugo Mountain。2026-10-18 のユーザー依頼）: トンネルの点にそって、両がわの壁と天井。入口と出口に石のアーチ
import * as THREE from '../../../vendor/three.module.min.js';
import { createBuilder } from '../town/builder.js';

export const TUNNEL_HEIGHT = 8; // 道から天井まで（m）
const WALL = 0x5a5f66;
const CEIL = 0x4a4e55;
const ARCH = 0x9a958c;

export function buildTunnel(track) {
  const group = new THREE.Group();
  const b = createBuilder();
  const pts = track.samples.slice(0, track.length).filter((p) => p.tunnel);
  if (!pts.length) return b.build();
  const ryOf = (p) => Math.PI / 2 - p.h;
  // 上に別の道が重なる所（らせんの段、らせんに入る道の横）: 壁はその道の下まで、天井は作らない（上の道の裏が天井）
  const near = (x, z, r) => pts.filter((q) => Math.abs(q.x - x) < r && Math.abs(q.z - z) < r);
  const roof = (p, x, z, r) => {
    let top = TUNNEL_HEIGHT;
    for (const q of near(x, z, r + 15)) {
      // 同じ道の近く（坂のうしろの、少し高い所）は、上を通る道ではない
      if (Math.min(Math.abs(q.s - p.s), track.length - Math.abs(q.s - p.s)) < 60) continue;
      const dy = q.y - p.y;
      if (dy <= 1 || dy > TUNNEL_HEIGHT + 1) continue;
      if (Math.hypot(q.x - x, q.z - z) < q.wall + r) top = Math.min(top, dy - 0.3);
    }
    return top;
  };
  // 壁・天井・道の裏は、点と点をつないだ一続きの面（板を並べると、カーブですき間から縦じまに見えた。2026-10-18 のユーザー依頼）
  const rightOf = (p) => [-Math.sin(p.h), Math.cos(p.h)];
  const info = pts.map((p) => {
    const w = p.wall + 0.5;
    const [rx, rz] = rightOf(p);
    return {
      p,
      w,
      wall: { '-1': roof(p, p.x - rx * w, p.z - rz * w, 0.5), 1: roof(p, p.x + rx * w, p.z + rz * w, 0.5) },
      ceil: roof(p, p.x, p.z, w) >= TUNNEL_HEIGHT,
    };
  });
  const pos = [];
  const col = [];
  const c = new THREE.Color();
  const quad = (a, bb, cc, d, color) => {
    pos.push(...a, ...bb, ...cc, ...cc, ...bb, ...d);
    c.setHex(color);
    for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
  };
  const at = (p, lat, y) => {
    const [rx, rz] = rightOf(p);
    return [p.x + rx * lat, y, p.z + rz * lat];
  };
  for (let k = 0; k + 1 < info.length; k++) {
    const A = info[k];
    const B = info[k + 1];
    if (track.samples[A.p.next] !== B.p) continue;
    for (const side of [-1, 1]) {
      const ha = A.wall[side];
      const hb = B.wall[side];
      if (ha > 0.3 && hb > 0.3) quad(at(A.p, side * A.w, A.p.y), at(B.p, side * B.w, B.p.y), at(A.p, side * A.w, A.p.y + ha), at(B.p, side * B.w, B.p.y + hb), WALL);
    }
    if (A.ceil && B.ceil) quad(at(A.p, -A.w, A.p.y + TUNNEL_HEIGHT + 0.3), at(B.p, -B.w, B.p.y + TUNNEL_HEIGHT + 0.3), at(A.p, A.w, A.p.y + TUNNEL_HEIGHT + 0.3), at(B.p, B.w, B.p.y + TUNNEL_HEIGHT + 0.3), CEIL);
    // 道の裏（下の段から見たときの天井。道の絵が透けて見えないように。2026-10-18 のユーザー依頼「上部に道路が映っている」）
    quad(at(A.p, -A.w, A.p.y - 0.3), at(B.p, -B.w, B.p.y - 0.3), at(A.p, A.w, A.p.y - 0.3), at(B.p, B.w, B.p.y - 0.3), CEIL);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  group.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  group.add(moundMesh(track, info));
  // 入口と出口: 石のアーチ（はば 道いっぱい、厚さ 2m）
  for (const p of [pts[0], pts[pts.length - 1]]) {
    const w = p.wall + 1.5;
    b.push(p.x, p.y, p.z, ryOf(p));
    b.box(2.5, TUNNEL_HEIGHT + 3, 2, ARCH, -w, 0, 0);
    b.box(2.5, TUNNEL_HEIGHT + 3, 2, ARCH, w, 0, 0);
    b.box(2 * w + 2.5, 3, 2, ARCH, 0, TUNNEL_HEIGHT, 0);
    b.pop();
  }
  group.add(b.build());
  return group;
}

// トンネルの外は雪の山（2026-10-19 のユーザー依頼「トンネルの外観は全て雪で覆って。山の下に隠してしまってよい」）
// 天井の上に雪をかぶせ、壁の外がわは、天井の高さから下の地面まで雪の坂。ほかの道の上にはかからない
export const MOUND_ABOVE = 8.8; // 道から雪の上まで（天井 8.3m の上。上を通るほかの道は 9m より上）
const MOUND_GAP = 0.6; // 雪は壁の 0.6m 外から（壁と同じ所だと、ちらついて灰色の壁が見えた）
const MOUND_SLOPE = 1.2; // 雪の坂の横の長さ ÷ 高さ
const MOUND_CLEAR = 3; // ほかの道の柵から、雪の坂のはしまで（m）
const SNOW = 0xf2f6fb; // 雪山の地面と同じ色（src/render/terrain.js）

// 雪の坂（点ごと・左右ごと）: { i, side, w: 壁の位置, top: 上の高さ, base: 下の地面の高さ, reach: 壁から坂のはしまで, end: はしの高さ }
// tunnelInfo は buildTunnel の中の点ごとの情報（壁の高さ）。なければ作る
export function snowMound(track, tunnelInfo = null) {
  const samples = track.samples.slice(0, track.length);
  const pts = samples.filter((p) => p.tunnel);
  const others = track.samples.filter((q) => !q.tunnel && q.y !== null);
  const info = tunnelInfo ?? pts.map((p) => ({ p, w: p.wall + 0.5, wall: { '-1': TUNNEL_HEIGHT, 1: TUNNEL_HEIGHT } }));
  const out = [];
  for (const it of info) {
    const p = it.p;
    const top = p.y + MOUND_ABOVE;
    let base = p.y;
    for (const q of pts) if (Math.abs(q.x - p.x) < 40 && Math.abs(q.z - p.z) < 40) base = Math.min(base, q.y);
    base -= 3;
    for (const side of [-1, 1]) {
      if (it.wall[side] < TUNNEL_HEIGHT - 0.01) continue; // 上をほかの道が通る壁（らせんの下の段）は、上の段の雪の下
      const rx = -Math.sin(p.h) * side;
      const rz = Math.cos(p.h) * side;
      // 壁の真下をほかの道が通る（トンネルが B の上を渡る所）: 雪はその道の上 6m まで
      let floor = base;
      for (const q of others) {
        if (Math.abs(q.x - p.x) > 40 || Math.abs(q.z - p.z) > 40 || q.y >= p.y) continue;
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        const l = dx * rx + dz * rz - it.w;
        if (Math.abs(dx * Math.cos(p.h) + dz * Math.sin(p.h)) <= q.wall + 4 && l - q.wall - MOUND_CLEAR < 0 && l + q.wall > 0) floor = Math.max(floor, q.y + 6);
      }
      const full = (top - floor) * MOUND_SLOPE;
      let reach = full;
      for (const q of others) {
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        if (Math.abs(dx) > it.w + full + 20 || Math.abs(dz) > it.w + full + 20) continue;
        const along = dx * Math.cos(p.h) + dz * Math.sin(p.h);
        if (Math.abs(along) > q.wall + 4) continue;
        const l = dx * rx + dz * rz - it.w - MOUND_GAP; // 雪の内がわから外への距離
        const near = l - q.wall - MOUND_CLEAR; // ほかの道の柵の手前
        if (l + q.wall < 0) continue; // 反対がわ
        const h = top - ((top - floor) * Math.max(0, near)) / full; // その道の柵の手前での雪の高さ
        if (h > q.y - 1) reach = Math.min(reach, Math.max(0, near));
      }
      // トンネルのほかの所（らせんの別の段の横・入口へ向かう所の横など）: 雪がトンネルの中を通らない
      // （中から白い壁が見えた。2026-10-19 のユーザー依頼）
      for (const q of pts) {
        if (Math.min(Math.abs(q.s - p.s), track.length - Math.abs(q.s - p.s)) < 60) continue;
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        if (Math.abs(dx) > it.w + full + 20 || Math.abs(dz) > it.w + full + 20) continue;
        if (Math.abs(dx * Math.cos(p.h) + dz * Math.sin(p.h)) > q.wall + 4) continue;
        if (dx * rx + dz * rz < it.w) continue; // 反対がわ・真下や真上の段（らせん）
        const l = dx * rx + dz * rz - it.w - MOUND_GAP;
        const qw = q.wall + 0.5 + MOUND_GAP + 1; // その所の雪の外まで
        const near = l - qw;
        const hNear = top - ((top - floor) * Math.max(0, near)) / full;
        const hFar = top - ((top - floor) * Math.max(0, l + qw)) / full;
        if (hFar < q.y + MOUND_ABOVE + 1 && hNear > q.y - 1) reach = Math.min(reach, Math.max(0, near));
      }
      out.push({ i: track.samples.indexOf(p), side, w: it.w + MOUND_GAP, top, base: floor, reach, end: top - ((top - floor) * reach) / full });
    }
  }
  return out;
}

function moundMesh(track, info) {
  const slopes = snowMound(track, info);
  const bySide = new Map(slopes.map((m) => [`${m.i}:${m.side}`, m]));
  const pos = [];
  // 三角は、表（反時計回り）が外（ref の向き）を向くように並べる。表だけを描くので、トンネルの中から
  // 壁のすき間ごしに見ると裏になり、雪は見えない（2026-10-19 のユーザー依頼「トンネル内に白い壁がみえている」）
  const tri = (a, b, c, ref) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const dot = (uy * vz - uz * vy) * ref[0] + (uz * vx - ux * vz) * ref[1] + (ux * vy - uy * vx) * ref[2];
    if (dot >= 0) pos.push(...a, ...b, ...c);
    else pos.push(...a, ...c, ...b);
  };
  const quad = (a, b, c, d, ref) => {
    tri(a, b, c, ref);
    tri(c, b, d, ref);
  };
  const at = (p, lat, y) => [p.x - Math.sin(p.h) * lat, y, p.z + Math.cos(p.h) * lat];
  for (let k = 0; k + 1 < info.length; k++) {
    const A = info[k];
    const B = info[k + 1];
    if (track.samples[A.p.next] !== B.p) continue;
    // 天井の上の雪
    const wa = A.w + MOUND_GAP;
    const wb = B.w + MOUND_GAP;
    if (A.ceil && B.ceil) quad(at(A.p, -wa, A.p.y + MOUND_ABOVE), at(B.p, -wb, B.p.y + MOUND_ABOVE), at(A.p, wa, A.p.y + MOUND_ABOVE), at(B.p, wb, B.p.y + MOUND_ABOVE), [0, 1, 0]);
    const ia = track.samples.indexOf(A.p);
    const ib = track.samples.indexOf(B.p);
    for (const side of [-1, 1]) {
      const ma = bySide.get(`${ia}:${side}`);
      const mb = bySide.get(`${ib}:${side}`);
      if (!ma || !mb) continue;
      // 坂（壁の上 → はし）と、はしから下の地面までの雪の壁。外は、道から横へ離れる向き
      const out = [-Math.sin(A.p.h) * side, 0, Math.cos(A.p.h) * side];
      quad(at(A.p, side * ma.w, ma.top), at(B.p, side * mb.w, mb.top), at(A.p, side * (ma.w + ma.reach), ma.end), at(B.p, side * (mb.w + mb.reach), mb.end), [out[0], 1, out[2]]);
      quad(at(A.p, side * (ma.w + ma.reach), ma.end), at(B.p, side * (mb.w + mb.reach), mb.end), at(A.p, side * (ma.w + ma.reach), ma.base), at(B.p, side * (mb.w + mb.reach), mb.base), out);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  // 立った雪の壁は、日の当たらない向きだと灰色の壁に見えるので、少し明るく（自分で光る分）
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: SNOW, emissive: 0x8a8e94 }));
}

// トンネルの中の暗さ（2026-10-18 のユーザー依頼「トンネル内は画面がブラックアウトし、カートにライト、視野が一部制限」）
export const TUNNEL_BLACK = 0.25; // 入るときのまっくらの秒数
export const TUNNEL_FADE = 0.6; // 出るときに明るくなる秒数
export const TUNNEL_DIM = 0.35; // 中の明るさ（外を 1 として。2026-10-18 のユーザー依頼「タブレットだと暗すぎる」で 0.15 から）
// トンネルの中の見え方。dim 中の明るさ（外を 1 として）、vignette まわりの暗さ、headlight 車のライト、fog 霧の色と見える距離（m）
// タブレット・スマホ（指で操作する端末）は画面が暗く見えるので明るめ（2026-10-19 のユーザー依頼「PC は問題ないが、アンドロイドタブレットだとまだ暗い」）
const LOOK_PC = { dim: TUNNEL_DIM, vignette: 0.55, headlight: 120, fog: 0x07090c, fogNear: 8, fogFar: 70 };
const LOOK_TOUCH = { dim: 0.7, vignette: 0.2, headlight: 200, fog: 0x3a424e, fogNear: 30, fogFar: 180 };
// 指だけで操作する端末か（matchMedia を渡す）。タッチ画面つきの PC（マウス・タッチパッドもある）は PC とする
// （2026-10-19 のユーザー依頼「PC 版のトンネルの暗さを前の暗さに戻して。今はかなり明るい」）
export function touchOnly(matchMedia) {
  if (!matchMedia) return false;
  return matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
}
export function tunnelLook(touch) {
  return touch ? LOOK_TOUCH : LOOK_PC;
}
// state = { dark: 0〜1 の暗さ, black: 入るときのまっくら 0〜1 }。inside は自分の車がトンネルの中か
export function tunnelLight(state, inside, dt) {
  let { dark, black } = state;
  if (inside && dark === 0 && black === 0) black = 1; // 明るい所から入った
  if (black > 0) {
    black = Math.max(0, black - dt / TUNNEL_BLACK);
    if (black === 0) dark = 1;
    return { dark, black };
  }
  dark = inside ? Math.min(1, dark + dt / TUNNEL_FADE) : Math.max(0, dark - dt / TUNNEL_FADE);
  return { dark, black };
}
