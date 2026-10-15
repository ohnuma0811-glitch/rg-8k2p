// 車の動き。アクセルは自動。ハンドル・ブレーキ・ドリフト・ダート・柵・ジャンプ台
// 操作感はマリオカート64 にならう: 速いほどハンドルがゆるい、ドリフトは跳ねてから滑る、
// ドリフトを続けると（反対に切って戻すとさらに早く）煙が 白 → 黄 → 赤 になり、赤で離すとミニターボ
import { locate, respawnIndex } from './track.js?v=77642e5';
import { BUMP_LIMIT_KMH, TUMBLE_TIME, HUMP_TIME, meterKmh, crossed } from './hazards.js?v=77642e5';

export const PHYS = {
  DIRT_FACTOR: 0.55, // ダートでの最高速の割合
  STEER_DRAG: 0.06, // ハンドルをいっぱいに切ると、最高速がこの割合だけ落ちる
  DRIFT_DRAG: 0.04, // ドリフト中は、最高速がこの割合だけ落ちる
  BUMP_ROAD: 0.012, // 道のでこぼこで、最高速がこの割合だけ上下する（スピード計の数字が細かく動く）
  BUMP_DIRT: 0.04, // ダートのでこぼこ（道より大きい）
  ACCEL_TAPER: 0.7, // 最高速に近いほど加速が弱くなる強さ（ぴったり止まらず、少しずつ上がる）
  DRAG: 12, // 最高速より速いときに落ちる速さ（m/s²）
  BRAKE: 25, // ブレーキ（m/s²）
  REVERSE_MAX: 6, // バックの最高速（m/s）
  TURN_FULL_SPEED: 6, // この速さ以上で、曲がる力がいっぱいになる（止まっていると曲がれない）
  LOW_SPEED_BONUS: 0.5, // 遅いときは、ふつうのハンドルがこの割合だけ強くなる（止まりかけで最大1.5倍。小回りしすぎない）
  GRIP: 10, // ふつうのとき、進む向きが車の向きにそろう速さ（1/秒）
  DRIFT_GRIP: 2.4, // ドリフト中の、進む向きがそろう速さ（小さいほど外へ滑る。車の向きのずれが約30度）
  DRIFT_MIN_SPEED: 12, // ドリフトできる速さ
  HOP_TIME: 0.25, // ドリフトボタンで跳ねている時間（秒）
  HOP_HEIGHT: 0.5, // 跳ねる高さ（見た目、m）
  HOP_KEEP: 0.98, // 跳ねるたびに残る速さの割合（直線で何度も跳ねると遅くなる）
  DRIFT_BASE: 1.04, // ドリフト中、ハンドルを切っていなくても曲がる強さ（ふつうのハンドルいっぱいの約1.1倍）
  DRIFT_ADJ: 0.86, // ドリフト中、ハンドルで足し引きできる強さ（同じ向きにいっぱいで約2倍＝最高速で半径約20m。反対にいっぱいで、ほぼまっすぐ）
  COUNTER: 0.3, // 反対へ切った・戻したと見なすハンドルの量
  STAGE_TIME: 0.7, // ドリフトを続けて煙の色が1段進む時間（秒。1.4秒で赤）
  MT_BOOST: 1.2, // 赤で離したときのミニターボの時間（秒）
  PAD_BOOST: 1.0, // 加速板の加速の時間（秒）
  BOOST_FACTOR: 1.3, // 加速中の最高速の倍率
  GRAVITY: 15, // m/s²
  KICK: (18 * Math.PI) / 180, // ジャンプ台から飛び出す角度
  LAUNCH_SPEED: 30, // ジャンプ台から飛び出す速さ（いつも同じ。必ず向こう側の同じ所に着地する）
  AIR_TURN: 0.3, // 空中で曲がれる割合
  WALL_KEEP: 0.6, // 柵にまっすぐぶつかったときに残る速さの割合
  WALL_FULL_ANGLE: 0.5, // この角度（rad）以上でぶつかると、WALL_KEEP まで落ちる
  WRONG_WARN: 1, // 逆向きにこの秒数走ると、逆走の警告を出す
  WRONG_CLEAR: 0.5, // 前向きにこの秒数走ると、逆走の数えを0に戻す
  WRONG_FIX: 10, // 逆走がこの秒数続いたら、スピンして正しい向きに戻す（2026-10-14 のユーザー依頼で30秒から短く）
  SPIN_TIME: 1, // スピンしている時間（秒。ハンドルは効かない）
  TUMBLE_BRAKE: 40, // バンプで転がっている間に止まる強さ（m/s²）
  ISLAND_PAD: 1.2, // ロータリーの島のふちと、車の中心の間（車の半分の大きさ）
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
  kart.drift = { active: false, dir: 0, stage: 0, counter: false, flicks: 0, time: 0 };
  kart.hop = 0;
  kart.prevDrift = false;
  kart.boost = 0;
  kart.surface = 'road';
  kart.respawn = 0;
  kart.respawnAt = i;
  kart.onWall = false;
  kart.onIsland = false;
  kart.tumble = 0; // バンプで転がっている残りの秒数
  kart.hump = 0; // バンプを乗り越えている残りの秒数
  kart.prevGround = kart.y;
  kart.wrongWay = false; // 逆走の警告を出しているか
  kart.wrongTime = 0; // 逆向きに走っている秒数
  kart.rightTime = 0; // 前向きに走っている秒数
  kart.spin = 0; // スピンの残り秒数
  kart.spinTo = p.h; // スピンのあとに向く向き
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

// スタートダッシュ: 加速の数字（1〜5）が大きいほど長く加速する
export const DASH_BASE = 0.5;
export const DASH_PER_ACCEL = 0.15;
export function startDash(kart, params, accelLevel) {
  startBoost(kart, params, DASH_BASE + DASH_PER_ACCEL * accelLevel);
}

function startBoost(kart, params, time) {
  kart.boost = Math.max(kart.boost, time);
  kart.speed = Math.max(kart.speed, params.topSpeed * PHYS.BOOST_FACTOR);
}

function endDrift(kart, params, release) {
  const lv = driftLevel(kart);
  kart.drift = { active: false, dir: 0, stage: 0, counter: false, flicks: 0, time: 0 };
  if (release && lv === 2) startBoost(kart, params, PHYS.MT_BOOST);
}

// ctl: { steer: -1〜1（右が正）, brake: bool, drift: bool }
export function stepKart(kart, ctl, track, params, dt) {
  if (kart.respawn > 0) {
    kart.respawn -= dt;
    if (kart.respawn <= 0) placeAt(kart, track, kart.respawnAt);
    return;
  }
  // バンプで転がっている間: 操作は効かず、すぐに止まる（その場で転がる）。終わったら、止まった状態からコースの向きで走り出す
  if (kart.tumble > 0) {
    kart.tumble = Math.max(0, kart.tumble - dt);
    kart.speed = Math.max(0, kart.speed - PHYS.TUMBLE_BRAKE * dt);
    kart.x += Math.cos(kart.move) * kart.speed * dt;
    kart.z += Math.sin(kart.move) * kart.speed * dt;
    const loc = locate(track, kart.x, kart.z, kart.seg);
    kart.seg = loc.i;
    // 柵の外へは滑り出ない（最終レビュー: 斜めに転がると柵の外まで滑っていた）
    const excess = Math.abs(loc.lateral) - loc.wall;
    if (excess > 0) {
      const side = Math.sign(loc.lateral);
      kart.x -= -Math.sin(loc.heading) * side * excess;
      kart.z -= Math.cos(loc.heading) * side * excess;
      kart.speed *= 0.5;
    }
    if (kart.tumble === 0) {
      kart.speed = 0;
      kart.heading = loc.heading;
      kart.move = loc.heading;
    }
    return;
  }
  kart.hump = Math.max(0, kart.hump - dt);
  // スピン中: ハンドルは効かず、くるくる回りながら遅くなり、終わると正しい向きを向く
  if (kart.spin > 0) {
    kart.spin -= dt;
    kart.speed = Math.max(0, kart.speed - 20 * dt);
    kart.x += Math.cos(kart.move) * kart.speed * dt;
    kart.z += Math.sin(kart.move) * kart.speed * dt;
    kart.seg = locate(track, kart.x, kart.z, kart.seg).i;
    if (kart.spin <= 0) {
      kart.spin = 0;
      kart.heading = kart.spinTo;
      kart.move = kart.spinTo;
    } else {
      kart.heading = wrapAngle(kart.spinTo + 2 * Math.PI * 2 * (kart.spin / PHYS.SPIN_TIME));
    }
    return;
  }
  const here = locate(track, kart.x, kart.z, kart.seg);
  const steer = Math.max(-1, Math.min(1, ctl.steer));

  if (!kart.airborne) {
    if (here.boost) startBoost(kart, params, here.boostTime || PHYS.PAD_BOOST);
    let maxV = params.topSpeed;
    if (here.surface !== 'road') maxV *= PHYS.DIRT_FACTOR;
    if (kart.boost > 0) maxV *= PHYS.BOOST_FACTOR;
    // ハンドルを切ったりドリフトしたりすると、少し遅くなる
    maxV *= 1 - (kart.drift.active ? PHYS.DRIFT_DRAG : PHYS.STEER_DRAG * Math.abs(steer));
    // 路面のでこぼこで、最高速が少しずつ上下する（走っている場所で決まる。ダートは大きく）
    const bump = here.surface === 'road' ? PHYS.BUMP_ROAD : PHYS.BUMP_DIRT;
    maxV *= 1 + (bump * (Math.sin(here.s * 0.37) + Math.sin(here.s * 1.13 + 1.7))) / 2;
    if (ctl.brake) {
      kart.speed = Math.max(-PHYS.REVERSE_MAX, kart.speed - PHYS.BRAKE * dt);
    } else if (kart.speed < maxV) {
      // 最高速に近いほど、加速が弱くなる
      const taper = Math.max(0.3, 1 - PHYS.ACCEL_TAPER * (Math.max(0, kart.speed) / maxV) ** 3);
      kart.speed = Math.min(maxV, kart.speed + params.accel * taper * dt);
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
          kart.drift = { active: true, dir: Math.sign(steer), stage: 0, counter: false, flicks: 0, time: 0 };
        }
      }
    } else if (kart.drift.active) {
      if (!ctl.drift) endDrift(kart, params, true);
      else if (kart.speed < PHYS.DRIFT_MIN_SPEED) endDrift(kart, params, false);
      else {
        // 煙の色は、ドリフトを続けた時間で進む（STAGE_TIME ごとに 白 → 黄 → 赤）
        // 反対に切って戻す（反対のボタンを押して離すだけでもよい）たびに、1段早く進む
        const d = kart.drift;
        d.time += dt;
        const along = steer * d.dir;
        if (along < -PHYS.COUNTER) d.counter = true;
        else if (d.counter && along > -0.1) {
          d.counter = false;
          d.flicks += 1;
        }
        d.stage = Math.min(2, d.flicks + Math.floor(d.time / PHYS.STAGE_TIME));
      }
    }

    // ふつうのハンドルは大回り（遅いときだけ少し強い）。きついカーブはドリフトで曲がる（マリオカート64 のように）
    // 止まりかけでは曲がれない
    const grip = Math.min(1, Math.abs(kart.speed) / PHYS.TURN_FULL_SPEED) * Math.sign(kart.speed);
    const slow = 1 + PHYS.LOW_SPEED_BONUS * (1 - Math.min(1, Math.abs(kart.speed) / params.topSpeed));
    const turn = kart.drift.active ? kart.drift.dir * PHYS.DRIFT_BASE + steer * PHYS.DRIFT_ADJ : steer * slow;
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
  const fromX = kart.x;
  const fromZ = kart.z;
  kart.x += Math.cos(kart.move) * kart.speed * dt;
  kart.z += Math.sin(kart.move) * kart.speed * dt;
  let loc = locate(track, kart.x, kart.z, kart.seg);
  if (!kart.airborne && loc.ground === null && Math.cos(wrapAngle(kart.move - loc.heading)) * kart.speed <= 0) {
    // 着地する側から、コースと逆向きに地面のない所へ入ろうとした（逆走・バック）。飛ばずに、ふちで止まる
    // （2026-10-14 の実機確認で、逆走して飛び越えてしまった）
    kart.x = fromX;
    kart.z = fromZ;
    kart.speed = 0;
    if (kart.drift.active) endDrift(kart, params, false);
    kart.hop = 0;
    loc = locate(track, kart.x, kart.z, kart.seg);
    // 止まっていても、逆向きに進もうとしていれば逆走の時間を数える（ずっと止まったままにならないように）
    if (Math.cos(wrapAngle(kart.heading - loc.heading)) < 0) kart.wrongTime += dt;
  }
  // バンプ: メーター100を超えて乗ったら転がる。それ以下なら乗り越える（2026-10-15 のユーザー依頼）
  if (!kart.airborne && kart.speed > 0) {
    for (const b of track.bumps ?? []) {
      if (!crossed(track, here.s, loc.s, b)) continue;
      if (meterKmh(kart.speed) > BUMP_LIMIT_KMH) {
        kart.tumble = TUMBLE_TIME;
        if (kart.drift.active) endDrift(kart, params, false);
        kart.hop = 0;
        kart.boost = 0;
      } else {
        kart.hump = HUMP_TIME;
      }
    }
  }
  kart.seg = loc.i;
  kart.surface = loc.surface;

  if (kart.airborne) {
    kart.vy -= PHYS.GRAVITY * dt;
    kart.y += kart.vy * dt;
    if (loc.ground !== null && kart.y <= loc.ground) {
      kart.y = loc.ground;
      kart.vy = 0;
      kart.airborne = false;
      // 空中でドリフトボタンを押してハンドルを切っていれば、着地してすぐドリフト（マリオカート64 のように）
      if (ctl.drift && Math.abs(steer) > PHYS.COUNTER && kart.speed >= PHYS.DRIFT_MIN_SPEED) {
        kart.drift = { active: true, dir: Math.sign(steer), stage: 0, counter: false, flicks: 0, time: 0 };
      }
    } else if (kart.y < PHYS.FALL_Y) {
      kart.respawn = PHYS.RESPAWN_DELAY;
      kart.respawnAt = respawnIndex(track, loc.i);
      kart.speed = 0;
      return;
    }
  } else if (loc.ground === null) {
    // 地面がなくなった。前に走っていればジャンプ台から飛び出す（いつも同じ速さで、必ず向こう側に届く）
    kart.airborne = true;
    kart.hop = 0; // 跳ねている途中でも、飛び出したら跳ねは終わり
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
      // コースの向きにそろえる。逆走しているときは逆向きにそろえる（くるっと前向きに戻さない）
      const along = Math.cos(wrapAngle(kart.move - loc.heading)) >= 0 ? loc.heading : wrapAngle(loc.heading + Math.PI);
      kart.heading = along;
      kart.move = along;
    }
  }
  // ロータリーの島: 中に入ろうとしたら、まわりへ押し出す。速さを落とすのは、ぶつかった最初の1回だけ（柵と同じ）
  // 島のふちにそって進む向きにそろえるので、まっすぐ当たっても、近い側へ抜けられる
  let onIsland = false;
  for (const isl of track.islands ?? []) {
    const dx = kart.x - isl.x;
    const dz = kart.z - isl.z;
    const d = Math.hypot(dx, dz);
    const min = isl.r + PHYS.ISLAND_PAD;
    if (d >= min || d === 0) continue;
    onIsland = true;
    kart.x = isl.x + (dx / d) * min;
    kart.z = isl.z + (dz / d) * min;
    const into = -(Math.cos(kart.move) * dx + Math.sin(kart.move) * dz) / d; // 島の中心へ向かう割合
    if (into > 0 && !kart.airborne) {
      if (!kart.onIsland) kart.speed *= 1 - (1 - PHYS.WALL_KEEP) * Math.min(1, into / Math.sin(PHYS.WALL_FULL_ANGLE));
      const tangent = Math.atan2(dx, -dz); // 島のふちにそう向き
      const along = Math.cos(wrapAngle(kart.move - tangent)) >= 0 ? tangent : wrapAngle(tangent + Math.PI);
      kart.move = along;
      kart.heading = along;
    }
  }
  kart.onIsland = onIsland;
  kart.onWall = touching || onIsland;

  // 逆走: コースの向きと逆に走っている時間を数える。1秒で警告、10秒続いたらスピンして正しい向きに戻す
  const along = Math.cos(wrapAngle(kart.move - loc.heading)) * kart.speed;
  if (along < -2) {
    kart.wrongTime += dt;
    kart.rightTime = 0;
  } else if (along > 2) {
    kart.rightTime += dt;
    if (kart.rightTime >= PHYS.WRONG_CLEAR) kart.wrongTime = 0;
  }
  if (kart.wrongTime >= PHYS.WRONG_FIX && !kart.airborne) {
    if (kart.drift.active) endDrift(kart, params, false);
    kart.hop = 0;
    kart.spin = PHYS.SPIN_TIME;
    kart.spinTo = loc.heading;
    kart.speed *= 0.3;
    kart.wrongTime = 0;
  }
  kart.wrongWay = kart.wrongTime >= PHYS.WRONG_WARN;
}
