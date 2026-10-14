// 前と今の様子をくらべて、鳴らす音を決める（音は鳴らさない。テストできるように分けてある）

// 音に関係する様子だけを取り出す。count はカウントの文字（'3' '2' '1' 'GO!' ''）、bumps は自分がぶつかった回数の合計
export function soundState({ count, lap, finished, kart, bumps }) {
  return {
    count,
    lap,
    finished,
    drift: kart.drift.active && !kart.airborne,
    stage: kart.drift.active ? kart.drift.stage : 0,
    boost: kart.boost > 0,
    airborne: kart.airborne,
    onWall: kart.onWall,
    bumps,
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
  if (cur.drift && !prev.drift) ev.push('driftStart');
  if (!cur.drift && prev.drift) ev.push('driftEnd');
  if (cur.stage > prev.stage) ev.push('spark');
  if (cur.boost && !prev.boost) ev.push('boost');
  if (cur.onWall && !prev.onWall && !cur.airborne) ev.push('wall');
  if (!cur.airborne && prev.airborne) ev.push('land');
  if (cur.bumps > prev.bumps) ev.push('bump');
  return ev;
}
