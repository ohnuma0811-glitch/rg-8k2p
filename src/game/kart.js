// 車の動き。アクセルは自動。ハンドル・ブレーキ・ドリフト・ダート・柵・ジャンプ台
// 操作感はマリオカート64 にならう: 速いほどハンドルがゆるい、ドリフトは跳ねてから滑る、
// 反対へ切って戻すたびに煙が 白 → 黄 → 赤 になり、赤で離すとミニターボ
import { locate, respawnIndex } from './track.js?v=8c91c11';

export const PHYS = {
  DIRT_FACTOR: 0.55, // ダートでの最高速の割合
  DRAG: 12, // 最高速より速いときに落ちる速さ（m/s²）
  BRAKE: 25, // ブレーキ（m/s²）
  REVERSE_MAX: 6, // バックの最高速（m/s）
  TURN_FULL_SPEED: 6, // この速さ以上で、曲がる力がいっぱいになる（止まっていると曲がれない）
  HIGH_SPEED_STEER: 0.35, // 最高速のとき、ハンドルの曲がり方がこの割合だけ弱くなる
  GRIP: 10, // ふつうのとき、進む向きが車の向きにそろう速さ（1/秒）
  DRIFT_GRIP: 2.5, // ドリフト中の、進む向きがそろう速さ（小さいほど外へ滑る）
  DRIFT_MIN_SPEED: 12, // ドリフトできる速さ
  HOP_TIME: 0.25, // ドリフトボタンで跳ねている時間（秒）
  HOP_HEIGHT: 0.5, // 跳ねる高さ（見た目、m）
  HOP_KEEP: 0.98, // 跳ねるたびに残る速さの割合（直線で何度も跳ねると遅くなる）
  DRIFT_BASE: 0.55, // ドリフト中、ハンドルを切っていなくても曲がる割合
  DRIFT_ADJ: 0.45, // ドリフト中、ハンドルで足し引きできる割合（反対へ切ると大回り）
  COUNTER: 0.3, // 反対へ切った・戻したと見なすハンドルの量
  MT_BOOST: 1.0, // 赤で離したときのミニターボの時間（秒）
  PAD_BOOST: 1.0, // 加速板の加速の時間（秒）
  BOOST_FACTOR: 1.3, // 加速中の最高速の倍率
  GRAVITY: 15, // m/s²
  KICK: (18 * Math.PI) / 180, // ジャンプ台から飛び出す角度
  LAUNCH_SPEED: 30, // ジャンプ台から飛び出す速さ（いつも同じ。必ず向こう側の同じ所に着地する）
  AIR_TURN: 0.3, // 空中で曲がれる割合
  WALL_KEEP: 0.6, // 柵にまっすぐぶつかったときに残る速さの割合
  WALL_FULL_ANGLE: 0.5, // この角度（rad）以上でぶつかると、WALL_KEEP まで落ちる
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
  kart.move = p.h; // 進む向き（ドリフト中は車の向きとずれて、外へ滑る）
  kart.speed = 0;
  kart.seg = i;
  kart.airborne = false;
  kart.drift = { active: false, dir: 0, stage: 0, counter: false };
  kart.hop = 0;
  kart.prevDrift = false;
  kart.boost = 0;
  kart.surface = 'road';
  kart.respawn = 0;
  kart.respawnAt = i;
  kart.onWall = false;
  kart.prevGround = kart.y;
}

export function createKart(track, i, lateral = 0) {
  const kart = {};
  placeAt(kart, track, i, lateral);
  return kart;
}

// ドリフトの煙の色: 0 = 白、1 = 黄、2 = 赤（ドリフトしていないときは 0）
export function driftLevel(kart) {
  return kart.drift.active ? kart.drift.stage : 0;
}

function startBoost(kart, params, time) {
  kart.boost = Math.max(kart.boost, time);
  kart.speed = Math.max(kart.speed, params.topSpeed * PHYS.BOOST_FACTOR);
}

