// 部屋の状態と、コースの投票（設計書 docs/superpowers/specs/2026-10-22-lobby-design.md の 2.1・3章）
// /room = { phase: 'lobby' | 'voting' | 'decided' | 'racing', voteId, endsAt, racers: { uid: true }, seed, course, picks }
// /votes/{uid} = { voteId, course }（前の投票の票は voteId で見分けて数えない）
export const VOTE_MS = 10000;
export const READY_WAIT_MS = 20000; // 対戦のスタートで、全員の読みこみを待つ最大の時間（2026-10-23 のユーザー依頼）

export function allReady(players) {
  return players.length >= 2 && players.every((p) => p.ready);
}

// seed から 0〜n-1 の数（全員の端末で同じになる）
function pick(seed, n) {
  let x = (seed >>> 0) || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) % n;
}

// played: 待合室が空になるまでに、このみんなで走ったコース（/played。{ '2': true } か、サーバーから配列で来ることもある）
export function tally(votes, voteId, seed, courseCount, played = null) {
  const counts = Array(courseCount).fill(0);
  for (const v of Object.values(votes ?? {})) if (v && v.voteId === voteId && v.course >= 0 && v.course < courseCount) counts[v.course]++;
  const max = Math.max(...counts);
  const tied = counts.map((c, i) => i).filter((i) => counts[i] === max);
  // 同じ数のときは、まだ走っていないコースを優先。全部走っていれば、並んだ中から（2026-10-23 のユーザー依頼）
  const fresh = tied.filter((i) => played?.[i] !== true);
  const candidates = fresh.length ? fresh : tied;
  const course = candidates[pick(seed, candidates.length)];
  return { course, count: max };
}

// 全員 READY を見た端末が始める。phase が lobby のときだけ（2台が同時でも1回）
export function startVote(db, players, serverNow, rand = Math.random) {
  const voteId = `${serverNow.toString(36)}${Math.floor(rand() * 1e6).toString(36)}`;
  const racers = Object.fromEntries(players.map((p) => [p.uid, true]));
  const seed = Math.floor(rand() * 2 ** 31);
  return db.transaction('room', (cur) => {
    if (cur && cur.phase && cur.phase !== 'lobby') return undefined;
    return { phase: 'voting', voteId, endsAt: serverNow + VOTE_MS, racers, seed };
  });
}

export function castVote(db, uid, voteId, course) {
  return db.set(`votes/${uid}`, { voteId, course });
}

// 締め切りを過ぎたのを見た端末が決める。同じ voteId で voting のときだけ
export function decideVote(db, room, votes, courseCount, played = null) {
  const { course, count } = tally(votes, room.voteId, room.seed, courseCount, played);
  return db.transaction('room', (cur) => {
    if (!cur || cur.phase !== 'voting' || cur.voteId !== room.voteId) return undefined;
    return { ...cur, phase: 'decided', course, picks: count };
  });
}

// decided / voting / racing のときだけ lobby に戻す（voteId を渡したら、その投票のときだけ）。lobby や別の投票は触らない
export function resetRoom(db, voteId) {
  return db.transaction('room', (cur) => {
    if (!cur || (cur.phase !== 'decided' && cur.phase !== 'voting' && cur.phase !== 'racing')) return undefined;
    if (voteId !== undefined && cur.voteId !== voteId) return undefined;
    return { phase: 'lobby' };
  });
}

// 締め切りから15秒たっても decided / voting のまま（走る人が全員いなくなった・古い状態）なら、止まっている
export const STALE_MS = 15000;
export function roomStale(room, now) {
  return !!room && (room.phase === 'decided' || room.phase === 'voting') && now > room.endsAt + STALE_MS;
}

// 対戦のレース（M4-C1）: /race を作ったあと、decided → racing（同じ投票のときだけ）
export function startRacing(db, voteId) {
  return db.transaction('room', (cur) => {
    if (!cur || cur.phase !== 'decided' || cur.voteId !== voteId) return undefined;
    return { ...cur, phase: 'racing' };
  });
}

// レースが始まるときに、走ったコースに足す。5コースそろったら空にして、また最初から数える
export function markPlayed(db, course, courseCount) {
  return db.transaction('played', (cur) => {
    const next = {};
    for (const k of Object.keys(cur ?? {})) if (cur[k] === true) next[k] = true;
    next[String(course)] = true;
    return Object.keys(next).length >= courseCount ? null : next;
  });
}

// racing のまま止まった部屋（待合室のだれでも lobby に戻してよい）。race = { id, startAt, createdAt, racers, goals }（/race から。startAt は全員の読みこみがそろうまで無い）
export const RACE_MAX_MS = 10 * 60 * 1000;
export function racingStale(room, race, players, now) {
  if (!room || room.phase !== 'racing') return false;
  if (!race || race.id !== room.voteId) return now > room.endsAt + STALE_MS; // レースができないまま
  const base = race.startAt ?? (typeof race.createdAt === 'number' ? race.createdAt + READY_WAIT_MS : null); // まだ決まっていなければ、作った時刻 + 待つ時間
  if (base != null && now > base + RACE_MAX_MS) return true;
  const uids = Object.keys(race.racers ?? {});
  if (!uids.length) return false; // まだ読みこんでいない
  const here = new Set(players.map((p) => p.uid));
  const goals = race.goals ?? {};
  // 待合室にいて（切れていない）、まだゴールも QUIT もしていない人が1人もいない
  return !uids.some((uid) => here.has(uid) && goals[uid] == null);
}

export function racersLeft(room, players) {
  const r = room?.racers ?? {};
  return players.filter((p) => r[p.uid]).length;
}
