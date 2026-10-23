import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

let env;
const GM = 'gm-test';
before(async () => {
  const rules = readFileSync('database.rules.json', 'utf8').replaceAll('GM_UID_HERE', GM);
  env = await initializeTestEnvironment({ projectId: 'demo-race', database: { rules, host: '127.0.0.1', port: 9000 } });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled((c) => c.database().ref().set({
    secret: { code: '0811', codeId: 'c1', active: true },
    status: { codeId: 'c1', active: true },
  }));
});
const as = (uid) => env.authenticatedContext(uid).database();
const attempt = (count, guess, codeId = 'c1') => ({ codeId, count, guess, device: 'PC', at: 1 });

test('遊ぶ人は /secret を読めない。/status は読める', async () => {
  await assertFails(as('u1').ref('secret').once('value'));
  await assertSucceeds(as('u1').ref('status').once('value'));
});

test('正しいコードを試した端末だけ /access を書ける', async () => {
  const db = as('u1');
  await assertSucceeds(db.ref('attempts/u1').set(attempt(1, '1111')));
  await assertFails(db.ref('access/u1').set({ codeId: 'c1', name: '', at: 1 }));
  await assertSucceeds(db.ref('attempts/u1').set(attempt(2, '0811')));
  await assertSucceeds(db.ref('access/u1').set({ codeId: 'c1', name: '', at: 1 }));
  await assertSucceeds(db.ref('access/u1/name').set('KYUGO'));
  await assertFails(db.ref('access/u1/name').set('kyugo'));
});

test('回数は1ずつしか増やせず、5回まで。消して数え直すこともできない', async () => {
  const db = as('u1');
  await assertFails(db.ref('attempts/u1').set(attempt(2, '1111')), '1回目は1から');
  for (let n = 1; n <= 5; n++) await assertSucceeds(db.ref('attempts/u1').set(attempt(n, '1111')));
  await assertFails(db.ref('attempts/u1').set(attempt(6, '0811')));
  await assertFails(db.ref('attempts/u1').remove());
  await assertFails(db.ref('attempts/u1').set(attempt(5, '0811')), '同じ回数のまま書きかえられない');
});

test('ほかの人の /attempts /access は書けない', async () => {
  await assertSucceeds(as('u1').ref('attempts/u1').set(attempt(1, '0811')));
  await assertFails(as('u2').ref('attempts/u1').set(attempt(2, '0811')));
  await assertFails(as('u2').ref('access/u1').set({ codeId: 'c1', name: '', at: 1 }));
});

test('コードが止まっているときは、正しくても /access を書けない', async () => {
  await env.withSecurityRulesDisabled((c) => c.database().ref('secret/active').set(false));
  await assertSucceeds(as('u1').ref('attempts/u1').set(attempt(1, '0811')));
  await assertFails(as('u1').ref('access/u1').set({ codeId: 'c1', name: '', at: 1 }));
});

test('コードが変わったら、回数は1から（前の回数を引きつがない）', async () => {
  for (let n = 1; n <= 5; n++) await assertSucceeds(as('u1').ref('attempts/u1').set(attempt(n, '1111')));
  await env.withSecurityRulesDisabled((c) => c.database().ref().update({ 'secret/code': '4321', 'secret/codeId': 'c2', 'status/codeId': 'c2' }));
  await assertSucceeds(as('u1').ref('attempts/u1').set(attempt(1, '4321', 'c2')));
  await assertSucceeds(as('u1').ref('access/u1').set({ codeId: 'c2', name: '', at: 1 }));
});

test('GM だけがコード・上限を書け、Unlock（/attempts を消す）・Players を読める', async () => {
  await assertFails(as('u1').ref('secret').set({ code: '1234', codeId: 'x', active: true }));
  await assertFails(as('u1').ref('status').set({ codeId: 'x', active: true }));
  await assertFails(as('u1').ref('limits/KYUGO').set(60));
  await assertSucceeds(as(GM).ref('secret').set({ code: '1234', codeId: 'c3', active: true }));
  await assertSucceeds(as(GM).ref('status').set({ codeId: 'c3', active: true }));
  await assertSucceeds(as(GM).ref('limits/KYUGO').set(30));
  await assertFails(as(GM).ref('limits/KYUGO').set(500), '5〜120分');
  await assertFails(as(GM).ref('secret/code').set('12a4'), '4けたの数字');
  await assertSucceeds(as('u1').ref('attempts/u1').set(attempt(1, '0000', 'c3')));
  await assertSucceeds(as(GM).ref('attempts/u1').remove());
  await assertSucceeds(as(GM).ref('access').once('value'));
  await assertFails(as('u1').ref('access').once('value'));
});

