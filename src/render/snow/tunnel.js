// トンネル（Kyugo Mountain。2026-10-18 のユーザー依頼）: トンネルの点にそって、両がわの壁と天井。入口と出口に石のアーチ
import * as THREE from '../../../vendor/three.module.min.js?v=fd408eb';
import { createBuilder } from '../town/builder.js?v=fd408eb';

export const TUNNEL_HEIGHT = 8; // 道から天井まで（m）
const CEIL_LATS = [-1, -0.5, 0, 0.5, 1];
const GLASS_ARC = 16; // ガラスの半円を何枚の板で作るか // 天井の高さを決める横の位置（壁の位置を ±1 として）
const WALL = 0x5a5f66;
const CEIL = 0x4a4e55;
// 見た目ごとの壁と天井の色（snow は Kyugo Mountain のトンネル）
const LOOKS = { snow: [WALL, CEIL], rock: [0x6b625a, 0x5a524a], cave: [0x5a524a, 0x463f38], mosque: [0xe8b8c0, 0xf0d0d6], glass: [0x9fd0e8, 0xbfe8ff], concrete: [0xa8adb2, 0x9aa0a6] };
const lookOf = (p) => LOOKS[p.tunnelLook ?? 'snow'] ?? LOOKS.snow;
const ARCH = 0x9a958c;

