// 車の動き。アクセルは自動。ハンドル・ブレーキ・ドリフト・ダート・柵・ジャンプ台
import { locate, respawnIndex } from './track.js';

export const PHYS = {
  DIRT_FACTOR: 0.55, // ダートでの最高速の割合
  DRAG: 12, // 最高速より速いときに落ちる速さ（m/s²）
  BRAKE: 25, // ブレーキ（m/s²）
  REVERSE_MAX: 6, // バックの最高速（m/s）
  TURN_FULL_SPEED: 6, // この速さ以上で、曲がる力がいっぱいになる（止まっていると曲がれない）
  DRIFT_MIN_SPEED: 12, // ドリフトできる速さ
  DRIFT_BASE: 0.35, // ドリフト中、ハンドルを切っていなくても曲がる割合
  DRIFT_ADJ: 0.3, // ドリフト中、ハンドルで足し引きできる割合
  BLUE_TIME: 0.9, // 青い火花になるまでの時間（秒）
  ORANGE_TIME: 1.9, // オレンジの火花になるまでの時間（秒）
  BLUE_BOOST: 0.6, // 青で離したときの加速の時間（秒）
  ORANGE_BOOST: 1.2, // オレンジで離したときの加速の時間（秒）
  PAD_BOOST: 1.0, // 加速板の加速の時間（秒）
  BOOST_FACTOR: 1.3, // 加速中の最高速の倍率
  GRAVITY: 15, // m/s²
  KICK: (18 * Math.PI) / 180, // ジャンプ台から飛び出す角度
  LAUNCH_SPEED: 30, // ジャンプ台から飛び出す速さ（いつも同じ。必ず向こう側の同じ所に着地する）
  AIR_TURN: 0.3, // 空中で曲がれる割合
  WALL_KEEP: 0.6, // 柵にぶつかったときに残る速さの割合
  FALL_Y: -2, // これより下に落ちたらコースに戻す
  RESPAWN_DELAY: 2, // コースに戻すまでの時間（秒）
};

function wrapAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

export function placeAt(kart, track, i, lateral = 0) {
  const p = track.samples[i];
  kart.x = p.x + -Math.sin(p.h) * lateral;
  kart.z = p.z + Math.cos(p.h) * lateral;
  kart.y = p.y ?? 0;
  kart.vy = 0;
  kart.heading = p.h;
  kart.speed = 0;
  kart.seg = i;
  kart.airborne = false;
  kart.drift = { active: false, dir: 0, charge: 0 };
  kart.boost = 0;
  kart.surface = 'road';
  kart.respawn = 0;
  kart.respawnAt = i;
  kart.prevGround = kart.y;
}

export function createKart(track, i, lateral = 0) {
  const kart = {};
  placeAt(kart, track, i, lateral);
  return kart;
}

// 0 = 火花なし、1 = 青、2 = オレンジ
export function driftLevel(kart) {
  if (!kart.drift.active) return 0;
  if (kart.drift.charge >= PHYS.ORANGE_TIME) return 2;
  if (kart.drift.charge >= PHYS.BLUE_TIME) return 1;
  return 0;
}

function startBoost(kart, params, time) {
  kart.boost = Math.max(kart.boost, time);
  kart.speed = Math.max(kart.speed, params.topSpeed * PHYS.BOOST_FACTOR);
}

function endDrift(kart, params, release) {
  const lv = driftLevel(kart);
  kart.drift = { active: false, dir: 0, charge: 0 };
  if (release && lv === 2) startBoost(kart, params, PHYS.ORANGE_BOOST);
  else if (release && lv === 1) startBoost(kart, params, PHYS.BLUE_BOOST);
}

