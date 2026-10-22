import { test, before, after, beforeEach } from 'node:test';
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

test('遊んだ時間: 入ったことのある端末だけ、増やすだけ。GM は0にできる。だれでも読める', async () => {
  const day = 'playtime/KYUGO/2026-10-22';
  await assertFails(as('u1').ref(day).set(60), 'まだ入っていない');
  await assertSucceeds(as('u1').ref('attempts/u1').set(attempt(1, '0811')));
  await assertSucceeds(as('u1').ref('access/u1').set({ codeId: 'c1', name: 'KYUGO', at: 1 }));
  await assertSucceeds(as('u1').ref(day).set(60));
  await assertSucceeds(as('u1').ref(day).set(65));
  await assertFails(as('u1').ref(day).set(10), '減らせない');
  await assertFails(as('u1').ref('playtime/kyugo/2026-10-22').set(70), '名前は大文字');
  await assertSucceeds(as(GM).ref(day).set(0));
  await assertSucceeds(env.unauthenticatedContext().database().ref(day).once('value'));
  await assertSucceeds(env.unauthenticatedContext().database().ref('limits').once('value'));
});
