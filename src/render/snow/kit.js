// 雪山の景色（Kyugo Mountain。2026-10-18 の設計書 4）: 雪のもみの木、スタートの門「Kyugo Mountain」
import * as THREE from '../../../vendor/three.module.min.js?v=767ac96';
import { createBuilder } from '../town/builder.js?v=767ac96';
import { jungleSpots, CHUNK } from '../town/jungle.js?v=767ac96';
import { placeSpot } from '../town/scenery.js?v=767ac96';
import { logGate } from '../forest/kit.js?v=767ac96';
import { terrainHeight } from '../terrain.js?v=767ac96';

const TRUNK = 0x6b4a2b;
const NEEDLES = [0x2f5d3a, 0x2a5534, 0x356842];
const SNOW = 0xf4f7fb;

// 雪のもみの木: 茶色の幹に、緑の円すいを3段、それぞれの上に白い雪（s 倍）
export function fir(b, x, y, z, s = 1, k = 0) {
  b.cyl(0.35 * s, 0.4 * s, 2 * s, 5, TRUNK, x, y, z, true);
  [[3.4, 3.2, 1.6], [2.6, 2.8, 3.6], [1.8, 2.4, 5.4]].forEach(([r, h, yy], n) => {
    b.cyl(0, r * s, h * s, 7, NEEDLES[(k + n) % NEEDLES.length], x, y + yy * s, z, true);
    b.cyl(0, r * 0.62 * s, h * 0.5 * s, 7, SNOW, x, y + (yy + h * 0.52) * s, z, true);
  });
}

// もみの木（道のまわりの森と、コースの内がわ。トンネルの上の山には立てない）と、スタートの門
export function buildSnowScenery(track) {
  const group = new THREE.Group();
  const groundY = (x, z) => terrainHeight(track, x, z);
  // トンネルの上（山でおおった所）には置かない
  const avoid = track.samples.filter((p, i) => p.tunnel && i % 10 === 0).map((p) => ({ x: p.x, z: p.z, radius: p.wall + 12 }));
  // 川のまわりにも置かない
  const river = (track.def.river ?? []).map(([x, z]) => track.toWorld(x, z));
  for (let k = 0; k + 1 < river.length; k++) {
    const a = river[k];
    const c = river[k + 1];
    const n = Math.ceil(Math.hypot(c.x - a.x, c.z - a.z) / 8);
    for (let u = 0; u <= n; u++) avoid.push({ x: a.x + ((c.x - a.x) * u) / n, z: a.z + ((c.z - a.z) * u) / n, radius: 16 });
  }
  const builders = new Map();
  const at = (x, z) => {
    const key = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
    if (!builders.has(key)) builders.set(key, createBuilder());
    return builders.get(key);
  };
  for (const inside of [false, true]) {
    for (const p of jungleSpots(track, avoid, { inside })) {
      if (p.k % 2) continue; // ジャングルより少なく（雪山は見通しよく）
      const s = 0.8 + ((p.k * 37) % 50) / 100;
      fir(at(p.x, p.z), p.x, groundY(p.x, p.z), p.z, s, p.k);
      const mark = new THREE.Object3D();
      mark.position.set(p.x, 0, p.z);
      mark.userData.fir = true;
      group.add(mark);
    }
  }
  for (const b of builders.values()) group.add(b.build());
  // スタートの門（Soki Forest の丸太の門に「Kyugo Mountain」の看板。2026-10-18 の設計書「小文字もまぜる」）
  const gate = createBuilder();
  const start = track.samples[track.startIndex];
  const spot = placeSpot(track, start.s, 1, 1);
  gate.push(spot.x, start.y ?? 0, spot.z, spot.ry);
  logGate(gate, { text: 'Kyugo Mountain', span: 2 * start.wall + 2 });
  gate.pop();
  group.add(gate.build());
  return group;
}