test('遊んだ時間: 入ったことのある端末は、自分の uid の下だけ、増やすだけ。GM が reset を書く。だれでも読める', async () => {
  const day = 'playtime/KYUGO/2026-10-22';
  await assertFails(as('u1').ref(`${day}/u1`).set(60), 'まだ入っていない');
  await assertSucceeds(as('u1').ref('attempts/u1').set(attempt(1, '0811')));
  await assertSucceeds(as('u1').ref('access/u1').set({ codeId: 'c1', name: 'KYUGO', at: 1 }));
  await assertSucceeds(as('u1').ref(`${day}/u1`).set(60));
  await assertSucceeds(as('u1').ref(`${day}/u1`).set(60), '同じ数字を何度送ってもよい');
  await assertSucceeds(as('u1').ref(`${day}/u1`).set(65));
  await assertFails(as('u1').ref(`${day}/u1`).set(10), '減らせない');
  await assertFails(as('u1').ref(`${day}/u1`).set(86401), '上限');
  await assertFails(as('u1').ref(`${day}/u1`).set('x'), '数字だけ');
  await assertFails(as('u1').ref(`${day}/u2`).set(10), '他の端末の分は書けない');
  await assertFails(as('u1').ref(`${day}/reset`).set(1), 'reset は GM だけ');
  await assertFails(as('u1').ref(day).set({ u1: 1 }), '日のまとまりは GM だけ');
  await assertFails(as('u1').ref('playtime/kyugo/2026-10-22/u1').set(70), '名前は大文字');
  await assertFails(as('u1').ref('playtime/KYUGO/xxxx/u1').set(70), '日付の形');
  await assertSucceeds(as(GM).ref(day).set({ reset: 1234567890 }));
  const snap = await as('u1').ref(day).once('value');
  assert.deepEqual(snap.val(), { reset: 1234567890 }, 'GM のリセットで各端末の分は消える');
  await assertSucceeds(as('u1').ref(`${day}/u1`).set(5), 'リセット後は 0 から増やせる');
  await assertSucceeds(env.unauthenticatedContext().database().ref(day).once('value'));
  await assertSucceeds(env.unauthenticatedContext().database().ref('limits').once('value'));
});

test('遊んだ時間: 入ったことのある別の端末（u1）は、u2 の分を書けない', async () => {
  const day = 'playtime/KYUGO/2026-10-22';
  await assertSucceeds(as('u1').ref('attempts/u1').set(attempt(1, '0811')));
  await assertSucceeds(as('u1').ref('access/u1').set({ codeId: 'c1', name: 'KYUGO', at: 1 }));
  await assertFails(as('u1').ref(`${day}/u2`).set(86400));
});

// 入っている端末を作る
async function member(uid, name = 'KYUGO') {
  await as(uid).ref(`attempts/${uid}`).set(attempt(1, '0811'));
  await as(uid).ref(`access/${uid}`).set({ codeId: 'c1', name, at: 1 });
}
const NOW = { '.sv': 'timestamp' };
const lobbyEntry = (name = 'KYUGO') => ({ name, char: 'cat', codeId: 'c1', ready: false, at: NOW });
const message = (uid, extra = { text: 'hi' }, name = 'KYUGO') => ({ uid, name, char: 'cat', ...extra, at: NOW });

test('待合室: 入っている端末だけが読み、自分の分だけ書く・消す', async () => {
  await assertFails(as('u1').ref('lobby').once('value'));
  await assertFails(as('u1').ref('lobby/u1').set(lobbyEntry()));
  await member('u1');
  await member('u2');
  await assertSucceeds(as('u1').ref('lobby/u1').set(lobbyEntry()));
  await assertSucceeds(as('u1').ref('lobby/u1/ready').set(true));
  await assertFails(as('u2').ref('lobby/u1/ready').set(false));
  await assertSucceeds(as('u2').ref('lobby').once('value'));
  await assertFails(as('u1').ref('lobby/u1/char').set('mario'));
  await assertSucceeds(as('u1').ref('lobby/u1').remove());
  await assertSucceeds(as(GM).ref('lobby').once('value'));
});

