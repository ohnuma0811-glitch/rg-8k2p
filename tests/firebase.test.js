import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firebaseReady, withTimeout, normalizeError, storeOf } from '../src/net/firebase.js';

test('設定が空なら、Firebase は使わない（SOLO はそのまま）', () => {
  assert.equal(firebaseReady({ apiKey: '', databaseURL: '' }), false);
  assert.equal(firebaseReady({ apiKey: 'k', databaseURL: 'https://x.asia-southeast1.firebasedatabase.app', projectId: 'p', authDomain: 'p.firebaseapp.com', appId: 'a' }), true);
});

test('時間切れは offline として失敗する（オフラインで書きこみが待ち続けても、画面が固まらない）', async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 20), (e) => e.offline === true);
  assert.equal(await withTimeout(Promise.resolve(5), 20), 5);
});

test('ルールで断られたエラーは denied', () => {
  assert.equal(normalizeError(new Error('PERMISSION_DENIED: Permission denied')).denied, true);
  assert.equal(normalizeError(Object.assign(new Error('x'), { code: 'PERMISSION_DENIED' })).denied, true);
  assert.equal(normalizeError(new Error('other')).denied, undefined);
});

test('「Client is offline.」のメッセージは offline として扱う', () => {
  assert.equal(normalizeError(new Error('Client is offline.')).offline, true);
  assert.equal(normalizeError(new Error('network is offline now')).offline, true);
  assert.equal(normalizeError(new Error('other')).offline, undefined);
});

test('GM のログインは iPhone でも signInWithPopup（リダイレクトは第三者ストレージの分離で戻ってこない）', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/net/firebase.js', import.meta.url), 'utf8');
  assert.ok(!/signInWithRedirect/.test(src));
  assert.ok(/signInWithPopup/.test(src));
});

test('読みこみ（get）で断られたときの「Permission denied」（code なし）も denied（実際の Firebase 10.14.1 で確かめた形）', () => {
  assert.equal(normalizeError(new Error('Permission denied')).denied, true);
});

// Firebase のかわりの作り物（storeOf がどの関数をどう呼ぶかを見る）
function fakeF() {
  const calls = [];
  const snap = (v) => ({ exists: () => v !== null, val: () => v });
  const db = {
    ref: (_db, p) => ({ p: p ?? '' }),
    push: (r) => ({ key: `${r.p}-newkey` }),
    serverTimestamp: () => ({ '.sv': 'timestamp' }),
    onDisconnect: (r) => ({ remove: async () => calls.push(['onDisconnectRemove', r.p]) }),
    query: (r, q) => ({ ...r, q }),
    limitToLast: (n) => ({ last: n }),
    onValue: (r, cb) => {
      calls.push(['onValue', r.p, r.q?.last ?? null]);
      cb(snap(r.p === '.info/serverTimeOffset' ? 1234 : { a: 1 }));
      return () => calls.push(['off', r.p]);
    },
    get: async () => snap(null), set: async () => {}, update: async () => {}, remove: async () => {}, runTransaction: async () => ({ committed: true }),
  };
  return { calls, f: { db: 'DB', mods: { db } } };
}

test('storeOf: 新しいキー・サーバーの時刻・切れたら消す・最新 n 件の受け取り・時計のずれ', async () => {
  const { calls, f } = fakeF();
  const s = storeOf(f);
  assert.equal(s.newKey('chat/c1'), 'chat/c1-newkey');
  assert.deepEqual(s.SERVER_TIME, { '.sv': 'timestamp' });
  await s.onDisconnectRemove('lobby/u1');
  let got = null;
  const off = s.watch('chat/c1', (v) => { got = v; }, { last: 50 });
  assert.deepEqual(got, { a: 1 });
  off();
  let offset = null;
  s.serverOffset((v) => { offset = v; });
  assert.equal(offset, 1234);
  assert.deepEqual(calls, [['onDisconnectRemove', 'lobby/u1'], ['onValue', 'chat/c1', 50], ['off', 'chat/c1'], ['onValue', '.info/serverTimeOffset', null]]);
});