export function buildTunnel(track) {
  const group = new THREE.Group();
  const b = createBuilder();
  // 暗いトンネル（p.tunnel）と、見た目だけのトンネル（p.tunnelLook。Global City の山のトンネル・海の底・モスク・洞窟）
  const pts = track.samples.slice(0, track.length).filter((p) => (p.tunnel || p.tunnelLook) && !p.auto);
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
      // 中の天井の高さ（横に5か所）。上・横にらせんの段が重なる所は、その道の裏のすぐ下まで下げる
      // （天井を丸ごとなくすと、すき間から外の雪が見えた。2026-10-20 のユーザー依頼）
      ceilH: CEIL_LATS.map((u) => {
        const h = roof(p, p.x + rx * w * u, p.z + rz * w * u, 0.5);
        return h >= TUNNEL_HEIGHT ? TUNNEL_HEIGHT + 0.3 : h;
      }),
    };
  });
  const pos = [];
  const col = [];
  // ガラスのトンネル（Global City の海の底）は、別の透明な形に
  const gpos = [];
  const gcol = [];
  const c = new THREE.Color();
  let glassNow = false;
  const quad = (a, bb, cc, d, color) => {
    const P = glassNow ? gpos : pos;
    const C = glassNow ? gcol : col;
    P.push(...a, ...bb, ...cc, ...cc, ...bb, ...d);
    c.setHex(color);
    for (let k = 0; k < 6; k++) C.push(c.r, c.g, c.b);
  };
  const at = (p, lat, y) => {
    const [rx, rz] = rightOf(p);
    return [p.x + rx * lat, y, p.z + rz * lat];
  };
  for (let k = 0; k + 1 < info.length; k++) {
    const A = info[k];
    const B = info[k + 1];
    if (track.samples[A.p.next] !== B.p) continue;
    glassNow = A.p.tunnelLook === 'glass';
    if (glassNow) {
      // ガラスのトンネルは半円（半径は道のはしまで。2026-10-20 のユーザー依頼）
      const arc = (it, a) => at(it.p, -Math.cos(a) * it.w, it.p.y + Math.sin(a) * it.w);
      for (let j = 0; j < GLASS_ARC; j++) {
        const a0 = (Math.PI * j) / GLASS_ARC;
        const a1 = (Math.PI * (j + 1)) / GLASS_ARC;
        quad(arc(A, a0), arc(B, a0), arc(A, a1), arc(B, a1), lookOf(A.p)[j % 2]);
      }
      glassNow = false;
      quad(at(A.p, -A.w, A.p.y - 0.3), at(B.p, -B.w, B.p.y - 0.3), at(A.p, A.w, A.p.y - 0.3), at(B.p, B.w, B.p.y - 0.3), CEIL);
      continue;
    }
    for (const side of [-1, 1]) {
      // 壁は天井の高さまで（壁の上と天井の間に 0.3m のすき間があり、外の雪が白く見えた。2026-10-20 のユーザー依頼）
      const ha = A.wall[side] >= TUNNEL_HEIGHT ? TUNNEL_HEIGHT + 0.3 : A.wall[side];
      const hb = B.wall[side] >= TUNNEL_HEIGHT ? TUNNEL_HEIGHT + 0.3 : B.wall[side];
      if (ha > 0.3 && hb > 0.3) quad(at(A.p, side * A.w, A.p.y), at(B.p, side * B.w, B.p.y), at(A.p, side * A.w, A.p.y + ha), at(B.p, side * B.w, B.p.y + hb), lookOf(A.p)[0]);
    }
    for (let k2 = 0; k2 + 1 < CEIL_LATS.length; k2++) {
      const [u0, u1] = [CEIL_LATS[k2], CEIL_LATS[k2 + 1]];
      const h = [A.ceilH[k2], A.ceilH[k2 + 1], B.ceilH[k2], B.ceilH[k2 + 1]];
      if (Math.min(...h) < 3.5) continue; // 車が通れない低さの天井は作らない（上の道の裏が天井）
      quad(at(A.p, A.w * u0, A.p.y + h[0]), at(B.p, B.w * u0, B.p.y + h[2]), at(A.p, A.w * u1, A.p.y + h[1]), at(B.p, B.w * u1, B.p.y + h[3]), lookOf(A.p)[1]);
    }
    // 道の裏（下の段から見たときの天井。道の絵が透けて見えないように。2026-10-18 のユーザー依頼「上部に道路が映っている」）
    quad(at(A.p, -A.w, A.p.y - 0.3), at(B.p, -B.w, B.p.y - 0.3), at(A.p, A.w, A.p.y - 0.3), at(B.p, B.w, B.p.y - 0.3), CEIL);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  group.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  if (gpos.length) {
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3));
    gg.setAttribute('color', new THREE.Float32BufferAttribute(gcol, 3));
    gg.computeVertexNormals();
    const glass = new THREE.Mesh(gg, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.22, depthWrite: false }));
    glass.userData.keep = true;
    group.add(glass);
    // 輪の骨組み（60m ごと、白い細い半円の枠。多いとじゃまなので少なく。2026-10-20 のユーザー依頼）
    const ribs = createBuilder();
    for (let k = 0; k < info.length; k += 60) {
      const it = info[k];
      if (it.p.tunnelLook !== 'glass') continue;
      const p = it.p;
      const [rx, rz] = rightOf(p);
      const pt = (a) => [p.x - rx * Math.cos(a) * it.w, p.y + Math.sin(a) * it.w, p.z - rz * Math.cos(a) * it.w];
      for (let j = 0; j < GLASS_ARC; j++) ribs.rod(...pt((Math.PI * j) / GLASS_ARC), ...pt((Math.PI * (j + 1)) / GLASS_ARC), 0.15, 0xeef6ff);
    }
    group.add(ribs.build());
  }
  // モスクの回廊（Global City）: ピンクの柱と、上がとがったアーチを 6m ごと
  // バトゥ洞窟（Global City）: 天井から下がる灰色の鍾乳石
  const deco = createBuilder();
  const lamps = createBuilder({ glow: true });
  let cave = 0;
  info.forEach((it, k) => {
    const p = it.p;
    const [rx, rz] = rightOf(p);
    const w = it.w - 0.6;
    if (p.tunnelLook === 'mosque' && k % 6 === 0) {
      const top = p.y + TUNNEL_HEIGHT;
      for (const side of [-1, 1]) {
        deco.cyl(0.5, 0.6, TUNNEL_HEIGHT - 2.5, 8, 0xe8b8c0, p.x + rx * side * w, p.y, p.z + rz * side * w); // 柱
        deco.rod(p.x + rx * side * w, top - 2.5, p.z + rz * side * w, p.x, top - 0.2, p.z, 0.3, 0xffe6ea); // アーチ（とがった形）
      }
    }
    // 海にもぐるコンクリートのトンネル（Global City）: 天井に明かりの列（2026-10-21）
    if (p.tunnelLook === 'concrete' && k % 8 === 0) {
      for (const side of [-1, 1]) lamps.box(0.6, 0.25, 3, 0xfff2c8, p.x + rx * side * w * 0.5, p.y + TUNNEL_HEIGHT - 0.2, p.z + rz * side * w * 0.5);
    }
    if (p.tunnelLook === 'cave' && k % 3 === 0) {
      cave++;
      const lat = (((cave * 37) % 9) / 4 - 1) * w * 0.8;
      const h = 1.5 + (cave % 4) * 0.8;
      deco.cyl(0.6 + (cave % 3) * 0.3, 0, h, 5, 0x8a8a86, p.x + rx * lat, p.y + TUNNEL_HEIGHT - h, p.z + rz * lat); // 鍾乳石
    }
  });
  group.add(deco.build(), lamps.build());
  // 雪の山は、雪のトンネル（Kyugo Mountain）だけ
  const snowInfo = info.filter((it) => (it.p.tunnelLook ?? 'snow') === 'snow');
  if (snowInfo.length) group.add(moundMesh(track, snowInfo));
  // 入口と出口: 石のアーチ（はば 道いっぱい、厚さ 2m）。トンネルが いくつもあるときは、それぞれのはし
  const ends = pts.filter((p) => p.tunnelLook !== 'glass' && (!pts.includes(track.samples[p.prev]) || !pts.includes(track.samples[p.next])));
  for (const p of ends) {
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
const cellKey = (gx, gz) => gx * 100003 + gz; // ます目の番号（文字を作らない）
export function snowMound(track, tunnelInfo = null) {
  const samples = track.samples.slice(0, track.length);
  const pts = samples.filter((p) => p.tunnel);
  const others = track.samples.filter((q) => !q.tunnel && q.y !== null);
  const info = tunnelInfo ?? pts.map((p) => ({ p, w: p.wall + 0.5, wall: { '-1': TUNNEL_HEIGHT, 1: TUNNEL_HEIGHT } }));
  const index = new Map(track.samples.map((p, i) => [p, i]));
  const noCeil = new Set(info.filter((it) => it.ceil === false).map((it) => it.p));
  // 点のます目（20m）で、(x, z) のまわり r m の点だけを見る（全部の点を毎回見ると重い）
  const gridOf = (list) => {
    const g = new Map();
    for (const q of list) {
      const key = cellKey(Math.floor(q.x / 20), Math.floor(q.z / 20));
      if (!g.has(key)) g.set(key, []);
      g.get(key).push(q);
    }
    return g;
  };
  const around = (g, x, z, r) => {
    const res = [];
    const n = Math.ceil(r / 20);
    const cx = Math.floor(x / 20);
    const cz = Math.floor(z / 20);
    for (let gx = cx - n; gx <= cx + n; gx++) for (let gz = cz - n; gz <= cz + n; gz++) for (const q of g.get(cellKey(gx, gz)) ?? []) res.push(q);
    return res;
  };
  const othersGrid = gridOf(others);
  // トンネルの点のます目（20m）。点 (x, z) の高さ yTop〜yLow の雪が、どこかのトンネルの中（壁の内がわ、道の 1m 下〜天井の上）に入るか
  const cells = new Map();
  for (const q of pts) {
    const key = cellKey(Math.floor(q.x / 20), Math.floor(q.z / 20));
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(q);
  }
  const insideTunnel = (x, z, yTop, yLow) => {
    const cx = Math.floor(x / 20);
    const cz = Math.floor(z / 20);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gz = cz - 1; gz <= cz + 1; gz++) {
        for (const q of cells.get(cellKey(gx, gz)) ?? []) {
          const dx = x - q.x;
          const dz = z - q.z;
          if (Math.abs(dx * Math.cos(q.h) + dz * Math.sin(q.h)) > 0.75) continue;
          if (Math.abs(-dx * Math.sin(q.h) + dz * Math.cos(q.h)) >= q.wall + 0.5 + MOUND_GAP) continue;
          // 天井のない所（上にらせんの段が重なる所）は、もう1段上まで中（天井のすき間から上の雪が見えた）
          const roofY = noCeil.has(q) ? q.y + 2 * TUNNEL_HEIGHT + 2 : q.y + MOUND_ABOVE + 0.5;
          if (yLow < roofY && yTop > q.y - 1) return true;
        }
      }
    }
    return false;
  };
  const out = [];
  for (const it of info) {
    const p = it.p;
    const top = p.y + MOUND_ABOVE;
    let base = p.y;
    for (const q of around(cells, p.x, p.z, 40)) if (Math.abs(q.x - p.x) < 40 && Math.abs(q.z - p.z) < 40) base = Math.min(base, q.y);
    base -= 3;
    for (const side of [-1, 1]) {
      if (it.wall[side] < TUNNEL_HEIGHT - 0.01) continue; // 上をほかの道が通る壁（らせんの下の段）は、上の段の雪の下
      const rx = -Math.sin(p.h) * side;
      const rz = Math.cos(p.h) * side;
      // 壁の真下をほかの道が通る（トンネルが B の上を渡る所）: 雪はその道の上 6m まで
      let floor = base;
      for (const q of around(othersGrid, p.x, p.z, 40)) {
        if (Math.abs(q.x - p.x) > 40 || Math.abs(q.z - p.z) > 40 || q.y >= p.y) continue;
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        const l = dx * rx + dz * rz - it.w;
        if (Math.abs(dx * Math.cos(p.h) + dz * Math.sin(p.h)) <= q.wall + 4 && l - q.wall - MOUND_CLEAR < 0 && l + q.wall > 0) floor = Math.max(floor, q.y + 6);
      }
      const full = (top - floor) * MOUND_SLOPE;
      let reach = full;
      for (const q of around(othersGrid, p.x, p.z, it.w + full + 20)) {
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
      for (const q of around(cells, p.x, p.z, it.w + full + 20)) {
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
      // 坂の上を 1m ごとに、トンネルのどこかの中（カーブの内がわの先など）に入らないか調べ、入る所の手前で止める
      // （2026-10-20 のユーザー依頼「トンネル内で白い壁があって、先が見えない」）
      const w0 = it.w + MOUND_GAP;
      for (let d = 1; d <= reach; d += 1) { // 根もと（壁のすぐ外）は、カーブの内がわでとなりの点から見ると中に入るので、1m 外から
        const x = p.x + rx * (w0 + d);
        const z = p.z + rz * (w0 + d);
        const h = top - ((top - floor) * d) / full;
        if (insideTunnel(x, z, h, h - (top - floor) * (1 / full))) {
          reach = Math.max(0, d - 1);
          break;
        }
      }
      out.push({ i: index.get(p), side, w: w0, top, base: floor, reach, end: top - ((top - floor) * reach) / full });
    }
  }
  // 坂のはしから下へのびる雪の壁は、下を通るトンネルの天井の上で止める（らせんの段の雪の壁が、下の道のトンネルの中を縦に突きぬけていた）
  const tunnelTopBelow = (x, z, yFrom) => {
    let top = -Infinity;
    const cx = Math.floor(x / 20);
    const cz = Math.floor(z / 20);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gz = cz - 1; gz <= cz + 1; gz++) {
        for (const q of cells.get(cellKey(gx, gz)) ?? []) {
          const dx = x - q.x;
          const dz = z - q.z;
          if (Math.abs(dx * Math.cos(q.h) + dz * Math.sin(q.h)) > 1.5) continue;
          if (Math.abs(-dx * Math.sin(q.h) + dz * Math.cos(q.h)) >= q.wall + 0.5 + MOUND_GAP + 1) continue;
          if (q.y - 1 < yFrom - 0.5) top = Math.max(top, q.y + MOUND_ABOVE + 0.5);
        }
      }
    }
    return top;
  };
  const setBottom = (m) => {
    const p = track.samples[m.i];
    const d = m.w + m.reach;
    const x = p.x - Math.sin(p.h) * m.side * d;
    const z = p.z + Math.cos(p.h) * m.side * d;
    m.bottom = Math.min(m.end, Math.max(m.base, tunnelTopBelow(x, z, m.end)));
  };
  // 坂の長さは、前後 SMOOTH 点のいちばん短いものにそろえる（となりとばらばらだと、外から見て、くしの歯のようなしまになった）
  {
    const SMOOTH = 8;
    const byKey = new Map(out.map((m) => [`${m.i}:${m.side}`, m]));
    const raw = new Map(out.map((m) => [m, m.reach]));
    for (const m of out) {
      let r = raw.get(m);
      for (const dir of ['next', 'prev']) {
        let i = m.i;
        for (let k = 0; k < SMOOTH; k++) {
          i = track.samples[i][dir];
          const o = byKey.get(`${i}:${m.side}`);
          if (!o) break;
          r = Math.min(r, raw.get(o) + k + 1); // 離れるほど、少しずつ長くてよい
        }
      }
      const full = (m.top - m.base) * MOUND_SLOPE;
      m.reach = r;
      m.end = m.top - ((m.top - m.base) * r) / full;
    }
  }
  // となり合う2点の間の坂の面も、トンネルの中を横切らないように（坂の長さが大きくちがうと、面がななめにカーブの内がわを横切る）
  const at = (m, frac, d) => {
    const p = track.samples[m.i];
    const rx = -Math.sin(p.h) * m.side;
    const rz = Math.cos(p.h) * m.side;
    return [p.x + rx * (m.w + d * m.reach), p.z + rz * (m.w + d * m.reach)];
  };
  const bySide = new Map(out.map((m) => [`${m.i}:${m.side}`, m]));
  for (let pass = 0; pass < 20; pass++) {
    let changed = false;
    for (const m of out) {
      const nb = bySide.get(`${track.samples[m.i].next}:${m.side}`);
      if (!nb) continue;
      const hit = () => {
        if (Math.max(m.reach, nb.reach) < 1) return false;
        for (const u of [0.25, 0.5, 0.75]) {
          for (const d of [0.4, 0.6, 0.8, 1]) {
            const [ax, az] = at(m, 0, d);
            const [bx, bz] = at(nb, 0, d);
            const ha = m.top - (m.top - m.end) * d;
            const hb = nb.top - (nb.top - nb.end) * d;
            const y = ha + (hb - ha) * u;
            if (insideTunnel(ax + (bx - ax) * u, az + (bz - az) * u, y, y - 0.5)) return true;
          }
        }
        return false;
      };
      if (!hit()) continue;
      // 長い方を短い方にそろえ、それでも横切るなら半分ずつ短くする
      const r = Math.min(m.reach, nb.reach, Math.max(m.reach, nb.reach) / 2);
      for (const k of [m, nb]) {
        const full = (k.top - k.base) * MOUND_SLOPE;
        k.reach = r < 1 ? 0 : r;
        k.end = k.top - ((k.top - k.base) * k.reach) / full;
      }
      changed = true;
    }
    if (!changed) break;
  }
  for (const m of out) setBottom(m);
  return out;
}

