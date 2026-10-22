// 飛んでいる甲羅（設計書 docs/superpowers/specs/2026-10-22-items-design.md の 4.3・4.4・8・9章）と守り
// 赤: 道にそって相手を追いかける。緑: まっすぐ飛び、柵ではね返る。障害物はすり抜け、ジャンプ台・地面のない所・自動の区間・無い道で消える
import { locate, ahead } from './track.js?v=bfc0648';
import { KART_RADIUS } from './collide.js?v=bfc0648';
import { startBlast } from './kart.js?v=bfc0648';

export const SHELL = {
  SPEED: 2, // 使ったキャラの最高速の何倍
  LIFE: 30, // 緑・相手のいない赤が消えるまで（秒。2026-10-22 のユーザー依頼で5から30へ）
  RED_LIFE: 30, // 相手のいる赤の、いちばん長い時間（秒。追いつけないときのため。2026-10-22 に20から30へ）
  BOUNCES: 20, // 緑が柵ではね返る回数（21回目に当たったら消える。2026-10-22 のユーザー依頼で3から20へ）
  OWNER_SAFE: 0.5, // 投げてすぐは自分に当たらない（秒）
  R: 0.6, // 甲羅の大きさ（半径 m）
  HOME: 25, // 赤が相手へまっすぐ向かう近さ（m）
};
const ORBIT_R = 2.4; // 回る甲羅・ぶら下げたバナナの、車の中心からの距離（src/game/items.js の ITEM と同じ）
const BANANA_R = 0.8;
const TRAIL_BACK = 2.4; // ぶら下げたバナナの場所（src/game/items.js の ITEM と同じ）
const BANANA_MAX = 20; // コース全体のバナナの数（src/game/items.js の ITEM と同じ）
const SCATTER_R = 2; // 散らばったバナナの、ぶら下げていた所からの距離（m）

// 守り: ang（車の中心から見た、ぶつかってきた物の向き。世界の角度）を、回っている甲羅か、ぶら下げたバナナがふせぐか
// 回る甲羅は1つが 120度（その甲羅の向きの ±60度）を受け持つ。ぶら下げたバナナは、後ろ ±60度から来た甲羅だけ
// ふせいだら、その甲羅を1つ消す。ぶら下げたバナナでふせいだときは、残りのバナナがその場に全部散らばる（散らばらせるのは hitShell。2026-10-22 のユーザー依頼）
export function guard(kart, ang, shell) {
  if (shell && kart.trailing > 0 && Math.cos(ang - kart.heading) <= -0.5) {
    kart.blocked = (kart.blocked || 0) + 1;
    return 'trail';
  }
  for (let n = 0; n < (kart.orbit?.length ?? 0); n++) {
    const a = kart.orbitAngle + (kart.orbit[n] * 2 * Math.PI) / 3;
    if (Math.cos(ang - a) >= 0.5 - 1e-9) {
      kart.orbit.splice(n, 1);
      kart.blocked = (kart.blocked || 0) + 1;
      return 'orbit';
    }
  }
  return null;
}

// 甲羅を出す（車の少し前から）。target は赤がねらう車の番号（いなければ null）
export function launchShell(world, kart, k, kind, target, topSpeed) {
  const d = KART_RADIUS + SHELL.R + 0.6;
  const p = world.track.samples[kart.seg];
  const lat = -(kart.x - p.x) * Math.sin(p.h) + (kart.z - p.z) * Math.cos(p.h);
  const s = { id: world.nextId++, kind, owner: k, target, x: kart.x + Math.cos(kart.heading) * d, z: kart.z + Math.sin(kart.heading) * d, y: kart.y ?? 0, heading: kart.heading, speed: topSpeed * SHELL.SPEED, seg: kart.seg, lat, carry: 0, age: 0, bounces: 0, done: false, tested: new Set() };
  world.shells.push(s);
  return s;
}

// その点で甲羅が消えるか（ジャンプ台・小さなジャンプ台・地面のない所・自動の区間・無い道）
function gone(p) {
  return p.y === null || p.ramp || p.kick || p.auto || p.void;
}

// 赤（相手あり）: 遠いうちは道にそって進み（分かれる所では相手のいる道へ）、近づいたら相手へまっすぐ
function stepRed(world, s, karts, dt) {
  const track = world.track;
  const tgt = karts[s.target];
  const step = s.speed * dt;
  const d = Math.hypot(tgt.x - s.x, tgt.z - s.z);
  if (d < SHELL.HOME && Math.abs((tgt.y ?? 0) - s.y) < 3) {
    s.heading = Math.atan2(tgt.z - s.z, tgt.x - s.x);
    const m = Math.min(step, d);
    s.x += Math.cos(s.heading) * m;
    s.z += Math.sin(s.heading) * m;
    const loc = locate(track, s.x, s.z, s.seg, 40, s.y);
    s.seg = loc.i;
    s.y = loc.ground ?? s.y;
    if (gone(track.samples[s.seg])) s.done = true;
    return;
  }
  s.carry += step;
  const n = Math.floor(s.carry);
  s.carry -= n;
  const tgtPath = track.samples[tgt.seg].path;
  // 相手の道から、分かれた元の道をたどって（入れ子の分かれ道）、ここで分かれる道に着いたらそれを選ぶ
  const choose = (i, paths) => {
    let p = tgtPath;
    for (let guard = 0; guard < 8 && p > 0; guard++) {
      if (paths.includes(p)) return p;
      p = track.samples[track.paths[p].fork].path;
    }
    return null;
  };
  for (let k = 0; k < n && !s.done; k++) {
    s.seg = ahead(track, s.seg, 1, choose);
    if (gone(track.samples[s.seg])) s.done = true;
  }
  if (s.done) return;
  const p = track.samples[s.seg];
  // 横のずれを、相手の横のずれへ少しずつ近づける
  const tp = track.samples[tgt.seg];
  const tLat = -(tgt.x - tp.x) * Math.sin(tp.h) + (tgt.z - tp.z) * Math.cos(tp.h);
  s.lat += Math.max(-6 * dt, Math.min(6 * dt, tLat - s.lat));
  s.x = p.x - Math.sin(p.h) * s.lat;
  s.z = p.z + Math.cos(p.h) * s.lat;
  s.y = p.y;
  s.heading = p.h;
}