test('チャット: 自分の名前で、1秒に1回、新しく足すだけ。人がいるときは消せない', async () => {
  await member('u1');
  await member('u2');
  const db = as('u1');
  await assertSucceeds(db.ref().update({ 'chat/c1/m1': message('u1'), 'chatLast/u1': { at: NOW, key: 'm1' } }));
  await assertFails(db.ref().update({ 'chat/c1/m2': message('u1'), 'chatLast/u1': { at: NOW, key: 'm2' } }), '1秒たっていない');
  await assertFails(db.ref().update({ 'chat/c1/m3': message('u2'), 'chatLast/u1': { at: NOW, key: 'm3' } }), 'ほかの人の uid');
  await assertFails(db.ref('chat/c1/m4').set(message('u1')), 'chatLast を一緒に書かない');
  await assertFails(db.ref('chat/c1/m1/preset').set(5), '書き直せない');
  await assertSucceeds(as('u1').ref('lobby/u1').set(lobbyEntry()));
  await assertFails(as('u2').ref('chat/c1').remove(), '人がいるときは消せない');
  await assertSucceeds(as('u2').ref('chat/c1').once('value'));
  await assertFails(as('u3').ref('chat/c1').once('value'), '入っていない端末は読めない');
});

test('チャット: 中身の決まり（preset か text のどちらか1つ、text は 1〜100文字、前のコードには送れない）', async () => {
  await member('u1');
  const send = (key, extra) => as('u1').ref().update({ [`chat/c1/${key}`]: message('u1', extra), 'chatLast/u1': { at: NOW, key } });
  await assertFails(send('a', { preset: 0, text: 'x' }));
  await assertFails(send('b', { text: 'a'.repeat(101) }));
  await assertFails(send('c', { preset: 13 }));
  await assertFails(as('u1').ref().update({ 'chat/c0/d': message('u1'), 'chatLast/u1': { at: NOW, key: 'd' } }));
  await assertSucceeds(send('e', { text: 'a'.repeat(100) }));
});

test('チャット: だれもいなければ、入っている端末が消せる。GM はいつでも消せる', async () => {
  await member('u1');
  await assertSucceeds(as('u1').ref().update({ 'chat/c1/m1': message('u1'), 'chatLast/u1': { at: NOW, key: 'm1' } }));
  await assertSucceeds(as('u1').ref('chat/c1').remove());
  await env.withSecurityRulesDisabled((c) => c.database().ref('chat/c1/m2').set({ uid: 'u1', name: 'A', char: 'cat', preset: 1, at: 1 }));
  await env.withSecurityRulesDisabled((c) => c.database().ref('lobby/u9').set({ name: 'X', char: 'cat', codeId: 'c1', ready: false, at: 1 }));
  await assertSucceeds(as(GM).ref('chat/c1/m2').remove());
});

test('部屋と票: 入っている端末が部屋を読み書き。票は自分の分だけ、投票中で、走る人で、締め切りの前', async () => {
  await member('u1');
  await member('u2');
  await assertSucceeds(as('u1').ref('lobby/u1').set(lobbyEntry()));
  await assertFails(as('u3').ref('room').once('value'));
  await assertSucceeds(as('u1').ref('room').set({ phase: 'voting', voteId: 'v1', endsAt: Date.now() + 10000, racers: { u1: true }, seed: 1 }));
  await assertSucceeds(as('u1').ref('votes/u1').set({ voteId: 'v1', course: 2 }));
  await assertFails(as('u1').ref('votes/u2').set({ voteId: 'v1', course: 2 }), 'ほかの人の票');
  await assertFails(as('u2').ref('votes/u2').set({ voteId: 'v1', course: 2 }), '走る人でない');
  await assertFails(as('u1').ref('votes/u1').set({ voteId: 'v1', course: 9 }), 'コースの番号');
  await env.withSecurityRulesDisabled((c) => c.database().ref('room/endsAt').set(Date.now() - 1000));
  await assertFails(as('u1').ref('votes/u1').set({ voteId: 'v1', course: 1 }), '締め切りのあと');
  await assertFails(as('u1').ref('room').set({ phase: 'party' }));
});

