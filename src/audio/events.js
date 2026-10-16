// 前と今の様子をくらべて、鳴らす音を決める（音は鳴らさない。テストできるように分けてある）
import { locate } from '../game/track.js';

// ジャンプの着地の音は、地面（高さ 0）に着くこの秒数前に鳴らし始める
// （スマホは音を出すまでに少し遅れるので、着いてから鳴らすと遅れて聞こえた: 2026-10-15 の実機確認）
export const LAND_LEAD = 0.08;
// 壁の音は、この秒数以上壁から離れていたあとにぶつかったときだけ鳴らす
// （壁にこすりながら走ると、ついたり離れたりをくり返して鳴り続けた: 2026-10-15 の実機確認）
export const WALL_QUIET = 0.5;
// ジャンプ台で叫ぶ声は、飛び出すこの秒数前に鳴らし始める（2026-10-15 の実機確認「飛び出す直前くらいに」）
export const JUMP_LEAD = 0.3;

// もうすぐジャンプ台から飛び出す（いまの速さのまま JUMP_LEAD 秒進んだ所に地面がない）
export function jumpAhead(track, kart, lead = JUMP_LEAD) {
  if (kart.airborne || !(kart.speed > 0)) return false;
  // 逆走で、着地する側のふちへ向かっているときは飛ばない（ふちで止まる）ので鳴らさない
  const here = locate(track, kart.x, kart.z, kart.seg);
  if (Math.cos(kart.move - here.heading) <= 0) return false;
  const d = kart.speed * lead;
  return locate(track, kart.x + Math.cos(kart.move) * d, kart.z + Math.sin(kart.move) * d, kart.seg).ground === null;
}

// 音に関係する様子だけを取り出す。count はカウントの文字（'3' '2' '1' 'GO!' ''）、bumps は自分がぶつかった回数の合計
// wallQuiet: 壁から離れている秒数（前のフレームまで）
// jumpSoon: もうすぐジャンプ台から飛び出す（jumpAhead で調べたもの）
export function soundState({ count, lap, finished, kart, bumps, wallQuiet = Infinity, jumpSoon = false, bumpWarn = false, busNear = false, boarWarn = false, monkeyThrows = 0, dinoRoar = false }) {
  return {
    count,
    lap,
    finished,
    drift: kart.drift.active && !kart.airborne,
    stage: kart.drift.active ? kart.drift.stage : 0,
    boost: kart.boost > 0,
    airborne: kart.airborne,
    rampJump: !!kart.airborne && !!kart.launched, // ジャンプ台から飛び出して空中にいる（坂の頂上で浮いたときは false）
    // もうすぐ着地する（落ちている途中で、いまの速さのままなら LAND_LEAD 秒以内に高さ 0 に着く）
    landingSoon: !!kart.airborne && (kart.vy || 0) < 0 && (kart.y || 0) / -kart.vy <= LAND_LEAD,
    hop: (kart.hop || 0) > 0, // ドリフトのボタンで跳ねている
    onWall: kart.onWall,
    bumps,
    wallQuiet,
    jumpSoon,
    hump: (kart.hump || 0) > 0, // バンプを乗り越えている
    tumble: (kart.tumble || 0) > 0, // バンプで転がっている
    cowHits: kart.cowHits || 0, // 牛にぶつかった回数
    bumpWarn, // バンプの警告を出している
    busNear, // スクールバスが近い（すれちがう）
    busHits: kart.busHits || 0, // スクールバスにぶつかった回数
    boarWarn, // 近くのイノシシが、飛び出す前（しげみがゆれている）
    boarHits: kart.boarHits || 0, // イノシシにぶつかった回数
    monkeyThrows, // 近くのサルが投げた数の合計
    nutHits: kart.nutHits || 0, // 木の実が当たった回数
    eaten: kart.eaten || 0, // 恐竜に食べられた回数
    mudHits: kart.mudHits || 0, // ぬかるみに入った回数
    dinoRoar, // 近くの恐竜が、川から上がってきている
  };
}

// ゴールしたときの音（順位で変える。2026-10-15 のユーザー依頼）: 1〜3位は明るく、4位以下はちょっと悲しく
export function finishMusic(place) {
  return place <= 3 ? { sfx: 'finish', song: 'victory' } : { sfx: 'finishSad', song: 'consolation' };
}

// 一時停止で鳴りつづける音（ドリフトのキュルキュル）を止めたあとの「前の様子」。ドリフトしていないことにして、
// つづけたとき、まだドリフトしていれば driftStart でまた鳴らす（M5 のレビュー: つづけたあと鳴らなかった）
export function afterPause(state) {
  return state && { ...state, drift: false };
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
  if (cur.hump && !prev.hump) ev.push('hump');
  if (cur.tumble && !prev.tumble) ev.push('tumble');
  if (cur.cowHits > prev.cowHits) ev.push('moo');
  if (cur.bumpWarn && !prev.bumpWarn) ev.push('bumpWarn');
  if (cur.busNear && !prev.busNear) ev.push('busPass');
  if (cur.busHits > prev.busHits) ev.push('busHit');
  if (cur.boarWarn && !prev.boarWarn) ev.push('boarWarn');
  if (cur.boarHits > prev.boarHits) ev.push('bump');
  if (cur.monkeyThrows > prev.monkeyThrows) ev.push('monkey');
  if (cur.nutHits > prev.nutHits) ev.push('nutHit');
  if (cur.eaten > prev.eaten) ev.push('eaten');
  if (cur.mudHits > prev.mudHits) ev.push('mudSlip');
  if (cur.dinoRoar && !prev.dinoRoar) ev.push('dinoRoar');
  // ジャンプ台の声: もうすぐ飛び出すと分かったときに鳴らす。分からないまま飛び出したときは、飛び出したときに鳴らす
  // （ドリフトの跳ねは airborne にならない）
  if (cur.jumpSoon && !prev.jumpSoon) ev.push('jump');
  else if (cur.rampJump && !prev.rampJump && !prev.jumpSoon) ev.push('jump'); // ジャンプ台の時だけ（2026-10-16 のユーザー依頼）
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