// ctl: { steer: -1〜1（右が正）, brake: bool, drift: bool }
export function stepKart(kart, ctl, track, params, dt) {
  if (kart.respawn > 0) {
    kart.respawn -= dt;
    if (kart.respawn <= 0) placeAt(kart, track, kart.respawnAt);
    return;
  }
  const here = locate(track, kart.x, kart.z, kart.seg);
  const steer = Math.max(-1, Math.min(1, ctl.steer));

  if (!kart.airborne) {
    if (here.boost) startBoost(kart, params, PHYS.PAD_BOOST);
    let maxV = params.topSpeed;
    if (here.surface !== 'road') maxV *= PHYS.DIRT_FACTOR;
    if (kart.boost > 0) maxV *= PHYS.BOOST_FACTOR;
    if (ctl.brake) {
      kart.speed = Math.max(-PHYS.REVERSE_MAX, kart.speed - PHYS.BRAKE * dt);
    } else if (kart.speed < maxV) {
      kart.speed = Math.min(maxV, kart.speed + params.accel * dt);
    } else {
      kart.speed = Math.max(maxV, kart.speed - PHYS.DRAG * dt);
    }

    // ドリフト: 押したときにハンドルを切っている向きに曲がり続ける。離すと、たまった分だけ加速
    if (!kart.drift.active && ctl.drift && Math.abs(steer) > 0.3 && kart.speed >= PHYS.DRIFT_MIN_SPEED) {
      kart.drift = { active: true, dir: Math.sign(steer), charge: 0 };
    } else if (kart.drift.active) {
      if (!ctl.drift) endDrift(kart, params, true);
      else if (kart.speed < PHYS.DRIFT_MIN_SPEED) endDrift(kart, params, false);
      else kart.drift.charge += dt;
    }

    const grip = Math.min(1, Math.abs(kart.speed) / PHYS.TURN_FULL_SPEED) * Math.sign(kart.speed);
    const turn = kart.drift.active
      ? kart.drift.dir * PHYS.DRIFT_BASE + steer * PHYS.DRIFT_ADJ
      : steer;
    kart.heading += turn * params.turnRate * grip * dt;
  } else {
    kart.heading += steer * params.turnRate * PHYS.AIR_TURN * dt;
  }
  kart.heading = wrapAngle(kart.heading);
  kart.boost = Math.max(0, kart.boost - dt);

  kart.x += Math.cos(kart.heading) * kart.speed * dt;
  kart.z += Math.sin(kart.heading) * kart.speed * dt;
  const loc = locate(track, kart.x, kart.z, kart.seg);
  kart.seg = loc.i;
  kart.surface = loc.surface;

  if (kart.airborne) {
    kart.vy -= PHYS.GRAVITY * dt;
    kart.y += kart.vy * dt;
    if (loc.ground !== null && kart.y <= loc.ground) {
      kart.y = loc.ground;
      kart.vy = 0;
      kart.airborne = false;
    } else if (kart.y < PHYS.FALL_Y) {
      kart.respawn = PHYS.RESPAWN_DELAY;
      kart.respawnAt = respawnIndex(track, loc.i);
      kart.speed = 0;
      return;
    }
  } else if (loc.ground === null) {
    // 地面がなくなった。前に走っていればジャンプ台から飛び出す（いつも同じ速さで、必ず向こう側に届く）
    kart.airborne = true;
    if (kart.drift.active) endDrift(kart, params, false);
    if (kart.speed > 0) {
      kart.speed = PHYS.LAUNCH_SPEED;
      kart.vy = kart.speed * Math.sin(PHYS.KICK);
    } else {
      kart.vy = 0;
    }
  } else {
    kart.y = loc.ground;
  }

  // 柵: 外に出ようとしたら押し戻し、コースの向きにそろえて、スピードを落とす
  const a = Math.abs(loc.lateral);
  if (a > loc.wall) {
    const side = Math.sign(loc.lateral);
    const excess = loc.lateral - side * loc.wall;
    kart.x -= -Math.sin(loc.heading) * excess;
    kart.z -= Math.cos(loc.heading) * excess;
    const out = Math.sin(wrapAngle(kart.heading - loc.heading)) * side * Math.sign(kart.speed);
    if (out > 0) {
      kart.heading = loc.heading;
      kart.speed *= PHYS.WALL_KEEP;
    }
  }
}