test('部屋の順番: lobby → voting（10秒・走る人は待合室にいる人）→ decided（締め切りのあと・中身はそのまま）→ lobby。消せるのは GM だけ', async () => {
  await member('u1');
  await member('u2');
  await assertSucceeds(as('u1').ref('lobby/u1').set(lobbyEntry()));
  await assertSucceeds(as('u2').ref('lobby/u2').set(lobbyEntry()));
  const endsAt = Date.now() + 10000;
  const voting = (extra = {}) => ({ phase: 'voting', voteId: 'v1', endsAt, racers: { u1: true, u2: true }, seed: 1, ...extra });
  const decided = (extra = {}) => ({ ...voting(), phase: 'decided', course: 2, picks: 1, ...extra });
  await assertFails(as('u1').ref('room').set({ phase: 'decided', course: 3, picks: 99 }), '投票なしで決める');
  await assertFails(as('u1').ref('room').set(voting({ endsAt: Date.now() + 1e10 })), '締め切りが遠い');
  await assertFails(as('u1').ref('room').set(voting({ endsAt: Date.now() + 1000 })), '締め切りが近い');
  await assertFails(as('u1').ref('room').set(voting({ racers: { u9: true } })), '待合室にいない人');
  await assertFails(as('u1').ref('room').set(voting({ racers: null })), '走る人がいない');
  await assertSucceeds(as('u1').ref('room').set(voting()));
  await assertFails(as('u2').ref('room').set(voting({ endsAt: Date.now() + 10500 })), '投票中に投票を上書き（締め切りをのばす）');
  await assertFails(as('u2').ref('room/racers').remove(), '投票中に走る人を消す');
  await assertFails(as('u2').ref('room').set(decided()), '締め切りの前に決める');
  await assertFails(as('u2').ref('room').remove(), '部屋を消す');
  await env.withSecurityRulesDisabled((c) => c.database().ref('room/endsAt').set(Date.now() - 1000));
  const late = Date.now() - 1000;
  await assertFails(as('u2').ref('room').set(decided({ endsAt: late, voteId: 'v2' })), 'voteId を変える');
  await assertFails(as('u2').ref('room').set(decided({ endsAt: late + 5, course: 7 })), 'endsAt を変える・コースの番号');
  await assertFails(as('u2').ref('room').set(decided({ endsAt: late, racers: null })), '走る人を消して決める');
  await env.withSecurityRulesDisabled((c) => c.database().ref('room/endsAt').set(late));
  await assertSucceeds(as('u2').ref('room').set(decided({ endsAt: late })), '締め切りのあと');
  await assertFails(as('u2').ref('room').set(voting({ voteId: 'v3' })), 'decided から voting には行けない');
  await assertSucceeds(as('u1').ref('room').set({ phase: 'lobby' }));
  await assertSucceeds(as('u1').ref('room').set({ phase: 'lobby' }));
  await assertFails(as('u1').ref('room').set({ phase: 'lobby', course: 1 }), 'lobby に余計な値');
  await assertSucceeds(as(GM).ref('room').set(decided()), 'GM は何でも');
  await assertSucceeds(as(GM).ref('room').remove(), 'GM は消せる');
});

test('チャット: 定型文は2秒に1回（自由な文は1秒）', async () => {
  await member('u1');
  await env.withSecurityRulesDisabled((c) => c.database().ref('chatLast/u1').set({ at: Date.now() - 1500, key: 'old' }));
  await assertFails(as('u1').ref().update({ 'chat/c1/p1': message('u1', { preset: 3 }), 'chatLast/u1': { at: NOW, key: 'p1', preset: 3 } }), '1.5秒では定型文は送れない');
  await assertSucceeds(as('u1').ref().update({ 'chat/c1/t1': message('u1', { text: 'hi' }), 'chatLast/u1': { at: NOW, key: 't1' } }), '1.5秒なら自由な文は送れる');
});

test('チャット: 1回の書き込みで通るメッセージは1件だけ（chatLast の key と合うものだけ）', async () => {
  await member('u1');
  const two = { 'chat/c1/a1': message('u1'), 'chat/c1/a2': message('u1'), 'chatLast/u1': { at: NOW, key: 'a1' } };
  await assertFails(as('u1').ref().update(two), '2件を1回で');
  await assertFails(as('u1').ref().update({ 'chat/c1/b1': message('u1'), 'chatLast/u1': { at: NOW, key: 'zzz' } }), 'key がちがう');
  await assertFails(as('u1').ref().update({ 'chat/c1/b1': message('u1'), 'chatLast/u1': { at: NOW } }), 'key がない');
  await assertSucceeds(as('u1').ref().update({ 'chat/c1/c1': message('u1'), 'chatLast/u1': { at: NOW, key: 'c1' } }), '1件');
});

