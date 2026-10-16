// レースの決まり: スタートの並び、カウント、スタートダッシュ、周回、順位
import { behind } from './track.js?v=6009f37';
export const LAPS = 3; // 周回
export const COUNTDOWN = 3; // 3, 2, 1 のあと GO（秒）
// ゴールしてから結果の画面を出すまでの秒数（カメラが前に回って顔を映し、そのまま走り続けるのを見せる。7秒から5秒のばした: 2026-10-15 のユーザー依頼）
export const RESULTS_DELAY = 12;
export const COURSE_INTRO = 3; // レースの前に、コースを回って映し、コースの名前を出す秒数
export const DASH_FROM = -0.2; // GO の何秒前から押せばスタートダッシュになるか
export const DASH_TO = 0.05; // GO の何秒後まで押せばスタートダッシュになるか
export const GRID_GAP = 7; // スタートの並びの、前後の間（m）
export const GRID_SIDE = 4.5; // スタートの並びの、左右の間（中心線から、m）

// スタートの並び: 2列に並べる。k 番目の車の { i（点の番号）, lateral（中心線から右へ m） }
export function gridSlot(track, k) {
  const back = 5 + Math.floor(k / 2) * GRID_GAP;
  return { i: behind(track, track.startIndex, back), lateral: k % 2 ? GRID_SIDE : -GRID_SIDE };
}

// t は GO からの秒（カウント中はマイナス）
export function createRace(count) {
  return {
    t: -COUNTDOWN,
    phase: 'countdown', // 'countdown' → 'racing'
    entries: Array.from({ length: count }, () => ({
      lap: 0, // 回り終えた周回の数
      rel: null, // スタートラインから何m進んだか（0〜1周の長さ）
      checkpoint: false, // その周の半分（コースの反対側）を通ったか
      finished: false,
      time: null, // ゴールした時刻（GO からの秒）
      pressedAt: null, // スタートダッシュのボタンを押した時刻
      dashDone: false,
    })),
  };
}

// 時間を進める。GO になったその回だけ true を返す
export function raceTick(race, dt) {
  race.t += dt;
  if (race.phase === 'countdown' && race.t >= 0) {
    race.phase = 'racing';
    return true;
  }
  return false;
}

// 画面の真ん中に出すカウント（'3' '2' '1' 'GO!'、出さないときは ''）
export function countdownText(race) {
  if (race.t < 0) return String(Math.ceil(-race.t));
  return race.t < 1 ? 'GO!' : '';
}

// スタートダッシュのボタン（DRIFT）を押した。最初に押した時刻だけを覚える
export function pressDash(race, k) {
  const e = race.entries[k];
  if (e.pressedAt === null && race.t <= DASH_TO) e.pressedAt = race.t;
}

// スタートダッシュになるかを、GO のあとで1回だけ決める。なるなら true
export function takeDash(race, k) {
  const e = race.entries[k];
  if (e.dashDone || race.t < 0) return false;
  if (e.pressedAt === null && race.t <= DASH_TO) return false; // まだ押すかもしれない
  e.dashDone = true;
  return e.pressedAt !== null && e.pressedAt >= DASH_FROM && e.pressedAt <= DASH_TO;
}

// 車がコースのどこにいるか（点の番号 seg）から、周回を数える
export function updateProgress(race, k, track, seg) {
  const e = race.entries[k];
  if (e.finished) return;
  const L = track.length;
  const start = track.samples[track.startIndex].s;
  const rel = (((track.samples[seg].s - start) % L) + L) % L;
  // その周の半分（コースの反対側）を、前向きに通ったときだけ数える（逆走で戻っても数えない）
  const forward = e.rel !== null && rel >= e.rel && rel - e.rel < 0.1 * L;
  if (forward && rel > 0.4 * L && rel < 0.6 * L) e.checkpoint = true;
  if (e.rel !== null) {
    if (e.rel > 0.8 * L && rel < 0.2 * L && e.checkpoint) {
      // スタートラインを前向きに越えた（その周の半分を通っていれば、1周）
      e.lap += 1;
      e.checkpoint = false;
      if (e.lap >= LAPS) {
        e.finished = true;
        e.time = race.t;
      }
    } else if (e.rel < 0.2 * L && rel > 0.8 * L && e.lap > 0 && !e.checkpoint) {
      // バックでスタートラインを越えて戻った
      e.lap -= 1;
      e.checkpoint = true;
    }
  }
  e.rel = rel;
}

// 進んだ距離（順位を決める。スタートラインの手前はマイナス）
export function progress(race, k, track) {
  const e = race.entries[k];
  const L = track.length;
  if (e.rel === null) return -Infinity;
  const rel = e.checkpoint || e.rel < L / 2 ? e.rel : e.rel - L;
  return e.lap * L + rel;
}

// 順位の順に並べた車の番号（ゴールした車はゴールした順、まだの車は進んだ距離の順）
export function ranking(race, track) {
  return race.entries
    .map((e, k) => k)
    .sort((a, b) => {
      const ea = race.entries[a];
      const eb = race.entries[b];
      if (ea.finished && eb.finished) return ea.time - eb.time;
      if (ea.finished) return -1;
      if (eb.finished) return 1;
      return progress(race, b, track) - progress(race, a, track);
    });
}

// レースのポイント（1位から。2026-10-14 のユーザー依頼）。5台のレースなら5位は4ポイント
const POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
export function racePoints(place) {
  return POINTS[place - 1] ?? 0;
}

// 1st, 2nd, 3rd, 4th ...
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// 0:23.45
export function timeText(sec) {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}
