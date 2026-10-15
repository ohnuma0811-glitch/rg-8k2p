// CPU の運転: 道の中心から少しずれた線を、少し先を見て走る。きついカーブの手前ではブレーキ、
// 長いカーブではドリフト。プレイヤーより前の CPU は少し遅く、後ろの CPU は少し速く（離れすぎないように）
import { locate, islandNear, span } from './track.js';

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
  BUMP_SPEED: 17, // バンプの手前で落とす速さ（m/s。メーター約92）
  BUMP_MISS: 0.2, // バンプの手前で減速を忘れる割合（ときどき転がる）
};

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// k 番目の CPU。走る線（中心から右へ m）と、線をゆらす速さを少しずつ変える
export function createCpu(k) {
  return {
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
  let lane = cpu.lane + Math.sin(t * cpu.sway + cpu.phase) * 2;
  // ロータリー: 島のまわりは、近い側（曲がる向きの内側。まっすぐなら自分の走る線の側）を、島から離れて回る
  const isl = islandNear(track, p.s);
  if (isl) {
    const turnTo = wrap(samples[(loc.i + 60) % n].h - loc.heading);
    const side = turnTo > 0.3 ? 1 : turnTo < -0.3 ? -1 : Math.sign(cpu.lane) || 1;
    lane = side * (isl.r + 5 + Math.abs(Math.sin(t * cpu.sway + cpu.phase)) * 2);
  }
  const tx = p.x - Math.sin(p.h) * lane;
  const tz = p.z + Math.cos(p.h) * lane;
  const angle = wrap(Math.atan2(tz - kart.z, tx - kart.x) - kart.move);
  const steer = Math.max(-1, Math.min(1, angle * CPU.STEER_GAIN));
  const bendTo = wrap(samples[(loc.i + CPU.BEND_AHEAD) % n].h - loc.heading);
  const bend = Math.abs(bendTo);
  // バンプ: 手前で、メーター100より下まで落とす（ときどき間に合わず転がる: 2割くらい。周ごとに変わる）
  let bumpBrake = false;
  (track.bumps ?? []).forEach((b, k) => {
    const ahead = span(track, loc.s, b);
    const stop = (kart.speed ** 2 - CPU.BUMP_SPEED ** 2) / (2 * 25) + 6;
    if (ahead < Math.max(6, stop) && kart.speed > CPU.BUMP_SPEED && !bumpMiss(cpu, k, t)) bumpBrake = true;
  });
  const brake = (bend > CPU.BRAKE_BEND && kart.speed > CPU.CORNER_SPEED) || bumpBrake;
  if (!cpu.drifting && bend > CPU.DRIFT_BEND && kart.speed > 20 && !kart.airborne) cpu.drifting = true;
  if (cpu.drifting && (bend < CPU.DRIFT_END || kart.speed < 14)) cpu.drifting = false;
  // ドリフトを始める（跳ねている）間だけ、曲がる向きにハンドルを切る。滑り出したら、目指す点に合わせて加減する
  const starting = cpu.drifting && !kart.drift.active;
  const out = starting ? Math.sign(bendTo) * Math.max(0.5, Math.abs(steer)) : steer;
  return { steer: out, brake, drift: cpu.drifting };
}

// CPU が、このバンプで減速を忘れるか（2割。同じ周の間は変わらない）
function bumpMiss(cpu, b, t) {
  const r = Math.sin((cpu.id ?? 0) * 12.9898 + b * 78.233 + Math.floor(t / 50) * 37.719) * 43758.5453;
  return r - Math.floor(r) < CPU.BUMP_MISS;
}

// CPU の車の数字（キャラの数字に、CPU の強さと、プレイヤーとの差の倍率をかける）
export function cpuParams(base, rubber) {
  return { ...base, topSpeed: base.topSpeed * CPU.SKILL * rubber };
}