test('なりすまし: 待合室・チャットの名前は access の名前と同じ。キャラは決まった id、文は空白だけではだめ', async () => {
  await member('u1');
  await assertFails(as('u1').ref('lobby/u1').set(lobbyEntry('SOKI')), 'access とちがう名前で待合室');
  await assertSucceeds(as('u1').ref('lobby/u1').set(lobbyEntry('KYUGO')));
  const send = (key, msg) => as('u1').ref().update({ [`chat/c1/${key}`]: msg, 'chatLast/u1': { at: NOW, key } });
  await assertFails(send('a', message('u1', { preset: 0 }, 'SOKI')), 'ほかの子の名前でチャット');
  await assertFails(send('b', { ...message('u1'), char: 'constructor' }), 'キャラの id');
  await assertFails(send('c', message('u1', { text: '   ' })), '空白だけ');
  await assertSucceeds(send('d', message('u1', { text: ' hi ' })));
});

test('チャット: 同じ定型文を2回続けては送れない（2026-10-22 のユーザー依頼）', async () => {
  await member('u1');
  const send = (key, extra, last) => as('u1').ref().update({ [`chat/c1/${key}`]: message('u1', extra), 'chatLast/u1': { at: NOW, key, ...last } });
  const ago = (preset) => env.withSecurityRulesDisabled((c) => c.database().ref('chatLast/u1').set({ at: Date.now() - 5000, key: 'old', ...(preset == null ? {} : { preset }) }));
  await ago(3);
  await assertFails(send('a', { preset: 3 }, { preset: 3 }), '前と同じ定型文');
  await assertFails(send('b', { preset: 4 }, {}), 'chatLast に定型文の番号がない');
  await assertFails(send('c', { preset: 4 }, { preset: 5 }), 'chatLast の番号がちがう');
  await assertSucceeds(send('d', { preset: 4 }, { preset: 4 }), 'ちがう定型文');
  await ago(3);
  await assertSucceeds(send('e', { text: 'hi' }, {}), '自由な文');
  await ago(null);
  await assertSucceeds(send('f', { preset: 3 }, { preset: 3 }), 'あいだに自由な文があれば同じ定型文も送れる');
});

// ---- 対戦のレース（M4-C1） ----
const disabled = (fn) => env.withSecurityRulesDisabled((c) => fn(c.database()));
const raceEnds = Date.now() - 1000; // 投票の締め切り（racing へ行くとき、ルールが「変わっていないか」をくらべるので、どの部屋も同じ値）
const decidedRoom = (extra = {}) => ({ phase: 'decided', voteId: 'v1', endsAt: raceEnds, seed: 1, racers: { u1: true, u2: true }, course: 2, picks: 1, ...extra });
const raceData = (extra = {}) => ({
  id: 'v1',
  course: 2,
  startAt: Date.now() + 8000,
  racers: { u1: { name: 'KYUGO', char: 'cat', slot: 0 }, u2: { name: 'SOKI', char: 'tiger', slot: 1 } },
  cpus: { c0: { char: 'kyugo', slot: 2 }, c1: { char: 'soki', slot: 3 }, c2: { char: 'mouse', slot: 4 } },
  host: 'u1',
  scores: { u1: 80, u2: 60 },
  ...extra,
});
const kartMsg = (extra = {}) => ({ x: 1, y: 0, z: 2, h: 0, m: 0, v: 10, i: 3, l: 0, c: 0, at: Date.now(), t: NOW, ...extra });
// u1（KYUGO）と u2（SOKI）が走っているレース
async function racing() {
  await member('u1', 'KYUGO');
  await member('u2', 'SOKI');
  await disabled((db) => db.ref().update({ room: decidedRoom({ phase: 'racing' }), race: raceData() }));
}

