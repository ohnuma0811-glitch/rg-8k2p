// 箱と円柱と文字の板を集めて、まとめて描ける形にする
// 街の景色は形がとても多いので、色ごとに分けず、頂点の色にして1つの形にまとめる（描く回数を減らす）
import * as THREE from '../../../vendor/three.module.min.js?v=d553df2';

const MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true });
// 光る形（夜の窓・ネオン・光る看板。Global City）: 光の当たり方に関係なく、その色のまま
const GLOW = new THREE.MeshBasicMaterial({ vertexColors: true });

// glow: 光る形の builder にする
export function createBuilder({ glow = false } = {}) {
  const pos = [];
  const nor = [];
  const col = [];
  const labels = [];
  const stack = [new THREE.Matrix4()];
  const top = () => stack[stack.length - 1];
  const c = new THREE.Color();
  const local = (x, y, z, ry) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);

  function add(geo, color, x, y, z, ry) {
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(top(), local(x, y, z, ry)));
    const g = geo.index ? geo.toNonIndexed() : geo;
    c.setHex(color);
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i += 3) {
      pos.push(p[i], p[i + 1], p[i + 2]);
      nor.push(n[i], n[i + 1], n[i + 2]);
      col.push(c.r, c.g, c.b);
    }
  }

  return {
    // 幅 w（x）・高さ h（y）・奥行き d（z）。(x, y, z) は底の真ん中。ry は y のまわりの回転
    box(w, h, d, color, x, y, z, ry = 0) {
      add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, ry);
    },
    // 立てた円柱（上の半径 rTop、下の半径 rBottom、高さ h）。(x, y, z) は底の真ん中
    // open: 上下のふたなし（木の幹や円すいの葉など、ふたが見えない所。三角が半分になる）
    cyl(rTop, rBottom, h, segments, color, x, y, z, open = false) {
      add(new THREE.CylinderGeometry(rTop, rBottom, h, segments, 1, open), color, x, y + h / 2, z, 0);
    },
    // 球（半径 r）。(x, y, z) は真ん中（Global City の桜の花・ドーム など）
    sphere(r, color, x, y, z, segments = 8) {
      add(new THREE.SphereGeometry(r, segments, Math.max(4, Math.round(segments * 0.75))), color, x, y, z, 0);
    },
    // 2点をつなぐ棒（半径 r。つり橋のケーブル・鉄の格子 など）
    rod(x1, y1, z1, x2, y2, z2, r, color, segments = 4) {
      const a = new THREE.Vector3(x1, y1, z1);
      const d = new THREE.Vector3(x2 - x1, y2 - y1, z2 - z1);
      const len = d.length();
      if (len < 1e-6) return;
      const g = new THREE.CylinderGeometry(r, r, len, segments, 1, true);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
      const mid = a.add(d.multiplyScalar(0.5));
      add(g, color, mid.x, mid.y, mid.z, 0);
    },
    // x の向きに寝かせた円柱（半径 r、長さ len）。(x, y, z) は真ん中
    cylX(r, len, segments, color, x, y, z) {
      const g = new THREE.CylinderGeometry(r, r, len, segments);
      g.rotateZ(Math.PI / 2);
      add(g, color, x, y, z, 0);
    },
    // 文字や絵の板（キャンバス）。draw(g, w, h) で描き、draw.key で同じ絵を使い回す。板の前は +z、(x, y, z) は板の真ん中
    label(draw, px, x, y, z, ry, w, h) {
      labels.push({ draw, px, m: new THREE.Matrix4().multiplyMatrices(top(), local(x, y, z, ry)), w, h });
    },
    // ここから先の形を、(x, y, z) に ry だけ回して置く（pop で戻す）
    push(x, y, z, ry = 0) {
      stack.push(new THREE.Matrix4().multiplyMatrices(top(), local(x, y, z, ry)));
    },
    pop() {
      stack.pop();
    },
    build() {
      const group = new THREE.Group();
      if (pos.length) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        group.add(new THREE.Mesh(geo, glow ? GLOW : MATERIAL));
      }
      for (const l of labels) {
        const m = labelMesh(l);
        if (m) group.add(m);
      }
      return group;
    },
  };
}

// 文字の板（同じ絵のキャンバスは作り直さない）。node のテストでは document がないので作らない
const textures = new Map();
function labelMesh({ draw, px, m, w, h }) {
  if (typeof document === 'undefined') return null;
  const key = `${draw.key ?? draw.toString()}|${px[0]}x${px[1]}`;
  if (!textures.has(key)) {
    const cv = document.createElement('canvas');
    cv.width = px[0];
    cv.height = px[1];
    draw(cv.getContext('2d'), px[0], px[1]);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    textures.set(key, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
  }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), textures.get(key));
  mesh.applyMatrix4(m);
  return mesh;
}