// 緑・相手のいない赤: まっすぐ。柵に当たると、緑ははね返り（BOUNCES 回まで）、赤は消える
function stepStraight(world, s, dt) {
  const track = world.track;
  s.x += Math.cos(s.heading) * s.speed * dt;
  s.z += Math.sin(s.heading) * s.speed * dt;
  const loc = locate(track, s.x, s.z, s.seg, 40, s.y);
  s.seg = loc.i;
  if (gone(track.samples[s.seg])) {
    s.done = true;
    return;
  }
  s.y = loc.ground ?? s.y;
  const wall = loc.wall - SHELL.R;
  if (Math.abs(loc.lateral) <= wall) return;
  if (s.kind !== 'green' || s.bounces >= SHELL.BOUNCES) {
    s.done = true;
    return;
  }
  s.bounces++;
  s.heading = 2 * loc.heading - s.heading; // 道の向きで、はね返る
  const ex = loc.lateral - Math.sign(loc.lateral) * wall;
  s.x -= -Math.sin(loc.heading) * ex;
  s.z -= Math.cos(loc.heading) * ex;
}

// ぶら下げていたバナナ（kart.trailing 個）を、ぶら下げていた所のまわりに散らばらせる。乱数は使わない（どの端末でも同じ所に）
// 柵の外に出たものは、道の中へもどす
function scatterBananas(world, kart, k) {
  const n = kart.trailing;
  kart.trailing = 0;
  const cx = kart.x - Math.cos(kart.heading) * TRAIL_BACK;
  const cz = kart.z - Math.sin(kart.heading) * TRAIL_BACK;
  for (let m = 0; m < n; m++) {
    const a = kart.heading + Math.PI + ((m - (n - 1) / 2) * 2 * Math.PI) / Math.max(n, 1);
    let x = cx + Math.cos(a) * SCATTER_R;
    let z = cz + Math.sin(a) * SCATTER_R;
    const loc = locate(world.track, x, z, kart.seg, 40, kart.y ?? null);
    const wall = loc.wall - BANANA_R;
    if (Math.abs(loc.lateral) > wall) {
      const ex = loc.lateral - Math.sign(loc.lateral) * wall;
      x -= -Math.sin(loc.heading) * ex;
      z -= Math.cos(loc.heading) * ex;
    }
    world.bananas.push({ id: world.nextId++, owner: k, x, z, y: loc.ground ?? kart.y ?? 0, age: 0, h: a });
    if (world.bananas.length > BANANA_MAX) world.bananas.shift();
  }
}

// 車・置かれたバナナとの当たり。回る甲羅・ぶら下げたバナナのある車は、その所で1回だけ守りを見る
function hitShell(world, s, karts, out) {
  for (const b of world.bananas) {
    if (Math.abs(b.y - s.y) < 2 && Math.hypot(b.x - s.x, b.z - s.z) < BANANA_R + SHELL.R) {
      world.bananas.splice(world.bananas.indexOf(b), 1);
      s.done = true;
      return;
    }
  }
  for (let j = 0; j < karts.length; j++) {
    const o = karts[j];
    if (j === s.owner && s.age < SHELL.OWNER_SAFE) continue;
    if (o.auto || o.respawn > 0 || o.swallowed || Math.abs((o.y ?? 0) - s.y) > 2) continue;
    const d = Math.hypot(o.x - s.x, o.z - s.z);
    if (d < ORBIT_R + SHELL.R && ((o.orbit?.length ?? 0) > 0 || o.trailing) && !s.tested.has(j)) {
      s.tested.add(j);
      const by = guard(o, Math.atan2(s.z - o.z, s.x - o.x), true);
      if (by) {
        s.done = true;
        if (by === 'trail') scatterBananas(world, o, j); // スピンしない。残りのバナナはその場に散らばる
        out.push({ type: 'blocked', k: j, by });
        return;
      }
    }
    if (d >= KART_RADIUS + SHELL.R) continue;
    s.done = true;
    if (o.star > 0) out.push({ type: 'starBlock', k: j });
    else if (startBlast(o, world.track)) out.push({ type: 'blast', k: j, by: s.owner });
    return;
  }
}

// 毎フレーム: 動かす → 当たり → 消えた甲羅をのぞく。起きたことを返す
export function stepShells(world, karts, dt) {
  const out = [];
  for (const s of world.shells) {
    s.age += dt;
    const tgt = s.kind === 'red' && s.target !== null ? karts[s.target] : null;
    const life = tgt ? SHELL.RED_LIFE : SHELL.LIFE;
    if (s.age > life || (tgt && tgt.finished)) {
      s.done = true;
      continue;
    }
    if (dt > 0) {
      if (tgt) stepRed(world, s, karts, dt);
      else stepStraight(world, s, dt);
    }
    if (!s.done) hitShell(world, s, karts, out);
  }
  world.shells = world.shells.filter((s) => !s.done);
  return out;
}
