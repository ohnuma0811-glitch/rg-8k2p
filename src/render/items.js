// アイテムの見た目: 「?」の箱、バナナ、甲羅（飛ぶ・回る）、Star の虹色、稲妻
// 箱・バナナ・甲羅は、種類ごとに1回で描く（InstancedMesh。タブレットで描く回数を増やさない）
import * as THREE from '../../vendor/three.module.min.js?v=bfc0648';
import { BOX_SIZE } from '../game/itemBoxes.js?v=bfc0648';
import { ITEM } from '../game/items.js?v=bfc0648';

const MAX_BOX = 40;
const MAX_BANANA = 64; // 置いたバナナ 20 個と、ぶら下げたバナナ（5個 × 8台）
const MAX_SHELL = 48;

let qTexture = null;
function questionMap() {
  if (qTexture || typeof document === 'undefined') return qTexture;
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 64;
  const c = cv.getContext('2d');
  c.fillStyle = 'rgba(80, 170, 255, 0.85)';
  c.fillRect(0, 0, 64, 64);
  c.strokeStyle = '#ffffff';
  c.lineWidth = 6;
  c.strokeRect(3, 3, 58, 58);
  c.fillStyle = '#ffe14a';
  c.font = 'bold 48px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('?', 32, 35);
  qTexture = new THREE.CanvasTexture(cv);
  return qTexture;
}

// バナナ: 弓なりに曲がった、両はしが細い黄色い実。はしは茶色（2026-10-22 のユーザー依頼「バナナぽく」）
function bananaGeometry() {
  const seg = 16;
  const rad = 8;
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.85, 0.4, 0), new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0.85, 0.4, 0));
  const g = new THREE.TubeGeometry(curve, seg, 0.22, rad, false);
  const pos = g.attributes.position;
  const col = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    const taper = 0.2 + 0.8 * Math.sin(Math.PI * u); // 両はしを細く
    const c = curve.getPoint(u);
    const tip = u < 0.05 || u > 0.95; // はしの1段だけ茶色
    for (let j = 0; j <= rad; j++) {
      const k = i * (rad + 1) + j;
      pos.setXYZ(k, c.x + (pos.getX(k) - c.x) * taper, c.y + (pos.getY(k) - c.y) * taper, c.z + (pos.getZ(k) - c.z) * taper);
      col.push(...(tip ? [0.35, 0.22, 0.06] : [1, 0.86, 0.18]));
    }
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.translate(0, 0.15, 0); // いちばん低い所が地面に着く
  return g;
}

