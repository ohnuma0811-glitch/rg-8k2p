// CPU の運転: 道の中心から少しずれた線を、少し先を見て走る。きついカーブの手前ではブレーキ、
// 長いカーブではドリフト。プレイヤーより前の CPU は少し遅く、後ろの CPU は少し速く（離れすぎないように）
import { locate, islandNear, span } from './track.js?v=150f95c';
import { cowPose, busPose, BUS_SPEED, BUS_WIDTH } from './hazards.js?v=150f95c';

export const CPU = {
  LOOK: 10, // 何m先の点を目指すか（の基本）
  LOOK_PER_SPEED: 0.3, // 速さ1m/s ごとに、目指す点をこれだけ先にする
  STEER_GAIN: 2.5, // 目指す点とのずれ（rad）を、ハンドルの量にする倍率
  BEND_AHEAD: 35, // 何m先までのカーブを見るか
  BRAKE_BEND: 1.1, // この角度（rad）以上曲がるカーブの手前では、速すぎればブレーキ
  CORNER_SPEED: 25, // きついカーブに入る速さ（m/s）
  DRIFT_BEND: 0.6, // この角度以上曲がるカーブでは、ドリフトする
  DRIFT_END: 0.25, // カーブがこの角度より小さくなったら、ドリフトをやめる
  SKILL: 0.98, // CPU の最高速の割合（プレイヤーが「がんばれば勝てる」くらいに。0.93 では弱すぎた: 2026-10-14 の実機確認）
  RUBBER: 0.6, // プレイヤーとの差（1周に対する割合）を、速さの倍率にする強さ
  RUBBER_MAX: 0.12, // 速さを変えるのは、この割合まで
  BUMP_SPEED: 26, // バンプ・牛の手前で落とす速さ（m/s。メーター約140）
  BUMP_MISS: 0.2, // バンプの手前で減速を忘れる割合（ときどき転がる）
};

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// k 番目の CPU。走る線（中心から右へ m）と、線をゆらす速さを少しずつ変える
// seed はレースごとの数（バンプで減速を忘れる所が、レースごとに変わる）
export function createCpu(k, seed = 0) {
  return {
    seed,
    lap: 0, // 何周目か（バンプで減速を忘れる所が、周ごとに変わる）
    lastS: null,
    lane: [-5, 4, -2, 6, -6, 2, 5][k % 7],
    sway: 0.4 + (k % 3) * 0.15,
    phase: k * 1.7,
    drifting: false,
    dash: k % 2 === 0, // スタートダッシュをするか（4台のうち2台）
    id: k,
  };
}

// プレイヤーとの差から、速さの倍率を決める（progress の差、1周の長さ L）
export function rubberFactor(cpuProgress, playerProgress, L) {
  const diff = (playerProgress - cpuProgress) / L; // プレイヤーが前ならプラス
  // レースの最初（まだ進んだ距離が分からない）は、そのままの速さ
  if (!Number.isFinite(diff)) return 1;
  return 1 + Math.max(-CPU.RUBBER_MAX, Math.min(CPU.RUBBER_MAX, diff * CPU.RUBBER));
}

