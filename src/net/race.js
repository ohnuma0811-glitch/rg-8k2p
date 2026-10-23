// 対戦のレース（設計書 docs/superpowers/specs/2026-10-23-vsrace-design.md の 2〜4章）
// /race = { id（投票の番号）, course, startAt（GO! のサーバーの時刻）, racers: { uid: { name, char, slot } }, cpus: { c0: { char, slot } },
//           host（CPU を動かす端末の uid）, scores: { uid: 点 }, firstGoalAt, karts: { 車: 様子 }, goals: { 車: 秒 | 'quit' } }
// サーバー（db）は引数でもらう（storeOf の形。テストではメモリの作り物）
import { CHARS, charOf, colorOf } from '../data/characters.js';
import { RESULTS_DELAY, ordinal, timeText } from '../game/race.js';
import { markPlayed, startRacing } from './room.js';

export const RACE_KARTS = 5; // 5台に足りない分を CPU で
export const START_DELAY_MS = 8000; // 決めてから GO! まで（コースの準備・スタート前のカメラ・3・2・1）
export const KART_STALE_MS = 3000; // 書いた時刻がこれより古い人の車は、切れたとみなす
export const END_AFTER_FIRST_MS = 180000; // 人の1位のゴールから、これで終わり
export const FINAL_COUNT = 10; // 最後の 10・9・…・1
export const VS_LEVEL = 2; // 対戦の CPU の速さ
export const SPECTATE_HOLD = 2; // 上空カメラは、いちばん遅い車がこの秒数続けて変わったら移る
export const RACE_WAIT_MS = 10000; // /race が来るのを待つ時間

export function cpuCount(humans) {
  return Math.max(0, RACE_KARTS - humans);
}