// 甲羅: 半分の球の下に、少し外へはみ出す白いフチ（2026-10-22 のユーザー依頼「甲羅らしく」）。色は頂点の色（材質は白）
export const SHELL_RIM = { R: 0.66, H: 0.16 };
function shellGeometry(hex) {
  const dome = new THREE.SphereGeometry(0.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed(); // 半分の球
  dome.translate(0, SHELL_RIM.H * 0.7, 0); // 白いフチの上にのせる
  const rim = new THREE.CylinderGeometry(SHELL_RIM.R, SHELL_RIM.R, SHELL_RIM.H, 16).toNonIndexed();
  rim.translate(0, SHELL_RIM.H / 2, 0); // いちばん下が地面
  const c = new THREE.Color(hex);
  const pos = [];
  const nor = [];
  const col = [];
  for (const [g, rgb] of [[dome, [c.r, c.g, c.b]], [rim, [1, 1, 1]]]) {
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    for (let i = 0; i < g.attributes.position.count; i++) col.push(...rgb);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// 稲妻: 空（30m）から車までの、ぎざぎざの太い線（幅 0.5m の平らな帯を、前後と左右の2枚、十字に。どの向きからも見える）
export const BOLT = { HEIGHT: 30, WIDTH: 0.5, STEPS: 8 };
function boltGeometry() {
  const pos = [];
  const w = BOLT.WIDTH / 2;
  const pts = [];
  for (let n = 0; n <= BOLT.STEPS; n++) pts.push({ y: BOLT.HEIGHT * (1 - n / BOLT.STEPS), off: n === 0 || n === BOLT.STEPS ? 0 : n % 2 ? 1.2 : -1.2 });
  for (let n = 0; n < BOLT.STEPS; n++) {
    const a = pts[n];
    const b = pts[n + 1];
    // 平らな帯（xy 面と zy 面）。帯の幅は水平方向に w ずつ
    pos.push(a.off - w, a.y, 0, a.off + w, a.y, 0, b.off + w, b.y, 0, a.off - w, a.y, 0, b.off + w, b.y, 0, b.off - w, b.y, 0);
    pos.push(0, a.y, a.off - w, 0, a.y, a.off + w, 0, b.y, b.off + w, 0, a.y, a.off - w, 0, b.y, b.off + w, 0, b.y, b.off - w);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

export function createItemView(scene) {
  const dummy = new THREE.Object3D();
  const map = questionMap();
  const make = (geo, mat, max, kind) => {
    const m = new THREE.InstancedMesh(geo, mat, max);
    m.frustumCulled = false;
    m.count = 0;
    m.userData.kind = kind;
    scene.add(m);
    return m;
  };
  const boxes = make(new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE), new THREE.MeshBasicMaterial({ map, color: map ? 0xffffff : 0x50aaff, transparent: true, opacity: 0.9 }), MAX_BOX, 'boxes');
  const bananas = make(bananaGeometry(), new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), MAX_BANANA, 'bananas');
  const greens = make(shellGeometry(0x2fb54a), new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), MAX_SHELL, 'greens');
  const reds = make(shellGeometry(0xe8312a), new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), MAX_SHELL, 'reds');
  const meshes = [boxes, bananas, greens, reds];
  // Star の虹色の光（車ごとに、使うときに作る）
  // 稲妻（空から車へ、ぎざぎざの線）
  const bolts = [];
  const bolt = (i) => {
    if (!bolts[i]) {
      const m = new THREE.Mesh(boltGeometry(), new THREE.MeshBasicMaterial({ color: 0xfff27a, side: THREE.DoubleSide }));
      m.userData.kind = 'bolt';
      m.visible = false;
      scene.add(m);
      bolts[i] = m;
    }
    return bolts[i];
  };
  const auras = [];
  const aura = (i) => {
    if (!auras[i]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1.9, 16, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.userData.kind = 'aura';
      m.visible = false;
      scene.add(m);
      auras[i] = m;
    }
    return auras[i];
  };
  const put = (mesh, n, x, y, z, ry = 0) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, ry, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(n, dummy.matrix);
  };
  const done = (mesh, n) => {
    mesh.count = Math.min(n, mesh.instanceMatrix.count);
    mesh.instanceMatrix.needsUpdate = true;
  };
  return {
    // karts は描く位置（なめらかにした位置）。t はレースの時刻
    // 見えていない車（食べられている・走り直し中で点滅・k.hidden = 宇宙やワープでほかの車を消している間）には、ぶら下げ・回る甲羅・光・稲妻を出さない
    update(world, karts, t) {
      const seen = (k) => !(k.swallowed || k.respawn > 0 || k.hidden);
      let n = 0;
      for (const b of world.boxes) {
        if (b.gone > 0 || n >= MAX_BOX) continue;
        put(boxes, n++, b.x, b.y + 1.4 + Math.sin(t * 3 + b.x) * 0.15, b.z, t * 1.5);
      }
      done(boxes, n);
      n = 0;
      for (const b of world.bananas) if (n < MAX_BANANA) put(bananas, n++, b.x, b.y, b.z, -(b.h ?? 0) + Math.PI / 2); // 道に対して横向き（後ろから来る車に、曲がった形が見える）
      for (const k of karts) {
        // ぶら下げたバナナ（残りの数だけ、車の後ろに1列。ジャンプ中も車についてくる）
        for (let m = 0; seen(k) && m < (k.trailing || 0) && n < MAX_BANANA; m++) {
          const back = ITEM.TRAIL_BACK + m * ITEM.TRAIL_GAP;
          put(bananas, n++, k.x - Math.cos(k.heading) * back, k.y, k.z - Math.sin(k.heading) * back, -k.heading + Math.PI / 2);
        }
      }
      done(bananas, n);
      let g = 0;
      let r = 0;
      for (const s of world.shells) {
        if (s.kind === 'red' && r < MAX_SHELL) put(reds, r++, s.x, s.y, s.z, t * 12);
        else if (s.kind === 'green' && g < MAX_SHELL) put(greens, g++, s.x, s.y, s.z, t * 12);
      }
      for (const k of karts) {
        for (const slot of seen(k) ? k.orbit ?? [] : []) {
          const a = k.orbitAngle + (slot * 2 * Math.PI) / 3;
          if (g < MAX_SHELL) put(greens, g++, k.x + Math.cos(a) * ITEM.ORBIT_R, k.y + 0.3, k.z + Math.sin(a) * ITEM.ORBIT_R, t * 12);
        }
      }
      done(greens, g);
      done(reds, r);
      karts.forEach((k, i) => {
        const on = k.zap > 0 && seen(k);
        if (!on && !bolts[i]) return;
        const b = bolt(i);
        b.visible = on;
        if (on) b.position.set(k.x, k.y, k.z);
      });
      karts.forEach((k, i) => {
        // 終わる1秒前から点滅
        const on = seen(k) && k.star > 0 && !(k.star < 1 && Math.floor(k.star * 10) % 2 === 0);
        if (!on && !auras[i]) return;
        const a = aura(i);
        a.visible = on;
        if (!on) return;
        a.position.set(k.x, k.y + 1.2, k.z);
        a.material.color.setHSL((t * 3) % 1, 1, 0.55);
      });
    },
    dispose() {
      for (const b of bolts) if (b) { scene.remove(b); b.geometry.dispose(); b.material.dispose(); }
      for (const a of auras) if (a) { scene.remove(a); a.geometry.dispose(); a.material.dispose(); }
      for (const m of meshes) {
        scene.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      }
    },
  };
}
