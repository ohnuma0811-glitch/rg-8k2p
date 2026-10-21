// Global City の海の底（2026-10-20）: 香港の港から坂を下って海にもぐり、透明なガラスのトンネルを走る。
// クジラ・サメ・魚の群れ・しずんだ船が見える。坂を上って、自由の女神の足もとから地上に出る
import * as THREE from '../../../vendor/three.module.min.js?v=396317d';
import { createBuilder } from '../town/builder.js?v=396317d';
import { GLOBAL_SCENERY } from '../../data/global.js?v=396317d';
import { locate } from '../../game/track.js?v=396317d';
import { landmark, worldAt, sOf, pointAt, ryOf, beside, textSign } from './kit.js?v=396317d';
import { createDinoModel } from '../models.js?v=396317d';

const ryAlong = (h) => Math.atan2(Math.cos(h), Math.sin(h));

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
  // 海の水面はなし（トンネルの中は水で満たされていないので。2026-10-21 のユーザー依頼「水面は不要」）。砂の海底
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
  // 光の筋は消した（2026-10-21 のユーザー依頼「上から光のようなものが斜めに差し込んでいるが不要」）

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
  // ---- もっとたくさんの生き物（2026-10-21 のユーザー依頼「魚や大型生物が少ない」）: ガラスのトンネルにそって ----
  const gs = sOf(track, ['SD', 'LIB', 0.12]);
  const ge = sOf(track, ['SD', 'LIB', 0.9]);
  const onRoad = (s, lat) => {
    const p = pointAt(track, s);
    const c = beside(p, lat);
    return { x: c.x, z: c.z, h: p.h };
  };
  const FISH = [0xffd23a, 0xff7a3a, 0x3ad2ff, 0xff4a8a, 0x9aff4a, 0xffffff];
  for (let k = 0; k < 14; k++) {
    const c = onRoad(gs + ((ge - gs) * (k + 0.5)) / 14, (k % 2 ? -1 : 1) * (15 + (k % 3) * 4));
    const school = new THREE.Group();
    const fb = createBuilder();
    for (let j = 0; j < 40; j++) {
      const r = 2 + (j % 6);
      const an = j * 1.1;
      fb.push(Math.cos(an) * r, ((j * 7) % 7) - 3, Math.sin(an) * r, an);
      fb.cyl(0, 0.45, 1.1, 3, FISH[k % FISH.length], 0, 0, 0);
      fb.pop();
    }
    school.add(fb.build());
    g.add(swimmer(school, c, 20, 0.5, k * 0.7, -12 - (k % 4) * 4));
  }
  // 2頭目のクジラ（親子。小さい子クジラ）
  {
    const c = onRoad(gs + (ge - gs) * 0.7, 0);
    const calf = new THREE.Group();
    const cb = createBuilder();
    cb.sphere(3, 0x7fa3c8, 0, 0, 0, 10);
    cb.box(6, 5, 9, 0x7fa3c8, 0, -2.5, -4);
    cb.box(4, 3, 6, 0x6a8eb4, 0, -1.5, -10);
    cb.box(8, 0.6, 2, 0x6a8eb4, 0, -0.3, -13);
    cb.box(4.5, 0.8, 10, 0xe8ecf0, 0, -3, -4);
    calf.add(cb.build());
    g.add(swimmer(calf, c, 60, 0.14, 1.5, -6));
  }
  // ウミガメ（緑のこうら、4枚のひれ）
  for (let k = 0; k < 4; k++) {
    const c = onRoad(gs + ((ge - gs) * (k + 0.3)) / 4, (k % 2 ? 1 : -1) * 13);
    const tt = new THREE.Group();
    const tb = createBuilder();
    tb.sphere(1.6, 0x3f7a4a, 0, 0, 0, 8);
    tb.box(3.2, 0.6, 3.6, 0xb8a070, 0, -0.9, 0);
    tb.sphere(0.6, 0x8aa070, 0, 0, 2.2, 6);
    for (const [x, z] of [[-1.8, 1], [1.8, 1], [-1.4, -1.2], [1.4, -1.2]]) tb.box(1.6, 0.25, 0.8, 0x8aa070, x, -0.3, z);
    tt.add(tb.build());
    g.add(swimmer(tt, c, 15, 0.3, k, -18 + (k % 2) * 4));
    if (k === 0) landmark(g, 'turtle', c.x, -18, c.z);
  }
  // マンタ（黒っぽいひし形の大きなエイ）
  for (let k = 0; k < 3; k++) {
    const c = onRoad(gs + ((ge - gs) * (k + 0.6)) / 3, (k % 2 ? -1 : 1) * 26);
    const mt = new THREE.Group();
    const mb = createBuilder();
    mb.push(0, 0, 0, Math.PI / 4);
    mb.box(5, 0.6, 5, 0x2a3440, 0, 0, 0);
    mb.box(4.6, 0.3, 4.6, 0xe8ecf0, 0, -0.35, 0);
    mb.pop();
    mb.box(0.3, 0.3, 5, 0x2a3440, 0, 0.1, -5);
    mt.add(mb.build());
    g.add(swimmer(mt, c, 35, 0.25, k * 2, -20 - k * 3));
    if (k === 0) landmark(g, 'manta', c.x, -20, c.z);
  }
  // Soki Forest の巨大怪獣も泳ぐ（オレンジの大きな頭に、体と長いしっぽ。口をぱくぱく。2026-10-21 のユーザー依頼）
  {
    const c = onRoad(gs + (ge - gs) * 0.45, -34);
    const mon = new THREE.Group();
    const head = createDinoModel(); // 前は +x、横はば 26m
    head.rotation.y = -Math.PI / 2; // 前を +z に
    const body = createBuilder();
    body.box(22, 16, 30, 0xf08a24, 0, -4, -18); // 体
    body.box(14, 10, 22, 0xc4601a, 0, -2, -40); // しっぽの根もと
    body.box(8, 6, 20, 0xf08a24, 0, 0, -60); // しっぽ
    body.box(4, 3, 14, 0xc4601a, 0, 1, -76); // しっぽの先
    for (const z of [-12, -26]) for (const x of [-13, 13]) body.box(8, 2, 6, 0xc4601a, x, -10, z); // ひれのような足
    for (let z = -6; z > -70; z -= 8) body.box(2, 4, 3, 0xc4601a, 0, 4 + (z > -30 ? 0 : -2), z); // 背中のとげ
    mon.add(head, body.build());
    mon.scale.setScalar(0.8);
    mon.userData.jaw = head.userData.upper;
    // 泳がず、トンネルの横の海底にいて、通るカートの方を向き、食べたそうに口を開け閉めする（2026-10-21 のユーザー依頼）
    mon.position.set(c.x, -30, c.z);
    mon.userData.watch = true;
    mon.traverse((o) => {
      o.userData.keep = true;
      if (o.material) { o.material = o.material.clone(); o.material.fog = false; }
    });
    g.add(mon);
    landmark(g, 'monster', c.x, -24, c.z);
  }

  // ---- 入口と出口の門（2026-10-21 のユーザー依頼「潜るトンネルの入り口を作って」）: コンクリートの建物に、光る「UNDER THE SEA」の看板 ----
  const portal = (s, name, back) => {
    const p = pointAt(track, s);
    landmark(g, name, p.x, p.y, p.z);
    const w = p.wall + 0.5;
    const ry = ryAlong(p.h) + (back ? 0 : Math.PI); // 看板は、走ってくる方に向ける
    const gate = createBuilder();
    const light = createBuilder({ glow: true });
    for (const bld of [gate, light]) bld.push(p.x, p.y, p.z, ry);
    for (const side of [-1, 1]) gate.box(10, 16, 12, 0x8a9096, side * (w + 5.2), 0, 0); // 両がわの建物
    gate.box(2 * w + 20.4, 7, 12, 0x8a9096, 0, 9.5, 0); // 入口の上
    gate.box(2 * w + 22, 1, 13, 0x5a6066, 0, 16.5, 0); // 屋根
    light.box(2 * w + 2, 0.5, 0.4, 0x3ad2ff, 0, 9.2, 6.3); // 入口のふちの青い光
    for (const side of [-1, 1]) light.box(0.5, 9, 0.4, 0x3ad2ff, side * (w + 0.3), 0, 6.3);
    gate.label(textSign('UNDER THE SEA', { bg: '#0b3d66', fg: '#bfefff', font: 'bold 80px sans-serif' }), [768, 128], 0, 13, 6.3, 0, 2 * w, 4);
    for (const bld of [gate, light]) bld.pop();
    g.add(gate.build(), light.build());
  };
  portal(sOf(track, 'SD'), 'seaPortal', false);
  portal(sOf(track, 'LIB'), 'seaExit', true);

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

