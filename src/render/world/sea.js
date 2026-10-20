// Global City の海の底（2026-10-20）: 香港の港から坂を下って海にもぐり、透明なガラスのトンネルを走る。
// クジラ・サメ・魚の群れ・しずんだ船が見える。坂を上って、自由の女神の足もとから地上に出る
import * as THREE from '../../../vendor/three.module.min.js?v=0e5d133';
import { createBuilder } from '../town/builder.js?v=0e5d133';
import { GLOBAL_SCENERY } from '../../data/global.js?v=0e5d133';
import { locate } from '../../game/track.js?v=0e5d133';
import { landmark, worldAt, sOf, pointAt, ryOf, beside } from './kit.js?v=0e5d133';

// 地図の点に近い道の点から、横へ lat m の所（生き物はトンネルのすぐ横・上を泳ぐ。遠いと霧で見えなかった）
function nearRoad(track, at, lat) {
  const w = worldAt(track, at);
  const p = pointAt(track, locate(track, w.x, w.z, null, 40).s);
  const c = beside(p, lat);
  return { x: c.x, z: c.z, h: p.h };
}

// 泳ぐ生き物（main.js の updateSea が毎フレーム動かす）: 道にそって、行ったり来たり（r m）
function swimmer(mesh, center, r, speed, phase, y) {
  mesh.userData.swim = { cx: center.x, cz: center.z, fx: Math.cos(center.h), fz: Math.sin(center.h), r, speed, phase, y };
  // 動くので、まとめない。海の霧で黒いかげに見えたので、霧をかけずに色を見せる
  mesh.traverse((o) => {
    o.userData.keep = true;
    if (o.material) { o.material = o.material.clone(); o.material.fog = false; }
  });
  return mesh;
}