function endDrift(kart, params, release) {
  const lv = driftLevel(kart);
  kart.drift = { active: false, dir: 0, stage: 0, counter: false };
  if (release && lv === 2) startBoost(kart, params, PHYS.MT_BOOST);
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

    // ドリフト: ボタンを押した瞬間に小さく跳ね、着地のときハンドルを切っていれば、その向きに滑り出す
    if (ctl.drift && !kart.prevDrift && !kart.drift.active && kart.hop <= 0 && kart.speed >= PHYS.DRIFT_MIN_SPEED) {
      kart.hop = PHYS.HOP_TIME;
      kart.speed *= PHYS.HOP_KEEP;
    } else if (kart.hop > 0) {
      kart.hop -= dt;
      if (kart.hop <= 0) {
        kart.hop = 0;
        if (ctl.drift && Math.abs(steer) > PHYS.COUNTER && kart.speed >= PHYS.DRIFT_MIN_SPEED) {
          kart.drift = { active: true, dir: Math.sign(steer), stage: 0, counter: false };
        }
      }
    } else if (kart.drift.active) {
      if (!ctl.drift) endDrift(kart, params, true);
      else if (kart.speed < PHYS.DRIFT_MIN_SPEED) endDrift(kart, params, false);
      else {
        // 反対へ切って、すぐ戻すたびに、煙の色が1つ進む（赤まで）
        const along = steer * kart.drift.dir;
        if (along < -PHYS.COUNTER) kart.drift.counter = true;
        else if (along > PHYS.COUNTER && kart.drift.counter) {
          kart.drift.counter = false;
          kart.drift.stage = Math.min(2, kart.drift.stage + 1);
        }
      }
    }

    // 速いほどハンドルがゆるい。止まりかけでは曲がれない
    const grip = Math.min(1, Math.abs(kart.speed) / PHYS.TURN_FULL_SPEED) * Math.sign(kart.speed);
    const fast = 1 - PHYS.HIGH_SPEED_STEER * Math.min(1, Math.abs(kart.speed) / params.topSpeed);
    const turn = kart.drift.active
      ? kart.drift.dir * PHYS.DRIFT_BASE + steer * PHYS.DRIFT_ADJ
      : steer * fast;
    kart.heading += turn * params.turnRate * grip * dt;
  } else {
    kart.heading += steer * params.turnRate * PHYS.AIR_TURN * dt;
  }
  kart.heading = wrapAngle(kart.heading);
  kart.prevDrift = ctl.drift;
  kart.boost = Math.max(0, kart.boost - dt);

  // 進む向きは、車の向きに少しずつそろう（ドリフト中はゆっくり＝外へ滑る）
  const gripRate = kart.airborne ? 0 : kart.drift.active ? PHYS.DRIFT_GRIP : PHYS.GRIP;
  kart.move = wrapAngle(kart.move + wrapAngle(kart.heading - kart.move) * Math.min(1, gripRate * dt));
  kart.x += Math.cos(kart.move) * kart.speed * dt;
  kart.z += Math.sin(kart.move) * kart.speed * dt;
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

  // 柵: 外に出ようとしたら押し戻す。地面ではコースの向きにそろえる
  // スピードを落とすのはぶつかった最初の1回だけで、角度が大きいほど落とす（こすっている間は柵ぞいに走れる）
  // 空中では押し戻すだけ（ジャンプ中にハンドルを切っても落ちないように）
  const a = Math.abs(loc.lateral);
  let touching = false;
  if (a > loc.wall) {
    touching = true;
    const side = Math.sign(loc.lateral);
    const excess = loc.lateral - side * loc.wall;
    kart.x -= -Math.sin(loc.heading) * excess;
    kart.z -= Math.cos(loc.heading) * excess;
    const out = Math.sin(wrapAngle(kart.move - loc.heading)) * side * Math.sign(kart.speed);
    if (out > 0 && !kart.airborne) {
      if (!kart.onWall) kart.speed *= 1 - (1 - PHYS.WALL_KEEP) * Math.min(1, out / Math.sin(PHYS.WALL_FULL_ANGLE));
      kart.heading = loc.heading;
      kart.move = loc.heading;
    }
  }
  kart.onWall = touching;
}