test('対戦のレース: /race を作れるのは、部屋が decided のときに、その投票の番号で1回だけ', async () => {
  await member('u1', 'KYUGO');
  await member('u2', 'SOKI');
  await assertFails(as('u1').ref('race').set(raceData()), '部屋が decided でない');
  await disabled((db) => db.ref('room').set(decidedRoom()));
  await assertFails(as('u3').ref('race').set(raceData()), '入っていない端末');
  await assertFails(as('u1').ref('race').set(raceData({ id: 'v9' })), '投票の番号がちがう');
  await assertFails(as('u1').ref('race').set(raceData({ startAt: Date.now() + 60000 })), 'スタートが遠すぎる');
  await assertFails(as('u1').ref('race').set(raceData({ startAt: Date.now() })), 'スタートが近すぎる');
  await assertFails(as('u1').ref('race').set(raceData({ course: 4 })), '決まったコースとちがう');
  await assertFails(as('u1').ref('race').set(raceData({ racers: { u1: { name: 'KYUGO', char: 'cat', slot: 0 }, u9: { name: 'KYUGO', char: 'cat', slot: 1 } } })), '走る人でない');
  await assertFails(as('u1').ref('race').set(raceData({ racers: { u1: { name: 'SOKI', char: 'cat', slot: 0 } } })), 'ほかの子の名前');
  await assertFails(as('u1').ref('race').set(raceData({ host: 'u9' })), 'host が走る人でない');
  await assertFails(as('u1').ref('race').set(raceData({ cpus: { x9: { char: 'cat', slot: 2 } } })), 'CPU の名前は c0〜c7');
  await assertFails(as('u1').ref('race').set(raceData({ goals: { u1: 1 } })), 'ゴールを先に書く');
  await assertFails(as('u1').ref('race').set(raceData({ party: true })), '知らない中身');
  await assertSucceeds(as('u1').ref('race').set(raceData()));
  await assertFails(as('u2').ref('race').set(raceData()), '同じ番号で作り直す');
  await assertSucceeds(as('u2').ref('race').once('value'));
  await assertFails(as('u3').ref('race').once('value'), '入っていない端末は読めない');
  await assertSucceeds(as(GM).ref('race').once('value'));
  await assertSucceeds(as(GM).ref('race').remove());
});

test('部屋: decided → racing は、/race がその投票のレースのときだけ。racing → lobby', async () => {
  await member('u1', 'KYUGO');
  await member('u2', 'SOKI');
  await disabled((db) => db.ref('room').set(decidedRoom()));
  await assertFails(as('u1').ref('room').set(decidedRoom({ phase: 'racing' })), '/race がまだない');
  await disabled((db) => db.ref('race').set(raceData({ id: 'v0' })));
  await assertFails(as('u1').ref('room').set(decidedRoom({ phase: 'racing' })), '前のレース');
  await disabled((db) => db.ref('race').set(raceData()));
  await assertFails(as('u1').ref('room').set(decidedRoom({ phase: 'racing', course: 3 })), 'コースを変える');
  await assertSucceeds(as('u1').ref('room').set(decidedRoom({ phase: 'racing' })));
  await assertFails(as('u1').ref('room').set(decidedRoom({ phase: 'racing' })), 'racing → racing');
  await assertFails(as('u1').ref('race').set(raceData({ id: 'v2' })), 'racing の間は /race を作り直せない');
  await assertSucceeds(as('u2').ref('room').set({ phase: 'lobby' }));
});

test('車の様子: 人の車は本人だけ、CPU の車は host だけ。時刻はサーバーの時刻、中身は数だけ', async () => {
  await racing();
  await assertSucceeds(as('u1').ref('race/karts/u1').set(kartMsg()));
  await assertFails(as('u2').ref('race/karts/u1').set(kartMsg()), 'ほかの人の車');
  await assertSucceeds(as('u1').ref('race/karts').update({ u1: kartMsg(), c0: kartMsg(), c1: kartMsg(), c2: kartMsg() }), 'host は自分と CPU を1回で');
  await assertFails(as('u2').ref('race/karts/c0').set(kartMsg()), 'host でない');
  await assertFails(as('u1').ref('race/karts/c7').set(kartMsg()), 'いない CPU');
  await assertFails(as('u1').ref('race/karts/u1').set(kartMsg({ t: 123 })), 'サーバーの時刻でない');
  await assertFails(as('u1').ref('race/karts/u1').set(kartMsg({ x: null })), '位置がない');
  await assertFails(as('u1').ref('race/karts/u1').set(kartMsg({ name: 'x' })), '数でない');
  await assertFails(as('u3').ref('race/karts/u3').set(kartMsg()), '入っていない端末');
  await assertSucceeds(as('u2').ref('race/karts/u2').set(kartMsg()));
  await assertSucceeds(as('u2').ref('race/karts/u2').remove(), 'QUIT で消す');
});