// 泳ぐ生き物を動かす（毎フレーム）。怪獣（watch）はカメラの方を向いて、口を開け閉め
export function updateSea(group, time, camera = null) {
  group.traverse((o) => {
    if (o.userData.watch) {
      if (camera) o.rotation.y = Math.atan2(camera.position.x - o.position.x, camera.position.z - o.position.z);
      if (o.userData.jaw) o.userData.jaw.rotation.z = 0.55 + Math.sin(time * 1.6) * 0.3;
      return;
    }
    const s = o.userData.swim;
    if (!s) return;
    const an = time * s.speed + s.phase;
    // 道にそって行ったり来たり（前後 r m、横に少しゆれる）。向きは進む方へ
    const f = Math.sin(an) * s.r;
    const l = Math.sin(an * 2) * 3;
    o.position.set(s.cx + s.fx * f - s.fz * l, s.y + Math.sin(an * 3) * 1, s.cz + s.fz * f + s.fx * l);
    const dir = Math.cos(an) >= 0 ? 1 : -1;
    o.rotation.y = Math.atan2(s.fx * dir, s.fz * dir);
    if (o.userData.jaw) o.userData.jaw.rotation.z = 0.45 + Math.sin(time * 2.2) * 0.35; // 怪獣の口をぱくぱく
  });
}
