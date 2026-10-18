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

// トンネルの中の暗さ（2026-10-18 のユーザー依頼「トンネル内は画面がブラックアウトし、カートにライト、視野が一部制限」）
export const TUNNEL_BLACK = 0.25; // 入るときのまっくらの秒数
export const TUNNEL_FADE = 0.6; // 出るときに明るくなる秒数
export const TUNNEL_DIM = 0.35; // 中の明るさ（外を 1 として。2026-10-18 のユーザー依頼「タブレットだと暗すぎる」で 0.15 から）
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
