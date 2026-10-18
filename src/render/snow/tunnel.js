// トンネル（Kyugo Mountain。2026-10-18 のユーザー依頼）: トンネルの点にそって、両がわの壁と天井。入口と出口に石のアーチ
import { createBuilder } from '../town/builder.js?v=0776430';

export const TUNNEL_HEIGHT = 8; // 道から天井まで（m）
const WALL = 0x5a5f66;
const CEIL = 0x4a4e55;
const ARCH = 0x9a958c;
const STEP = 2; // 壁と天井の板の間（m）

export function buildTunnel(track) {
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
  for (let k = 0; k < pts.length; k += STEP) {
    const p = pts[k];
    const w = p.wall + 0.5;
    const [rx, rz] = [-Math.sin(p.h), Math.cos(p.h)];
    b.push(p.x, p.y, p.z, ryOf(p));
    for (const side of [-1, 1]) {
      const h = roof(p, p.x + rx * side * w, p.z + rz * side * w, 0.5);
      // 部品の +x は道の左（ryOf の回転）なので、右（side 1）は -x
      if (h > 0.3) b.box(0.8, h, STEP + 0.2, WALL, -side * w, 0, 0);
    }
    if (roof(p, p.x, p.z, w) >= TUNNEL_HEIGHT) b.box(2 * w + 0.8, 0.6, STEP + 0.2, CEIL, 0, TUNNEL_HEIGHT, 0);
    // 道の裏（下の段から見たときの天井。道の絵が透けて見えないように。2026-10-18 のユーザー依頼「上部に道路が映っている」）
    b.box(2 * w + 0.8, 0.4, STEP + 0.2, CEIL, 0, -0.5, 0);
    b.pop();
  }
  // 入口と出口: 石のアーチ（はば 道いっぱい、厚さ 2m）
  for (const p of [pts[0], pts[pts.length - 1]]) {
    const w = p.wall + 1.5;
    b.push(p.x, p.y, p.z, ryOf(p));
    b.box(2.5, TUNNEL_HEIGHT + 3, 2, ARCH, -w, 0, 0);
    b.box(2.5, TUNNEL_HEIGHT + 3, 2, ARCH, w, 0, 0);
    b.box(2 * w + 2.5, 3, 2, ARCH, 0, TUNNEL_HEIGHT, 0);
    b.pop();
  }
  return b.build();
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
