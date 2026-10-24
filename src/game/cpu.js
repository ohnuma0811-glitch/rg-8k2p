// CPU の運転: 道の中心から少しずれた線を、少し先を見て走る。きついカーブの手前ではブレーキ、
// 長いカーブではドリフト。プレイヤーより前の CPU は少し遅く、後ろの CPU は少し速く（離れすぎないように）
import { locate, islandNear, span, ahead as aheadOf } from './track.js?v=bb0e8ec';
import { cowPose, boarPose, busPose, dinoPose, BUS_SPEED, BUS_WIDTH, snowmanPose } from './hazards.js?v=bb0e8ec';

export const CPU = {
  ITEM_SWAP_SPEED: 0.75, // アイテムで左右が入れ替わっている間の、最高速に対する上限
  ITEM_SWAP_WOBBLE: 0.4, // そのときのハンドルのゆれ（-1〜1 の量）
  ITEM_SWAP_FREQ: 5, // ゆれの速さ（rad/s）
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

// 木の場所（動かない）を、牛の場所と同じ形で
function treePose(track, tr) {
  const p = track.samples[tr.i];
  return { x: tr.x, z: tr.z, lateral: -Math.sin(p.h) * (tr.x - p.x) + Math.cos(p.h) * (tr.z - p.z), state: 'stand' };
}

// プレイヤーとの差から、速さの倍率を決める（progress の差、1周の長さ L）
export function rubberFactor(cpuProgress, playerProgress, L) {
  const diff = (playerProgress - cpuProgress) / L; // プレイヤーが前ならプラス
  // レースの最初（まだ進んだ距離が分からない）は、そのままの速さ
  if (!Number.isFinite(diff)) return 1;
  return 1 + Math.max(-CPU.RUBBER_MAX, Math.min(CPU.RUBBER_MAX, diff * CPU.RUBBER));
}

// 分かれる所で、その周にどの道を進むか。どの分かれる所でも半分ずつ（2026-10-16 のユーザー依頼「最初の分岐で左右に 50% ずつ」。
// Soki Forest では外の道 1/2、真ん中の道 1/4、近道 1/4）。
// 道の番号か null（そのまま）。レース・CPU・分かれる所・周で決まる（同じ周の中では変わらない）
export function routeChoice(cpu, fork, paths, lap, track) {
  // テスト用: 決まった道を通らせる（'main' はそのまま、ほかは分かれ道の id）
  if (cpu.forceRoute) return cpu.forceRoute === 'main' ? null : paths.find((p) => track.paths[p].id === cpu.forceRoute) ?? null;
  let h = Math.imul((cpu.seed ?? 0) + 7, 2654435761) ^ Math.imul((cpu.id ?? 0) + 3, 73856093) ^ Math.imul(fork + 1, 19349663) ^ Math.imul(lap + 1, 83492791);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  const r = (h >>> 0) / 4294967296;
  // どの分かれる所でも、そのまま・分かれ道を半分ずつ（2026-10-16 のユーザー依頼「最初の分岐で左右に 50% ずつ」）
  return r < 0.5 ? null : paths[0];
}

// その時の操作（{ steer, brake, drift }）。t はレースの時刻（線をゆらすため）
export function cpuControl(cpu, kart, track, t, topSpeed = null) {
  const { samples } = track;
  const n = samples.length;
  const loc = locate(track, kart.x, kart.z, kart.seg, 40, kart.y ?? null);
  const look = Math.round(CPU.LOOK + Math.max(0, kart.speed) * CPU.LOOK_PER_SPEED);
  // 周を数える（スタートの線を越えたら1つ増やす）
  if (cpu.lastS !== null && loc.s < cpu.lastS - track.length / 2) cpu.lap++;
  cpu.lastS = loc.s;
  // 先の点（分かれる所では、その周に選んだ道を進む）
  const choose = (i, paths) => routeChoice(cpu, i, paths, cpu.lap, track);
  // 一度たどった先の点は覚えておく（毎回はじめから数え直すと重い。2026-10-19 のユーザー依頼「47fps くらいで重たい」）
  const chain = [loc.i];
  const at = (k) => {
    for (let c = chain.length; c <= k; c++) {
      const next = aheadOf(track, chain[c - 1], 1, choose);
      // 片道のコース（Global City）: 無い道の点は目指さない（道の終わりの手前の点のまま）
      chain.push(samples[next].void ? chain[c - 1] : next);
    }
    return samples[chain[k]];
  };
  const p = at(look);
  let lane = cpu.lane + Math.sin(t * cpu.sway + cpu.phase) * 2;
  // ロータリー: 島のまわりは、近い側（曲がる向きの内側。まっすぐなら自分の走る線の側）を、島から離れて回る
  const isl = islandNear(track, p.s);
  if (isl) {
    const turnTo = wrap(at(60).h - loc.heading);
    const side = turnTo > 0.3 ? 1 : turnTo < -0.3 ? -1 : Math.sign(cpu.lane) || 1;
    lane = side * (isl.r + 5 + Math.abs(Math.sin(t * cpu.sway + cpu.phase)) * 2);
  }
  // 分かれ道の手前（60m）では、選んだ道の側に寄る（分かれる所では2本の道の点が近いので、反対の道の点に拾われないように。2026-10-18）
  for (const [fi, list] of Object.entries(track.forks ?? {})) {
    const f = samples[Number(fi)];
    if (samples[loc.i].path !== f.path) continue;
    const toFork = span(track, loc.s, f.s);
    if (toFork > 60) continue;
    const pick = routeChoice(cpu, Number(fi), list, cpu.lap, track);
    for (const k of list) {
      const q = samples[Math.min(track.paths[k].start + 30, track.paths[k].start + track.paths[k].count - 1)];
      const side = Math.sign(-Math.sin(f.h) * (q.x - f.x) + Math.cos(f.h) * (q.z - f.z)) || 1;
      lane = pick === k ? side * 5 : -side * 5;
    }
  }
  // 牛: いちばん近い先の牛が、自分が着くころに走る線の近くにいたら、牛の横（5m 離れた所）を通る
  // よけた先が道のはしで牛に近ければ、反対側からよける。牛のすぐ手前では、ぶつかってもスピンしない速さまで落とす
  let cowBrake = false;
  let cowAhead = Infinity;
  let cowNear = null;
  // イノシシ（Soki Forest）も、牛と同じようによける。着くころに道の外にかくれているイノシシは数えない
  const animals = [
    ...(track.cows ?? []).map((cow) => ({ s: cow.s, pose: (time) => cowPose(track, cow, time) })),
    ...(track.boars ?? []).map((boar) => ({ s: boar.s, pose: (time) => boarPose(track, boar, time) })),
    // 雪だるま（Kyugo Mountain）: 自分と同じ道の雪だるまだけ
    ...(track.snowmen ?? []).filter((sm) => sm.path === samples[loc.i].path).map((sm) => ({ s: sm.s, pose: (time) => snowmanPose(track, sm, time) })),
    // 道の上の動かない木（Soki Forest）: 自分と同じ道の木だけ
    ...(track.trees ?? []).filter((tr) => tr.path === samples[loc.i].path).map((tr) => ({ s: tr.s, pose: () => treePose(track, tr) })),
  ];
  for (const a of animals) {
    const ahead = span(track, loc.s, a.s);
    if (ahead < 40 && ahead < cowAhead && a.pose(t + ahead / Math.max(5, kart.speed)).state !== 'hide') {
      cowAhead = ahead;
      cowNear = a;
    }
  }
  if (cowNear) {
    const c = cowNear.pose(t + cowAhead / Math.max(5, kart.speed));
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
  for (let k = 0; k <= look + 25; k += 3) median = Math.max(median, at(k).median);
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
    if (ahead < 40 || ahead > track.length - 12) aim = at(8);
  }
  // 近道のわな（Soki Forest）: 1回通るうち 3割くらいは、うっかり、ぬかるみの1つに入る（よけない。2026-10-16 のユーザー依頼）
  const careless = trapLap(cpu, cpu.lap);
  const mudIn = (track.muds ?? [])[trapMud(cpu, cpu.lap, (track.muds ?? []).length)];
  if (careless && mudIn && Math.hypot(mudIn.x - kart.x, mudIn.z - kart.z) < 45) {
    const q = locate(track, mudIn.x, mudIn.z, loc.i, 40, mudIn.y);
    lane = q.lateral;
  }
  // ぬかるみ（Soki Forest）: 先のぬかるみが自分の走る線にかかっていたら、横へよける。入ってしまったら、ハンドルを逆に切る（kart.js で逆になるので）
  for (const m of careless ? [] : track.muds ?? []) {
    const d = Math.hypot(m.x - kart.x, m.z - kart.z);
    if (d > 45) continue;
    const q = locate(track, m.x, m.z, loc.i, 40, m.y);
    if (Math.abs(q.lateral - lane) >= m.r + 2) continue;
    const edge = samples[loc.i].half - 1.5;
    const side = Math.sign(lane - q.lateral) || 1;
    let dodge = q.lateral + (m.r + 2.5) * side;
    if (Math.abs(dodge) > edge) dodge = q.lateral - (m.r + 2.5) * side;
    lane = Math.max(-edge, Math.min(edge, dodge));
  }
  let slowBrake = false;
  let slowNear = false;
  // スローの板（Kyugo Mountain）: 先 90m までに板があり、自分の走る線が板にかかっていたら、板の反対側を走る（うっかりの周はよけない）
  for (const sl of careless ? [] : track.slows ?? []) {
    if (samples[loc.i].path !== 0) break;
    const ahead = (sl.from - loc.i + track.length) % track.length;
    const behindEnd = (loc.i - sl.from + track.length) % track.length;
    if (ahead > 90 && behindEnd >= 30) continue;
    // 板の横を通る（真ん中の板なら、自分の走る線の側へ）
    if (Math.abs(lane - sl.lateral) < sl.half + 2.5) lane = sl.lateral ? -Math.sign(sl.lateral) * 4 : (Math.sign(cpu.lane) || 1) * (sl.half + 3);
    slowNear = true; // 板の近くではドリフトしない（外へすべって板に乗らないように）
    // 板の手前 50m から板の上までは、近くの点をめざす（くねくね道で、カーブの内がわを切って板の上を通らないように）
    if (ahead < 50 || behindEnd < 30) aim = at(12);
    // 板の手前 40m で、まだ板の側にいたら（カーブで外へすべって）、速さを落として寄りやすくする
    if (ahead < 40 && ahead > 15 && Math.abs(loc.lateral - sl.lateral) < sl.half + 1) slowBrake = true;
  }
  // 木の実の影（Soki Forest）: まだ落ちていない木の実の落ちる所が、自分の走る線の近く（3m）なら、その横へずれる
  for (const nut of track.nuts?.list ?? []) {
    if (Math.hypot(nut.x - kart.x, nut.z - kart.z) > 35) continue;
    const q = locate(track, nut.x, nut.z, loc.i, 40, nut.y ?? null);
    if (Math.abs(q.lateral - lane) >= 3) continue;
    const edge = samples[loc.i].half - 2;
    const side = Math.sign(lane - q.lateral) || 1;
    let dodge = q.lateral + 4.5 * side;
    if (Math.abs(dodge) > edge) dodge = q.lateral - 4.5 * side;
    lane = Math.max(-edge, Math.min(edge, dodge));
  }
  // 橋の下の橋脚（Soki Forest。2026-10-17）: 下の道で橋に近づいたら、いちばん近いすき間のまん中を走る。近くの点を目指して、ずれないように
  // 壁は下の道に少しななめなので、すき間のまん中の線（壁と同じ向き）に沿って、少し先の点を目指す
  let underBridge = null;
  for (const b of track.bridges ?? []) {
    const u = samples[b.under];
    if (samples[loc.i].path !== u.path || Math.hypot(u.x - kart.x, u.z - kart.z) > 60) continue;
    const piers = (track.bridgePiers ?? []).filter((p) => Math.abs(p.s - b.s) < 30).sort((a, c) => a.s - c.s);
    let best = null;
    for (let k = 1; k < piers.length; k++) {
      const mx = (piers[k - 1].x + piers[k].x) / 2;
      const mz = (piers[k - 1].z + piers[k].z) / 2;
      // すき間の線の向き（橋のはばの向き）を、走る向きにそろえる
      let wx = -Math.sin(piers[k].h);
      let wz = Math.cos(piers[k].h);
      if (wx * Math.cos(kart.move) + wz * Math.sin(kart.move) < 0) {
        wx = -wx;
        wz = -wz;
      }
      const proj = (kart.x - mx) * wx + (kart.z - mz) * wz;
      const off = Math.abs((kart.x - mx) * wz - (kart.z - mz) * wx); // すき間の線からのずれ
      if (proj > 6) continue; // もう通りぬけた
      if (!best || off < best.off) best = { off, x: mx + wx * (proj + 12), z: mz + wz * (proj + 12) };
    }
    if (best) underBridge = best;
  }
  const tx = underBridge ? underBridge.x : aim.x - Math.sin(aim.h) * lane;
  const tz = underBridge ? underBridge.z : aim.z + Math.cos(aim.h) * lane;
  const angle = wrap(Math.atan2(tz - kart.z, tx - kart.x) - kart.move);
  const steer = Math.max(-1, Math.min(1, angle * CPU.STEER_GAIN));
  const bendTo = wrap(at(CPU.BEND_AHEAD).h - loc.heading);
  const bend = Math.abs(bendTo);
  // バンプ: 手前で、メーター100より下まで落とす（ときどき間に合わず転がる: 2割くらい。周ごとに変わる）
  let bumpBrake = false;
  (track.bumps ?? []).forEach((b, k) => {
    const ahead = span(track, loc.s, b);
    const stop = (kart.speed ** 2 - CPU.BUMP_SPEED ** 2) / (2 * 25) + 6;
    if (ahead < Math.max(6, stop) && kart.speed > CPU.BUMP_SPEED && !bumpMiss(cpu, k, cpu.lap)) bumpBrake = true;
  });
  // 恐竜（Soki Forest）: ジャンプ②に着くころ恐竜が顔を出していそうなら、ジャンプ台の手前で速さを落として待つ
  let dinoBrake = false;
  if (track.dino && samples[loc.i].path === 0) {
    const ahead = span(track, loc.s, track.dino.s);
    if (kart.eaten > 0 && ahead < 140 && ahead > 12) {
      // 一度食べられた CPU（2026-10-16 のユーザー依頼「二回続けて食べられないように」）: 今から、着いて飛び終わるまで
      // ずっと恐竜が低い（顔が通り道にない）と分かるまで、ジャンプ台の手前 DINO_HOLD m で止まって待つ
      // （着く時刻は速めに見る: 手前の加速板で速くなるので）
      const arrive = ahead / Math.max(25, kart.speed);
      let safe = true;
      // 顔のてっぺんが通り道にかかるのは rise 0.3 くらいから。ほぼ沈みきった（0.2 より下の）ときだけ進む（最終レビュー）
      for (let d = 0; d <= arrive + 0.8 && safe; d += 0.1) safe = dinoPose(track, t + d).rise < 0.2;
      if (!safe) {
        // 止まる所までに、だんだん遅く。止まる所からは、しっかり止まる（少しずつ進んで加速板に乗らないように。最終レビュー）
        const target = Math.max(0, ahead - DINO_HOLD) * 0.8;
        dinoBrake = ahead <= DINO_HOLD ? kart.speed > 0.2 : kart.speed > target + 1;
      }
    } else if (ahead < 110 && ahead > 20) {
      const arrive = t + ahead / Math.max(8, kart.speed);
      dinoBrake = (dinoPose(track, arrive).rise > 0.3 || dinoPose(track, arrive + 0.8).rise > 0.3) && kart.speed > 10;
    }
  }
  // 目指す向きと大きくずれた（柵にぶつかった・ななめに着地した）ら、速さを落として向き直る（2026-10-16: 左右の柵を行き来して動けなくなった）
  const lost = Math.abs(angle) > 1.0 && kart.speed > 12 && !kart.airborne;
  // 橋の下の橋脚のすき間は、ゆっくり通る（せまいので）
  // すべる道（Kyugo Mountain の雪と氷）: カーブの手前で、すべりやすさに合わせて少し遅く（外へすべって板や柵に行かないように）
  const grip = Math.min(samples[loc.i].grip ?? 1, at(CPU.BEND_AHEAD).grip ?? 1);
  // コブゾーン（Kyugo Mountain）: 手前から中まで、速すぎれば落とす（速いまま当たると跳ねて、すべる雪の上で向きを失う）
  const mogulBrake = (track.moguls ?? []).some((m) => samples[m.i].path === samples[loc.i].path && span(track, loc.s, samples[m.i].s) < 45) && kart.speed > 30;
  const slipBrake = grip < 1 && bend > CPU.BRAKE_BEND * 0.7 && kart.speed > CPU.CORNER_SPEED * (0.55 + 0.45 * grip);
  // アイテムの入れ替わり（Banana。kart.swapItem）: ふらふらと走る（ハンドルをゆらし、最高速の ITEM_SWAP_SPEED 倍まで）。ぬかるみは今まで通り
  const swapped = kart.swapItem && kart.muddy > 0;
  const swapSlow = swapped && topSpeed !== null && kart.speed > topSpeed * CPU.ITEM_SWAP_SPEED;
  const brake = lost || swapSlow || slipBrake || mogulBrake || (underBridge && kart.speed > 24) || (bend > CPU.BRAKE_BEND && kart.speed > CPU.CORNER_SPEED) || bumpBrake || (cowBrake && kart.speed > CPU.BUMP_SPEED) || dinoBrake || (slowBrake && kart.speed > 22) ||
    // バスが近いときに曲がり角へ速く入ると、外へふくらんでバスの車線に入るので、落とす
    (busNearby && bend > CPU.DRIFT_BEND && kart.speed > 22);
  // バスが近いときはドリフトしない（ドリフトで外へふくらむと、バスの車線に入る）
  if (!cpu.drifting && bend > CPU.DRIFT_BEND && kart.speed > 20 && !kart.airborne && !busNearby) cpu.drifting = true;
  if (busNearby || underBridge || slowNear) cpu.drifting = false;
  if (cpu.drifting && (bend < CPU.DRIFT_END || kart.speed < 14)) cpu.drifting = false;
  // ドリフトを始める（跳ねている）間だけ、曲がる向きにハンドルを切る。滑り出したら、目指す点に合わせて加減する
  const starting = cpu.drifting && !kart.drift.active;
  const out = starting ? Math.sign(bendTo) * Math.max(0.5, Math.abs(steer)) : steer;
  const wobbled = swapped ? Math.max(-1, Math.min(1, out + CPU.ITEM_SWAP_WOBBLE * Math.sin(t * CPU.ITEM_SWAP_FREQ + cpu.phase))) : out;
  return { steer: kart.muddy > 0 ? -wobbled : wobbled, brake, drift: cpu.drifting && !swapped };
}

const DINO_HOLD = 58; // 一度食べられた CPU が、恐竜を待つ所（ジャンプ②の手前 m。加速板（40m 手前）より十分手前。最終レビューで 45 から）

// CPU が、この周（lap）に近道を通るとき、うっかりわなにかかるか（3割くらい。レース・CPU・周で決まる）
export const TRAP_RATE = 0.3;
function hash01(cpu, salt, lap) {
  let h = Math.imul((cpu.seed ?? 0) + 11, 2654435761) ^ Math.imul((cpu.id ?? 0) + 5, 73856093) ^ Math.imul(salt, 19349663) ^ Math.imul(lap + 1, 83492791);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function trapLap(cpu, lap) {
  return hash01(cpu, 101, lap) < TRAP_RATE;
}
// うっかり入るぬかるみの番号
function trapMud(cpu, lap, n) {
  return Math.floor(hash01(cpu, 202, lap) * n);
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
// CPU の速さの段階（2026-10-17 のユーザー依頼）。最高速の倍率
// Level 1: Soki が遊ぶ用。3周の時間が今の約1.4倍（今の 7割くらいの速さ）
// Level 2: 今のまま
// Level 3: 大人が Level 2 に3周で 1/4周（約8%）の差をつけるので、その速さについてこられる（3周の時間が約8%短い）
export const CPU_LEVELS = { 1: 0.66, 2: 1, 3: 1.12 };
export function cpuParams(base, rubber, level = 2) {
  return { ...base, topSpeed: base.topSpeed * CPU.SKILL * rubber * (CPU_LEVELS[level] ?? 1) };
}

// CPU のアイテム（設計書 docs/superpowers/specs/2026-10-22-items-design.md の 10章）
// 人のプレイヤーをわざとねらわない（CPU には甲羅が出ない。稲妻は全員に落ちる）
export const CPU_ITEM = {
  MIN_WAIT: 0.5, // 取ってから使うまで、いつもこれ以上あける（秒）
  BEHIND: 20, // 後ろのこの m 以内に車が来たら、ぶら下げたバナナを置く
  BANANA_HOLD: 8, // 来なければ、この秒数で置く
  STRAIGHT: 0.15, // まっすぐと見なす、向きの差（rad）
  STRAIGHT_AHEAD: 60, // この m 先まで見る
  MUSHROOM_LATEST: 10, // まっすぐな所がなくても、この秒数持ったら使う
};

// この先 STRAIGHT_AHEAD m がまっすぐか
function straightAhead(kart, track) {
  const h0 = track.samples[kart.seg].h;
  let j = kart.seg;
  for (let d = 0; d < CPU_ITEM.STRAIGHT_AHEAD; d += 5) {
    j = aheadOf(track, j, 5);
    if (Math.abs(wrap(track.samples[j].h - h0)) > CPU_ITEM.STRAIGHT) return false;
  }
  return true;
}

// 後ろ BEHIND m 以内に車がいるか
function someoneBehind(kart, karts) {
  return karts.some((o) => {
    if (o === kart || o.auto || Math.abs((o.y ?? 0) - (kart.y ?? 0)) > 3) return false;
    const dx = o.x - kart.x;
    const dz = o.z - kart.z;
    return dx * Math.cos(kart.heading) + dz * Math.sin(kart.heading) < 0 && Math.hypot(dx, dz) <= CPU_ITEM.BEHIND;
  });
}

// その時 ITEM を押すか。cpu に、アイテムを取った時刻（heldAt）、使うまでの秒数（wait）、ぶら下げた時刻（trailAt）を覚える
export function cpuItem(cpu, kart, karts, track, t, rand = Math.random) {
  if (kart.roulette > 0) return false;
  if (kart.held !== cpu.lastHeld) {
    cpu.lastHeld = kart.held;
    cpu.heldAt = t;
    cpu.wait = 1 + 2 * rand(); // Star・Lightning は1〜3秒で
  }
  if (kart.trailing) {
    if (cpu.trailAt == null) cpu.trailAt = t;
    const waited = t - cpu.trailAt;
    if (waited < CPU_ITEM.MIN_WAIT) return false;
    if (waited >= CPU_ITEM.BANANA_HOLD || someoneBehind(kart, karts)) {
      cpu.trailAt = null;
      return true;
    }
    return false;
  }
  cpu.trailAt = null;
  if (!kart.held) return false;
  const since = t - cpu.heldAt;
  if (since < CPU_ITEM.MIN_WAIT) return false;
  if (kart.held === 'banana') return true;
  // キノコ（3個セット）: 前のキノコの加速が終わってから、次を使う
  if (kart.held === 'mushroom') return !(kart.mushroom > 0) && (since >= CPU_ITEM.MUSHROOM_LATEST || straightAhead(kart, track));
  if (kart.held === 'star' || kart.held === 'lightning') return since >= cpu.wait;
  return false;
}
