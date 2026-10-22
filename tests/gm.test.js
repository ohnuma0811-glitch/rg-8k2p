import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCodeId, setCodeUpdates, stopUpdates, playersOf, lockedOf, clampLimit, playedSec, resetValue } from '../src/gm.js';

test('Set: コードとコードの番号（毎回新しい）を、/secret と /status に（/status にはコードを入れない）', () => {
  const id = newCodeId(1000, () => 0.5);
  assert.match(id, /^[a-z0-9]{2,40}$/);
  assert.notEqual(newCodeId(1000, () => 0.1), newCodeId(1001, () => 0.1));
  assert.deepEqual(setCodeUpdates('0811', id), { secret: { code: '0811', codeId: id, active: true }, status: { codeId: id, active: true } });
  assert.throws(() => setCodeUpdates('81', id));
});

test('Stop: すぐに使えなくする', () => {
  assert.deepEqual(stopUpdates('c1'), { 'secret/active': false, status: { codeId: 'c1', active: false } });
});

test('Players: 今のコードで入った人（名前のある人）を新しい順。Locked: 今のコードで5回まちがえた端末', () => {
  const access = { a: { codeId: 'c1', name: 'KYUGO', at: 10 }, b: { codeId: 'c1', name: 'SOKI', at: 20 }, c: { codeId: 'c0', name: 'OLD', at: 30 }, d: { codeId: 'c1', name: '', at: 40 } };
  assert.deepEqual(playersOf(access, 'c1').map((p) => p.name), ['SOKI', 'KYUGO']);
  const attempts = { x: { codeId: 'c1', count: 5, device: 'iPhone', at: 5 }, y: { codeId: 'c1', count: 2, device: 'PC', at: 6 }, z: { codeId: 'c0', count: 5, device: 'Android', at: 7 } };
  assert.deepEqual(lockedOf(attempts, 'c1'), [{ uid: 'x', device: 'iPhone', at: 5 }]);
  assert.deepEqual(playersOf(null, 'c1'), []);
});

test('Daily limit は 5〜120分', () => {
  assert.equal(clampLimit(0), 5);
  assert.equal(clampLimit(25), 25);
  assert.equal(clampLimit(999), 120);
});

test('Play time: 端末ごとの数字の合計（reset は数えない）。Reset は { reset: 今 } を書く', () => {
  assert.equal(playedSec({ u1: 300, u2: 120.5, reset: 1700000000000 }), 420.5);
  assert.equal(playedSec(null), 0);
  assert.equal(playedSec(60), 0, '古い形（数字ひとつ）は数えない');
  assert.deepEqual(resetValue(1234), { reset: 1234 });
});

test('Set: 前のコードのチャットも一緒に消す', () => {
  assert.deepEqual(setCodeUpdates('0811', 'c2', 'c1'), { secret: { code: '0811', codeId: 'c2', active: true }, status: { codeId: 'c2', active: true }, 'chat/c1': null });
  assert.deepEqual(setCodeUpdates('0811', 'c2', null), { secret: { code: '0811', codeId: 'c2', active: true }, status: { codeId: 'c2', active: true } });
});