function shuffled(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// CPU のキャラ: 走る人が選んでいないキャラから（ランダムな順）。足りなければ、選ばれたキャラも（重なってよい）
export function pickVsCpus(taken, n, rand = Math.random) {
  const ids = CHARS.map((c) => c.id);
  const pool = [...shuffled(ids.filter((id) => !taken.includes(id)), rand), ...shuffled(ids.filter((id) => taken.includes(id)), rand)];
  return Array.from({ length: n }, (_, i) => pool[i % pool.length]);
}

// 点数がいちばん高い端末（同じなら uid の小さい方）
export function pickHost(scores) {
  const list = Object.entries(scores ?? {}).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return list.length ? list[0][0] : null;
}

const scoreOf = (s) => (typeof s === 'number' && s >= 0 && s <= 100 ? Math.round(s) : 0);

// /race の中身。走る人（room.racers）で待合室にいる人だけ。人が前（ランダムな順）、CPU が後ろ
export function makeRace(room, players, serverNow, rand = Math.random) {
  const humans = shuffled(players.filter((p) => room.racers?.[p.uid]), rand);
  if (!humans.length) return null;
  const racers = {};
  const scores = {};
  humans.forEach((p, i) => {
    racers[p.uid] = { name: p.name, char: p.char, slot: i };
    scores[p.uid] = scoreOf(p.score);
  });
  const cpus = {};
  pickVsCpus(humans.map((p) => p.char), cpuCount(humans.length), rand).forEach((char, j) => {
    cpus[`c${j}`] = { char, slot: humans.length + j };
  });
  return { id: room.voteId, course: room.course, startAt: Math.round(serverNow) + START_DELAY_MS, racers, cpus, host: pickHost(scores), scores };
}

// 決まったのを見た走る人の端末が呼ぶ。作るのは1回だけ（同じ投票の番号の /race がもうあれば作らない）
export async function createVsRace(db, room, players, serverNow, courseCount, rand = Math.random) {
  const race = makeRace(room, players, serverNow, rand);
  if (!race) return false;
  const made = await db.transaction('race', (cur) => (cur && cur.id === room.voteId ? undefined : race));
  if (made) await markPlayed(db, room.course, courseCount).catch(() => {});
  await startRacing(db, room.voteId).catch(() => {});
  return made;
}

// その投票の番号の /race が来るのを待つ。ms たっても来なければ null
export function waitRace(db, id, ms, timers = { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (id) => clearTimeout(id) }) {
  return new Promise((resolve) => {
    let off = null;
    let done = false;
    let timer = null;
    const end = (v) => {
      if (done) return;
      done = true;
      timers.clearTimeout(timer);
      if (off) off();
      resolve(v);
    };
    timer = timers.setTimeout(() => end(null), ms);
    off = db.watch('race/id', (got) => {
      if (got === id) db.get('race').then(end, () => end(null));
    });
    if (done) off();
  });
}

// 車の並び（slot の順）。CPU の名前はキャラの名前
export function raceLineup(race) {
  const humans = Object.entries(race.racers ?? {}).map(([id, r]) => ({ id, human: true, name: r.name, char: r.char, slot: r.slot }));
  const cpus = Object.entries(race.cpus ?? {}).map(([id, c]) => ({ id, human: false, name: charOf(c.char).name, char: c.char, slot: c.slot }));
  return [...humans, ...cpus].sort((a, b) => a.slot - b.slot);
}

// 切れた車（その時だけの判断）。msg.t は書いた時刻（サーバー）。まだ来ていない車は、スタート + 3秒までは待つ
export function kartGone(msg, now, startAt) {
  if (!msg || typeof msg.t !== 'number') return now > startAt + KART_STALE_MS;
  return now - msg.t > KART_STALE_MS;
}

// 順位（車の id の順）: ゴールのタイム → 進んだ距離 → QUIT と切れた車（その中は進んだ距離の順）。同じなら並びの順
export function vsRanking(lineup, goals, prog, gone) {
  const g = goals ?? {};
  const group = (e) => (typeof g[e.id] === 'number' ? 0 : g[e.id] === 'quit' || gone.has(e.id) ? 2 : 1);
  const p = (e) => (Number.isFinite(prog?.[e.id]) ? prog[e.id] : -Infinity);
  return [...lineup]
    .sort((a, b) => group(a) - group(b) || (group(a) === 0 ? g[a.id] - g[b.id] : 0) || p(b) - p(a) || a.slot - b.slot)
    .map((e) => e.id);
}

// 終わり（どの端末も同じ計算）。humanIds は人の車の id。now はサーバーの時刻
// over: 終わった。countdown: 3分の決まりの最後の10秒（10〜1）、ほかは null
export function raceEnd({ startAt, firstGoalAt }, humanIds, goals, gone, now, runSec = RESULTS_DELAY) {
  const g = goals ?? {};
  const times = humanIds.map((id) => g[id]).filter((v) => typeof v === 'number');
  const first = firstGoalAt ?? (times.length ? startAt + Math.min(...times) * 1000 : null);
  const limitAt = first == null ? Infinity : first + END_AFTER_FIRST_MS;
  const allDone = humanIds.every((id) => g[id] != null || gone.has(id));
  const doneAt = !allDone ? Infinity : times.length ? startAt + (Math.max(...times) + runSec) * 1000 : now;
  const endAt = Math.min(limitAt, doneAt);
  const left = limitAt - now;
  const counting = limitAt <= doneAt && left > 0 && left <= FINAL_COUNT * 1000;
  return { over: now >= endAt, countdown: counting ? Math.ceil(left / 1000) : null };
}

// まだ走っている人の車（CPU は入れない）で、いちばん遅い車の id。いなければ null
export function slowestHuman(lineup, goals, gone, prog) {
  let best = null;
  let bestP = Infinity;
  for (const e of lineup) {
    if (!e.human || goals?.[e.id] != null || gone.has(e.id)) continue;
    const p = Number.isFinite(prog?.[e.id]) ? prog[e.id] : -Infinity;
    if (best === null || p < bestP) {
      best = e.id;
      bestP = p;
    }
  }
  return best;
}

// 上空カメラが追う車。state = { target, cand, wait }。targetRacing: 追っている車がまだ走っているか
export function nextSpectate(state, slowest, targetRacing, dt) {
  if (slowest == null || slowest === state.target) return { target: state.target, cand: null, wait: 0 };
  if (state.target == null || !targetRacing) return { target: slowest, cand: null, wait: 0 };
  const wait = state.cand === slowest ? state.wait + dt : dt;
  if (wait >= SPECTATE_HOLD) return { target: slowest, cand: null, wait: 0 };
  return { target: state.target, cand: slowest, wait };
}

// host を変えるか。host の車が3秒止まった・host が QUIT したら、残っている人（車が止まっていない・QUIT していない）で
// 点数（/race/scores）がいちばん高い uid。変えなくてよい・だれもいないときは null。karts は { 車: 様子 }（t がサーバーの時刻）
export function nextHost(race, karts, goals, now) {
  const cur = race.host;
  if (goals?.[cur] !== 'quit' && !kartGone(karts?.[cur], now, race.startAt)) return null;
  const scores = {};
  for (const uid of Object.keys(race.racers ?? {})) {
    if (uid === cur || goals?.[uid] === 'quit' || kartGone(karts?.[uid], now, race.startAt)) continue;
    scores[uid] = race.scores?.[uid] ?? 0;
  }
  return pickHost(scores);
}

// まだ前の host のときだけ、自分に変える（2台が同時に引き継がない）
export function takeHost(db, oldHost, me) {
  return db.transaction('race/host', (cur) => (cur === oldHost ? me : undefined));
}

// ゴールのタイム（秒）か 'quit'。一度だけ
export function writeGoal(db, id, value) {
  return db.transaction(`race/goals/${id}`, (cur) => (cur == null ? value : undefined));
}

// 人の1位のゴールの時刻（サーバーの時刻）。小さい方だけ
export function setFirstGoal(db, at) {
  return db.transaction('race/firstGoalAt', (cur) => (cur == null || at < cur ? at : undefined));
}

// QUIT: 最下位あつかい（quit）にして、車を消す
export async function quitRace(db, uid) {
  await writeGoal(db, uid, 'quit');
  await db.remove(`race/karts/${uid}`);
}

// 結果の行（順位・顔・名前・タイム）。ゴールしていない車は —
export function vsResultRows(lineup, order, goals, myId) {
  const byId = Object.fromEntries(lineup.map((e) => [e.id, e]));
  return order.map((id, n) => {
    const e = byId[id];
    const g = goals?.[id];
    return { place: ordinal(n + 1), name: e.name, time: typeof g === 'number' ? timeText(g) : '—', face: { color: colorOf(charOf(e.char)), character: e.char }, me: id === myId };
  });
}

// CPU の速さの直し（rubberFactor）でくらべる、人の進んだ距離（まだ走っている人の平均）
export function rubberRef(list) {
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : NaN;
}
