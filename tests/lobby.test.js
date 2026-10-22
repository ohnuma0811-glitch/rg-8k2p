import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enterLobby, leaveLobby, setReady, playersOf } from '../src/net/lobby.js';
import { VOTE_MS, allReady, tally, startVote, castVote, decideVote, racersLeft } from '../src/net/room.js';

// メモリのサーバー（パスで読み書き。transaction も）
function fakeDb() {
  const data = {};
  const calls = [];
  const at = (path, make) => {
    const keys = path.split('/').filter(Boolean);
    let o = data;
    for (const k of keys.slice(0, -1)) o = o[k] ??= {};
    return [o, keys[keys.length - 1]];
  };
  const read = (path) => path.split('/').filter(Boolean).reduce((o, k) => (o == null ? null : o[k] ?? null), data);
  return {
    data, calls,
    SERVER_TIME: 777,
    async get(path) { return JSON.parse(JSON.stringify(read(path))); },
    async set(path, v) { const [o, k] = at(path); o[k] = JSON.parse(JSON.stringify(v)); calls.push(['set', path]); },
    async remove(path) { const [o, k] = at(path); delete o[k]; calls.push(['remove', path]); },
    async onDisconnectRemove(path) { calls.push(['onDisconnectRemove', path]); },
    async transaction(path, fn) { const next = fn(JSON.parse(JSON.stringify(read(path)))); if (next === undefined) return false; const [o, k] = at(path); o[k] = next; return true; },
  };
}
const me = (uid, name) => ({ uid, name, char: 'cat', codeId: 'c1' });

test('だれもいない待合室に入ると、チャットを消して部屋を lobby に戻してから入る。人がいれば消さない', async () => {
  const db = fakeDb();
  db.data.chat = { c1: { k: { text: 'old' } } };
  db.data.room = { phase: 'decided' };
  await enterLobby(db, me('u1', 'KYUGO'));
  assert.equal(db.data.chat.c1, undefined);
  assert.deepEqual(db.data.room, { phase: 'lobby' });
  assert.deepEqual(db.calls.slice(-2), [['onDisconnectRemove', 'lobby/u1'], ['set', 'lobby/u1']]);
  db.data.chat = { c1: { k: { text: 'hi' } } };
  await enterLobby(db, me('u2', 'SOKI'));
  assert.ok(db.data.chat.c1.k, '人がいるときは消さない');
  assert.deepEqual(playersOf(db.data.lobby).map((p) => p.name), ['KYUGO', 'SOKI']);
  await leaveLobby(db, 'u1');
  assert.deepEqual(playersOf(db.data.lobby).map((p) => p.name), ['SOKI']);
});

test('全員 READY（2人以上）で投票が始まる。1人では始まらない', () => {
  const p = (ready) => ({ ready });
  assert.equal(allReady([p(true)]), false);
  assert.equal(allReady([p(true), p(false)]), false);
  assert.equal(allReady([p(true), p(true)]), true);
});

test('投票を始めるのは1回だけ（2台が同時に見ても）', async () => {
  const db = fakeDb();
  db.data.room = { phase: 'lobby' };
  const players = [{ uid: 'u1' }, { uid: 'u2' }];
  assert.equal(await startVote(db, players, 1000, () => 0.5), true);
  assert.equal(await startVote(db, players, 1001, () => 0.9), false);
  assert.equal(db.data.room.phase, 'voting');
  assert.equal(db.data.room.endsAt, 1000 + VOTE_MS);
  assert.deepEqual(db.data.room.racers, { u1: true, u2: true });
});

test('票の数え方: いちばん多い。同じ数ならその中から seed で。だれも選ばなければ全部から。前の投票の票は数えない', () => {
  const v = (voteId, course) => ({ voteId, course });
  assert.deepEqual(tally({ a: v('x', 1), b: v('x', 1), c: v('x', 3) }, 'x', 42, 5), { course: 1, count: 2 });
  const tie = tally({ a: v('x', 1), b: v('x', 3) }, 'x', 42, 5);
  assert.ok([1, 3].includes(tie.course));
  assert.equal(tie.count, 1);
  assert.deepEqual(tally({ a: v('x', 1), b: v('x', 3) }, 'x', 42, 5), tie, '同じ seed なら同じ');
  const none = tally({ a: v('old', 2) }, 'x', 7, 5);
  assert.ok(none.course >= 0 && none.course < 5);
  assert.equal(none.count, 0);
});

test('締め切りを過ぎたら、だれでも決められる（1回だけ）', async () => {
  const db = fakeDb();
  db.data.room = { phase: 'lobby' };
  await startVote(db, [{ uid: 'u1' }, { uid: 'u2' }], 1000, () => 0.25);
  const room = db.data.room;
  await castVote(db, 'u1', room.voteId, 2);
  await castVote(db, 'u2', room.voteId, 2);
  assert.equal(await decideVote(db, room, db.data.votes, 5), true);
  assert.equal(db.data.room.phase, 'decided');
  assert.equal(db.data.room.course, 2);
  assert.equal(db.data.room.picks, 2);
  assert.equal(await decideVote(db, room, db.data.votes, 5), false);
});

test('走る人で、待合室に残っている数（抜けた人は数えない）', () => {
  const room = { racers: { u1: true, u2: true, u3: true } };
  assert.equal(racersLeft(room, [{ uid: 'u1' }, { uid: 'u3' }, { uid: 'u9' }]), 2);
  assert.equal(racersLeft({}, []), 0);
});
