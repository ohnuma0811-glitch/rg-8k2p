import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firebaseReady, withTimeout, normalizeError } from '../src/net/firebase.js';

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