function moundMesh(track, info) {
  const slopes = snowMound(track, info);
  const bySide = new Map(slopes.map((m) => [`${m.i}:${m.side}`, m]));
  const index = new Map(track.samples.map((p, i) => [p, i]));
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
    const ia = index.get(A.p);
    const ib = index.get(B.p);
    for (const side of [-1, 1]) {
      const ma = bySide.get(`${ia}:${side}`);
      const mb = bySide.get(`${ib}:${side}`);
      if (!ma || !mb) continue;
      // 坂（壁の上 → はし）と、はしから下の地面までの雪の壁。外は、道から横へ離れる向き
      const out = [-Math.sin(A.p.h) * side, 0, Math.cos(A.p.h) * side];
      quad(at(A.p, side * ma.w, ma.top), at(B.p, side * mb.w, mb.top), at(A.p, side * (ma.w + ma.reach), ma.end), at(B.p, side * (mb.w + mb.reach), mb.end), [out[0], 1, out[2]]);
      quad(at(A.p, side * (ma.w + ma.reach), ma.end), at(B.p, side * (mb.w + mb.reach), mb.end), at(A.p, side * (ma.w + ma.reach), ma.bottom), at(B.p, side * (mb.w + mb.reach), mb.bottom), out);
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
export const TUNNEL_DIM = 0.25; // PC の中の明るさ（外を 1 として。2026-10-18 に 0.15 から 0.35、2026-10-20 のユーザー依頼「PC用も少し暗くして」で 0.25）
// トンネルの中の見え方。dim 中の明るさ（外を 1 として）、vignette まわりの暗さ、headlight 車のライト、fog 霧の色と見える距離（m）
// タブレット・スマホ（指で操作する端末）は画面が暗く見えるので明るめ（2026-10-19 のユーザー依頼「PC は問題ないが、アンドロイドタブレットだとまだ暗い」）
const LOOK_PC = { dim: TUNNEL_DIM, vignette: 0.55, headlight: 120, fog: 0x07090c, fogNear: 8, fogFar: 70 };
const LOOK_TOUCH = { dim: 0.7, vignette: 0.2, headlight: 200, fog: 0x3a424e, fogNear: 30, fogFar: 180 };
// 指だけで操作する端末か（matchMedia を渡す）。タッチ画面つきの PC（マウス・タッチパッドもある）は PC とする
// （2026-10-19 のユーザー依頼「PC 版のトンネルの暗さを前の暗さに戻して。今はかなり明るい」）
// 端末の名前（userAgent）が Android・iPhone・iPad のときも、指で操作する端末とする（ペンやキーボードカバーで「細かく指せるもの」が
// あると答えるタブレットが、PC の暗さになっていた。2026-10-20 のユーザー依頼「タブレットだと非常に暗い」）。
// iPad は Mac と名乗るので、触れる点が2つ以上の Mac も iPad とする
export function touchOnly(matchMedia, userAgent = '', maxTouchPoints = 0) {
  if (/Android|iPhone|iPad|iPod/i.test(userAgent)) return true;
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return true;
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
