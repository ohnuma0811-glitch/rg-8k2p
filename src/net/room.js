// 部屋の状態と、コースの投票（設計書 docs/superpowers/specs/2026-10-22-lobby-design.md の 2.1・3章）
// /room = { phase: 'lobby' | 'voting' | 'decided', voteId, endsAt, racers: { uid: true }, seed, course, picks }
// /votes/{uid} = { voteId, course }（前の投票の票は voteId で見分けて数えない）
export const VOTE_MS = 10000;

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

export function tally(votes, voteId, seed, courseCount) {
  const counts = Array(courseCount).fill(0);
  for (const v of Object.values(votes ?? {})) if (v && v.voteId === voteId && v.course >= 0 && v.course < courseCount) counts[v.course]++;
  const max = Math.max(...counts);
  const candidates = counts.map((c, i) => i).filter((i) => counts[i] === max);
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
export function decideVote(db, room, votes, courseCount) {
  const { course, count } = tally(votes, room.voteId, room.seed, courseCount);
  return db.transaction('room', (cur) => {
    if (!cur || cur.phase !== 'voting' || cur.voteId !== room.voteId) return undefined;
    return { ...cur, phase: 'decided', course, picks: count };
  });
}

// decided / voting のときだけ lobby に戻す（voteId を渡したら、その投票のときだけ）。lobby や別の投票は触らない
export function resetRoom(db, voteId) {
  return db.transaction('room', (cur) => {
    if (!cur || (cur.phase !== 'decided' && cur.phase !== 'voting')) return undefined;
    if (voteId !== undefined && cur.voteId !== voteId) return undefined;
    return { phase: 'lobby' };
  });
}

// 締め切りから15秒たっても decided / voting のまま（走る人が全員いなくなった・古い状態）なら、止まっている
export const STALE_MS = 15000;
export function roomStale(room, now) {
  return !!room && (room.phase === 'decided' || room.phase === 'voting') && now > room.endsAt + STALE_MS;
}

export function racersLeft(room, players) {
  const r = room?.racers ?? {};
  return players.filter((p) => r[p.uid]).length;
}