export function buildSea(track) {
  const S = GLOBAL_SCENERY.sea;
  const root = new THREE.Group();
  const g = new THREE.Group();
  g.userData.stages = [4];
  g.userData.swimmers = true; // main.js が updateSea で動かす
  root.add(g);
  const b = createBuilder();
  const a = pointAt(track, sOf(track, 'SD'));
  const z = pointAt(track, sOf(track, 'LIB'));
  const cx = (a.x + z.x) / 2;
  const cz = (a.z + z.z) / 2;
  const len = Math.hypot(z.x - a.x, z.z - a.z) + 300;
  // 海の水面（上から見ると青い海、下から見ると明るい水色）と、砂の海底
  const top = new THREE.Mesh(new THREE.PlaneGeometry(len, 600), new THREE.MeshLambertMaterial({ color: 0x1f5f8f }));
  top.rotation.x = -Math.PI / 2;
  top.rotation.z = -Math.atan2(z.z - a.z, z.x - a.x);
  top.position.set(cx, -0.05, cz); // 地面（-0.1）より上、道（0）より下
  top.userData.keep = true;
  const under = new THREE.Mesh(new THREE.PlaneGeometry(len, 600), new THREE.MeshBasicMaterial({ color: 0x3f9fd0, side: THREE.BackSide }));
  under.rotation.copy(top.rotation);
  under.position.set(cx, -0.3, cz);
  under.userData.keep = true;
  g.add(top, under);
  b.push(cx, -45, cz, Math.atan2(z.x - a.x, z.z - a.z) + Math.PI / 2);
  b.box(len, 0.5, 600, 0xc8b98a, 0, 0, 0);
  b.pop();
  // 海草と岩（海底に）
  for (let k = 0; k < 60; k++) {
    const t = k / 60;
    const x = a.x + (z.x - a.x) * t + Math.sin(k * 2.3) * 120;
    const zz = a.z + (z.z - a.z) * t + Math.cos(k * 1.7) * 120;
    if (k % 3) b.cyl(0.2, 0.4, 6 + (k % 4) * 2, 4, 0x3f8a4a, x, -44.5, zz, true);
    else b.sphere(3 + (k % 3), 0x6a6a72, x, -44, zz, 5);
  }
  // 光の筋（上からななめに。光る半透明の細い板）
  const rays = new THREE.Group();
  for (let k = 0; k < 20; k++) {
    const t = (k + 0.5) / 20;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 60), new THREE.MeshBasicMaterial({ color: 0xbfefff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(a.x + (z.x - a.x) * t + ((k * 37) % 60) - 30, -22, a.z + (z.z - a.z) * t + ((k * 53) % 80) - 40);
    m.rotation.set(0.3, k, 0.2);
    m.userData.keep = true;
    rays.add(m);
  }
  g.add(rays);

  // クジラ（青灰色、長さ 25m）
  const wc = nearRoad(track, S.whale.at, 0); // トンネルの真上
  const whale = new THREE.Group();
  const wb = createBuilder();
  const WB = 0x6f93b8;
  const WD = 0x5a7ea4;
  wb.sphere(5, WB, 0, 0, 0, 12);
  wb.box(9, 8, 14, WB, 0, -4, -6);
  wb.box(7, 6, 8, WD, 0, -3, -15);
  wb.box(4, 4, 6, WD, 0, -2, -21);
  wb.box(12, 0.8, 3, WD, 0, -0.5, -25); // 尾びれ（横に広い）
  wb.box(9, 0.6, 3, WD, 0, -3, -2); // 胸びれ
  wb.box(7, 1, 16, 0xe8ecf0, 0, -4.6, -6); // 白いおなか
  wb.sphere(0.6, 0x1a1a1a, 3.6, 0.5, 2.5, 6); // 目
  wb.sphere(0.6, 0x1a1a1a, -3.6, 0.5, 2.5, 6);
  whale.add(wb.build());
  g.add(swimmer(whale, wc, 70, 0.12, 0, S.whale.y));
  landmark(g, 'whale', wc.x, S.whale.y, wc.z);
  // サメ（灰色、長さ 5m）
  S.shark.forEach((at, k) => {
    const c = nearRoad(track, at, (k % 2 ? 1 : -1) * 22); // トンネルの横の窓から見える
    const shark = new THREE.Group();
    const sb = createBuilder();
    sb.box(1.8, 1.8, 6, 0x9aa5b0, 0, -0.9, 0);
    sb.box(1.4, 0.4, 5, 0xeef0f2, 0, -1.2, 0); // 白いおなか
    sb.box(0.3, 1.6, 1.2, 0x6a7580, 0, 0.6, 0.4); // 背びれ
    sb.box(0.3, 1.4, 1, 0x6a7580, 0, -0.7, -2.8); // 尾びれ
    shark.add(sb.build());
    g.add(swimmer(shark, c, 30, 0.35 + k * 0.1, k * 2, -25));
    landmark(g, 'shark', c.x, -24, c.z);
  });
  // 魚の群れ（小さな三角 60匹ずつ。群れごと、うずを巻いて泳ぐ）
  S.fish.forEach((at, k) => {
    const c = nearRoad(track, at, (k % 2 ? -1 : 1) * 18);
    const school = new THREE.Group();
    const fb = createBuilder();
    for (let j = 0; j < 60; j++) {
      const r = 3 + (j % 7);
      const an = j * 0.9;
      fb.push(Math.cos(an) * r, ((j * 13) % 9) - 4, Math.sin(an) * r, an);
      fb.cyl(0, 0.5, 1.3, 3, k % 2 ? 0xffd23a : 0xff7a3a, 0, 0, 0);
      fb.pop();
    }
    school.add(fb.build());
    g.add(swimmer(school, c, 25, 0.4, k, -16 - (k % 3) * 3));
    landmark(g, 'fish', c.x, -18, c.z);
  });
  // しずんだ船（茶色の木の船、かたむいて砂にうまる）
  const wr = nearRoad(track, S.wreck.at, 45);
  landmark(g, 'wreck', wr.x, -44, wr.z);
  b.push(wr.x, -44, wr.z, ryOf(S.wreck.ry));
  b.box(9, 6, 32, 0x6a4a2e, 0, 0, 0);
  b.box(8, 1, 30, 0x4a3420, 0, 6, 0);
  b.cyl(0.5, 0.5, 18, 6, 0x5a3e28, 0, 6, 4); // マスト
  b.box(10, 0.4, 0.4, 0x5a3e28, 0, 18, 4);
  b.pop();

  // 自由の女神（台座 47m ＋ 像 46m。青緑、右手のたいまつは金色に光る）。ニューヨークからも見える
  const ny = new THREE.Group();
  ny.userData.stages = [4, 5];
  root.add(ny);
  const lb = createBuilder();
  const glow = createBuilder({ glow: true });
  const li = worldAt(track, S.liberty.at);
  landmark(ny, 'liberty', li.x, 0, li.z);
  lb.push(li.x, 0, li.z, ryOf(S.liberty.ry));
  lb.box(60, 8, 60, 0x8a8478, 0, 0, 0); // 星形の土台（四角で）
  lb.box(26, 27, 26, 0xc8bca6, 0, 8, 0); // 台座
  lb.box(30, 3, 30, 0xb8ac96, 0, 35, 0);
  lb.box(20, 12, 20, 0xc8bca6, 0, 38, 0);
  const VERD = 0x5fa89a;
  lb.cyl(5, 8, 30, 10, VERD, 0, 50, 0); // 体（ローブ）
  lb.cyl(3.4, 5, 6, 10, VERD, 0, 80, 0); // 肩
  lb.sphere(3.2, VERD, 0, 89, 0, 10); // 頭
  for (let k = 0; k < 7; k++) {
    const an = (k / 6) * Math.PI - Math.PI / 2;
    lb.rod(Math.sin(an) * 2.5, 91, Math.cos(an) * 2.5 + 0.5, Math.sin(an) * 6, 93, Math.cos(an) * 6 + 2, 0.35, VERD); // 冠のとげ
  }
  lb.rod(3.5, 84, 0, 5, 100, 1, 1.1, VERD); // 右手を上げる
  lb.cyl(1.2, 0.8, 3, 8, 0xc9a23a, 5, 100, 1); // たいまつ
  lb.box(4, 6, 2, VERD, -4.5, 78, 2); // 左手の本
  lb.pop();
  glow.push(li.x, 0, li.z, ryOf(S.liberty.ry));
  glow.sphere(2.2, 0xffd23a, 5, 104.5, 1, 10); // たいまつの火
  glow.pop();
  ny.add(lb.build(), glow.build());

  g.add(b.build());
  return root;
}

// 泳ぐ生き物を動かす（毎フレーム）
export function updateSea(group, time) {
  group.traverse((o) => {
    const s = o.userData.swim;
    if (!s) return;
    const an = time * s.speed + s.phase;
    // 道にそって行ったり来たり（前後 r m、横に少しゆれる）。向きは進む方へ
    const f = Math.sin(an) * s.r;
    const l = Math.sin(an * 2) * 3;
    o.position.set(s.cx + s.fx * f - s.fz * l, s.y + Math.sin(an * 3) * 1, s.cz + s.fz * f + s.fx * l);
    const dir = Math.cos(an) >= 0 ? 1 : -1;
    o.rotation.y = Math.atan2(s.fx * dir, s.fz * dir);
  });
}
