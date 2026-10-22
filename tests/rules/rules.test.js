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
async function member(uid) {
  await as(uid).ref(`attempts/${uid}`).set(attempt(1, '0811'));
  await as(uid).ref(`access/${uid}`).set({ codeId: 'c1', name: 'KYUGO', at: 1 });
}
const NOW = { '.sv': 'timestamp' };
const lobbyEntry = (name = 'KYUGO') => ({ name, char: 'cat', codeId: 'c1', ready: false, at: NOW });
const message = (uid, extra = { preset: 0 }) => ({ uid, name: 'KYUGO', char: 'cat', ...extra, at: NOW });

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
  await assertSucceeds(db.ref().update({ 'chat/c1/m1': message('u1'), 'chatLast/u1': NOW }));
  await assertFails(db.ref().update({ 'chat/c1/m2': message('u1'), 'chatLast/u1': NOW }), '1秒たっていない');
  await assertFails(db.ref().update({ 'chat/c1/m3': message('u2'), 'chatLast/u1': NOW }), 'ほかの人の uid');
  await assertFails(db.ref('chat/c1/m4').set(message('u1')), 'chatLast を一緒に書かない');
  await assertFails(db.ref('chat/c1/m1/preset').set(5), '書き直せない');
  await assertSucceeds(as('u1').ref('lobby/u1').set(lobbyEntry()));
  await assertFails(as('u2').ref('chat/c1').remove(), '人がいるときは消せない');
  await assertSucceeds(as('u2').ref('chat/c1').once('value'));
  await assertFails(as('u3').ref('chat/c1').once('value'), '入っていない端末は読めない');
});

test('チャット: 中身の決まり（preset か text のどちらか1つ、text は 1〜100文字、前のコードには送れない）', async () => {
  await member('u1');
  const send = (key, extra) => as('u1').ref().update({ [`chat/c1/${key}`]: message('u1', extra), 'chatLast/u1': NOW });
  await assertFails(send('a', { preset: 0, text: 'x' }));
  await assertFails(send('b', { text: 'a'.repeat(101) }));
  await assertFails(send('c', { preset: 13 }));
  await assertFails(as('u1').ref().update({ 'chat/c0/d': message('u1'), 'chatLast/u1': NOW }));
  await assertSucceeds(send('e', { text: 'a'.repeat(100) }));
});

test('チャット: だれもいなければ、入っている端末が消せる。GM はいつでも消せる', async () => {
  await member('u1');
  await assertSucceeds(as('u1').ref().update({ 'chat/c1/m1': message('u1'), 'chatLast/u1': NOW }));
  await assertSucceeds(as('u1').ref('chat/c1').remove());
  await env.withSecurityRulesDisabled((c) => c.database().ref('chat/c1/m2').set({ uid: 'u1', name: 'A', char: 'cat', preset: 1, at: 1 }));
  await env.withSecurityRulesDisabled((c) => c.database().ref('lobby/u9').set({ name: 'X', char: 'cat', codeId: 'c1', ready: false, at: 1 }));
  await assertSucceeds(as(GM).ref('chat/c1/m2').remove());
});

test('部屋と票: 入っている端末が部屋を読み書き。票は自分の分だけ、投票中で、走る人で、締め切りの前', async () => {
  await member('u1');
  await member('u2');
  await assertFails(as('u3').ref('room').once('value'));
  await assertSucceeds(as('u1').ref('room').set({ phase: 'voting', voteId: 'v1', endsAt: Date.now() + 60000, racers: { u1: true }, seed: 1 }));
  await assertSucceeds(as('u1').ref('votes/u1').set({ voteId: 'v1', course: 2 }));
  await assertFails(as('u1').ref('votes/u2').set({ voteId: 'v1', course: 2 }), 'ほかの人の票');
  await assertFails(as('u2').ref('votes/u2').set({ voteId: 'v1', course: 2 }), '走る人でない');
  await assertFails(as('u1').ref('votes/u1').set({ voteId: 'v1', course: 9 }), 'コースの番号');
  await assertSucceeds(as('u1').ref('room').set({ phase: 'voting', voteId: 'v1', endsAt: Date.now() - 1000, racers: { u1: true }, seed: 1 }));
  await assertFails(as('u1').ref('votes/u1').set({ voteId: 'v1', course: 1 }), '締め切りのあと');
  await assertFails(as('u1').ref('room').set({ phase: 'party' }));
});

test('チャット: 定型文は2秒に1回（自由な文は1秒）', async () => {
  await member('u1');
  await env.withSecurityRulesDisabled((c) => c.database().ref('chatLast/u1').set(Date.now() - 1500));
  await assertFails(as('u1').ref().update({ 'chat/c1/p1': message('u1', { preset: 3 }), 'chatLast/u1': NOW }), '1.5秒では定型文は送れない');
  await assertSucceeds(as('u1').ref().update({ 'chat/c1/t1': message('u1', { text: 'hi' }), 'chatLast/u1': NOW }), '1.5秒なら自由な文は送れる');
});