test('ゴール: 人は本人、CPU は host。一度書いたら書きかえ・消すはできない。タイムか quit', async () => {
  await racing();
  await assertSucceeds(as('u1').ref('race/goals/u1').set(83.25));
  await assertFails(as('u1').ref('race/goals/u1').set(80), '書きかえ');
  await assertFails(as('u1').ref('race/goals/u1').remove(), '消す');
  await assertFails(as('u1').ref('race/goals/u2').set(70), 'ほかの人');
  await assertFails(as('u2').ref('race/goals/u2').set('win'), 'タイムか quit だけ');
  await assertFails(as('u2').ref('race/goals/u2').set(-1), 'マイナス');
  await assertSucceeds(as('u2').ref('race/goals/u2').set('quit'));
  await assertFails(as('u2').ref('race/goals/c0').set(90), 'host でない');
  await assertSucceeds(as('u1').ref('race/goals/c0').set(90));
});

test('CPU の host の引き継ぎ: host の車が3秒止まったときだけ、走る人が自分に変えられる', async () => {
  await racing();
  await assertFails(as('u2').ref('race/host').set('u2'), 'スタートの前で、host の車がまだない');
  await disabled((db) => db.ref('race/karts/u1').set({ ...kartMsg(), t: Date.now() }));
  await assertFails(as('u2').ref('race/host').set('u2'), 'host は動いている');
  await disabled((db) => db.ref('race/karts/u1/t').set(Date.now() - 5000));
  await assertFails(as('u2').ref('race/host').set('u1'), '自分以外に');
  await member('u3', 'MOMO');
  await assertFails(as('u3').ref('race/host').set('u3'), '走る人でない');
  await assertSucceeds(as('u2').ref('race/host').set('u2'));
  await assertSucceeds(as('u2').ref('race/karts/c0').set(kartMsg()), '引き継いだら CPU を書ける');
  await assertFails(as('u1').ref('race/karts/c0').set(kartMsg()), '前の host はもう書けない');
});

test('CPU の host の引き継ぎ: host の車がなくなった（QUIT）ら、スタート + 3秒のあとは変えられる', async () => {
  await racing();
  await disabled((db) => db.ref('race/startAt').set(Date.now() - 10000));
  await assertSucceeds(as('u2').ref('race/host').set('u2'));
});

test('最初のゴールの時刻は、走る人が、小さくする向きにだけ書ける', async () => {
  await racing();
  const startAt = (await as('u1').ref('race/startAt').once('value')).val();
  await assertSucceeds(as('u1').ref('race/firstGoalAt').set(startAt + 90000));
  await assertFails(as('u2').ref('race/firstGoalAt').set(startAt + 95000), '大きくする');
  await assertSucceeds(as('u2').ref('race/firstGoalAt').set(startAt + 85000));
  await assertFails(as('u2').ref('race/firstGoalAt').set(startAt - 1), 'スタートより前');
  await member('u3', 'MOMO');
  await assertFails(as('u3').ref('race/firstGoalAt').set(startAt + 1000), '走る人でない');
});

test('走ったコース（/played）と、性能の点数（/lobby/{uid}/score）', async () => {
  await member('u1', 'KYUGO');
  await assertFails(as('u3').ref('played/2').set(true), '入っていない端末');
  await assertSucceeds(as('u1').ref('played/2').set(true));
  await assertSucceeds(as('u1').ref('played').set({ 0: true, 2: true }), 'transaction の丸ごと書き');
  await assertFails(as('u1').ref('played/5').set(true), 'コースの番号');
  await assertFails(as('u1').ref('played/1').set('yes'));
  await assertSucceeds(as('u1').ref('played').once('value'));
  await assertSucceeds(as('u1').ref('played').remove());
  await assertSucceeds(as('u1').ref('lobby/u1').set(lobbyEntry()));
  await assertSucceeds(as('u1').ref('lobby/u1/score').set(87));
  await assertFails(as('u1').ref('lobby/u1/score').set(101));
  await assertFails(as('u1').ref('lobby/u1/score').set(50.5));
  await assertFails(as('u1').ref('lobby/u2/score').set(50), 'ほかの人の点数');
});