// その時の操作（{ steer, brake, drift }）。t はレースの時刻（線をゆらすため）
export function cpuControl(cpu, kart, track, t) {
  const { samples } = track;
  const n = samples.length;
  const loc = locate(track, kart.x, kart.z, kart.seg);
  const look = Math.round(CPU.LOOK + Math.max(0, kart.speed) * CPU.LOOK_PER_SPEED);
  const p = samples[(loc.i + look) % n];
  // 周を数える（スタートの線を越えたら1つ増やす）
  if (cpu.lastS !== null && loc.s < cpu.lastS - track.length / 2) cpu.lap++;
  cpu.lastS = loc.s;
  let lane = cpu.lane + Math.sin(t * cpu.sway + cpu.phase) * 2;
  // ロータリー: 島のまわりは、近い側（曲がる向きの内側。まっすぐなら自分の走る線の側）を、島から離れて回る
  const isl = islandNear(track, p.s);
  if (isl) {
    const turnTo = wrap(samples[(loc.i + 60) % n].h - loc.heading);
    const side = turnTo > 0.3 ? 1 : turnTo < -0.3 ? -1 : Math.sign(cpu.lane) || 1;
    lane = side * (isl.r + 5 + Math.abs(Math.sin(t * cpu.sway + cpu.phase)) * 2);
  }
  // 牛: いちばん近い先の牛が、自分が着くころに走る線の近くにいたら、牛の横（5m 離れた所）を通る
  // よけた先が道のはしで牛に近ければ、反対側からよける。牛のすぐ手前では、ぶつかってもスピンしない速さまで落とす
  let cowBrake = false;
  let cowAhead = Infinity;
  let cowNear = null;
  for (const cow of track.cows ?? []) {
    const ahead = span(track, loc.s, cow.s);
    if (ahead < 40 && ahead < cowAhead) {
      cowAhead = ahead;
      cowNear = cow;
    }
  }
  if (cowNear) {
    const c = cowPose(track, cowNear, t + cowAhead / Math.max(5, kart.speed));
    const edge = track.roadHalf - 2;
    if (Math.abs(lane - c.lateral) < 4.5) {
      const side = Math.sign(lane - c.lateral) || 1;
      let dodge = Math.max(-edge, Math.min(edge, c.lateral + 5.5 * side));
      if (Math.abs(dodge - c.lateral) < 4.5) dodge = Math.max(-edge, Math.min(edge, c.lateral - 5.5 * side));
      lane = dodge;
      if (Math.abs(lane - c.lateral) < 4.5) cowBrake = true;
    }
    if (Math.abs(loc.lateral - c.lateral) < 4) cowBrake = true;
    // 牛までに、スピンしない速さまで落とせる所から減速する
    const stop = (kart.speed ** 2 - CPU.BUMP_SPEED ** 2) / (2 * 25) + 8;
    if (cowAhead > Math.max(8, stop)) cowBrake = false;
  }
  // 分離帯（芝生）の上は走らない: 走る線が分離帯にかかるときは、分離帯の外へ
  // 今いる所から、目指す点の少し先までに分離帯があれば、早めに分離帯の外の線へ寄る
  let median = 0;
  for (let k = 0; k <= look + 25; k += 3) median = Math.max(median, samples[(loc.i + k) % n].median);
  // 真ん中に近い線は、左右がゆれて分離帯をまたがないよう、その CPU のもとの側にする
  if (median > 0) {
    const side = Math.abs(lane) > median + 1 ? Math.sign(lane) : Math.sign(cpu.lane) || 1;
    lane = side * Math.max(Math.abs(lane), median + 2);
  }
  // スクールバス（逆向きに走ってくる）: 先から来るバスの横を、左の車線でよける（2026-10-16 のユーザー依頼）。
  // ロータリーでは島の左側を回る。分離帯のある所で右の側を走っているときは、バスの右（柵の側）。
  // よけている間は、目指す点を近くにして、角でも内側へ切れこまない（右の角の内側はバスの車線）
  let aim = p;
  let busNearby = false;
  for (const bus of track.buses ?? []) {
    const b = busPose(track, bus, t);
    const ahead = span(track, loc.s, b.s);
    if (ahead > 110 && ahead < track.length - 12) continue; // 先 110m から、すれちがって 12m 過ぎるまで
    busNearby = true;
    const edge = samples[loc.i].half - 2;
    if (isl || islandNear(track, loc.s)) lane = -Math.abs(lane) - (isl ? 0 : 2);
    else if (median > 0 && lane > 0) lane = Math.max(lane, Math.min(edge, b.lateral + BUS_WIDTH / 2 + 4.5));
    else lane = Math.min(lane, b.lateral - BUS_WIDTH / 2 - 6.2);
    if (ahead < 40 || ahead > track.length - 12) aim = samples[(loc.i + 8) % n];
  }
  const tx = aim.x - Math.sin(aim.h) * lane;
  const tz = aim.z + Math.cos(aim.h) * lane;
  const angle = wrap(Math.atan2(tz - kart.z, tx - kart.x) - kart.move);
  const steer = Math.max(-1, Math.min(1, angle * CPU.STEER_GAIN));
  const bendTo = wrap(samples[(loc.i + CPU.BEND_AHEAD) % n].h - loc.heading);
  const bend = Math.abs(bendTo);
  // バンプ: 手前で、メーター100より下まで落とす（ときどき間に合わず転がる: 2割くらい。周ごとに変わる）
  let bumpBrake = false;
  (track.bumps ?? []).forEach((b, k) => {
    const ahead = span(track, loc.s, b);
    const stop = (kart.speed ** 2 - CPU.BUMP_SPEED ** 2) / (2 * 25) + 6;
    if (ahead < Math.max(6, stop) && kart.speed > CPU.BUMP_SPEED && !bumpMiss(cpu, k, cpu.lap)) bumpBrake = true;
  });
  const brake = (bend > CPU.BRAKE_BEND && kart.speed > CPU.CORNER_SPEED) || bumpBrake || (cowBrake && kart.speed > CPU.BUMP_SPEED);
  // バスが近いときはドリフトしない（ドリフトで外へふくらむと、バスの車線に入る）
  if (!cpu.drifting && bend > CPU.DRIFT_BEND && kart.speed > 20 && !kart.airborne && !busNearby) cpu.drifting = true;
  if (busNearby) cpu.drifting = false;
  if (cpu.drifting && (bend < CPU.DRIFT_END || kart.speed < 14)) cpu.drifting = false;
  // ドリフトを始める（跳ねている）間だけ、曲がる向きにハンドルを切る。滑り出したら、目指す点に合わせて加減する
  const starting = cpu.drifting && !kart.drift.active;
  const out = starting ? Math.sign(bendTo) * Math.max(0.5, Math.abs(steer)) : steer;
  return { steer: out, brake, drift: cpu.drifting };
}

// CPU が、このバンプ（b 番目）で、この周（lap）に減速を忘れるか（2割くらい。レース・CPU・バンプ・周で決まる）
// （最終レビュー: sin を使った前の式は、レースごとに同じで、かたよっていた）
export function bumpMiss(cpu, b, lap) {
  let h = Math.imul((cpu.seed ?? 0) + 1, 2654435761) ^ Math.imul((cpu.id ?? 0) + 1, 73856093) ^ Math.imul(b + 1, 19349663) ^ Math.imul(lap + 1, 83492791);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) % 100 < CPU.BUMP_MISS * 100;
}

// CPU の車の数字（キャラの数字に、CPU の強さと、プレイヤーとの差の倍率をかける）
export function cpuParams(base, rubber) {
  return { ...base, topSpeed: base.topSpeed * CPU.SKILL * rubber };
}
