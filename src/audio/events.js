// 前と今の様子をくらべて、鳴らす音を決める（音は鳴らさない。テストできるように分けてある）

// ジャンプの着地の音は、地面（高さ 0）に着くこの秒数前に鳴らし始める
// （スマホは音を出すまでに少し遅れるので、着いてから鳴らすと遅れて聞こえた: 2026-10-15 の実機確認）
export const LAND_LEAD = 0.08;
// 壁の音は、この秒数以上壁から離れていたあとにぶつかったときだけ鳴らす
// （壁にこすりながら走ると、ついたり離れたりをくり返して鳴り続けた: 2026-10-15 の実機確認）
export const WALL_QUIET = 0.5;

// 音に関係する様子だけを取り出す。count はカウントの文字（'3' '2' '1' 'GO!' ''）、bumps は自分がぶつかった回数の合計
// wallQuiet: 壁から離れている秒数（前のフレームまで）
export function soundState({ count, lap, finished, kart, bumps, wallQuiet = Infinity }) {
  return {
    count,
    lap,
    finished,
    drift: kart.drift.active && !kart.airborne,
    stage: kart.drift.active ? kart.drift.stage : 0,
    boost: kart.boost > 0,
    airborne: kart.airborne,
    // もうすぐ着地する（落ちている途中で、いまの速さのままなら LAND_LEAD 秒以内に高さ 0 に着く）
    landingSoon: !!kart.airborne && (kart.vy || 0) < 0 && (kart.y || 0) / -kart.vy <= LAND_LEAD,
    hop: (kart.hop || 0) > 0, // ドリフトのボタンで跳ねている
    onWall: kart.onWall,
    bumps,
    wallQuiet,
  };
}

// ゴールしたときの音（順位で変える。2026-10-15 のユーザー依頼）: 1〜3位は明るく、4位以下はちょっと悲しく
export function finishMusic(place) {
  return place <= 3 ? { sfx: 'finish', song: 'victory' } : { sfx: 'finishSad', song: 'consolation' };
}

export function soundEvents(prev, cur, laps) {
  if (!prev) return [];
  const ev = [];
  if (cur.count !== prev.count) {
    if (cur.count === '3' || cur.count === '2' || cur.count === '1') ev.push('count');
    else if (cur.count === 'GO!') ev.push('go');
  }
  if (cur.lap > prev.lap && !cur.finished) ev.push(cur.lap === laps - 1 ? 'finalLap' : 'lap');
  if (cur.finished && !prev.finished) ev.push('finish');
  if (cur.hop && !prev.hop) ev.push('hop');
  if (cur.airborne && !prev.airborne) ev.push('jump'); // ジャンプ台から飛び出した（ドリフトの跳ねは airborne にならない）
  if (cur.drift && !prev.drift) ev.push('driftStart');
  if (!cur.drift && prev.drift) ev.push('driftEnd');
  if (cur.stage > prev.stage) ev.push('spark');
  if (cur.boost && !prev.boost) ev.push('boost');
  if (cur.onWall && !prev.onWall && !cur.airborne && prev.wallQuiet >= WALL_QUIET) ev.push('wall');
  // 着地: もうすぐ着くと分かったときに鳴らす。分からないまま着いたときは、着いたときに鳴らす
  if (cur.landingSoon && !prev.landingSoon) ev.push('land');
  else if (!cur.airborne && prev.airborne && !prev.landingSoon) ev.push('land');
  if (cur.bumps > prev.bumps) ev.push('bump');
  return ev;
}
