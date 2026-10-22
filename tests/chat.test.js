import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_MAX, CHAT_SHOW, cleanText, canSend, sendChat, lastMessages, displayText } from '../src/net/chat.js';

test('自由な文: 前後の空白を取る。空・空白だけ・100文字を超えるものは送らない', () => {
  assert.equal(cleanText('  hi  '), 'hi');
  assert.equal(cleanText('   '), '');
  assert.equal(cleanText('a'.repeat(CHAT_MAX)), 'a'.repeat(100));
  assert.equal(cleanText('a'.repeat(CHAT_MAX + 1)), '');
  assert.equal(cleanText(null), '');
});

test('送れるのは1秒に1回', () => {
  assert.equal(canSend(null, 5000), true);
  assert.equal(canSend(4500, 5000), false);
  assert.equal(canSend(4000, 5000), true);
});

test('送る: メッセージと最後に送った時刻を、1回で書く（どちらもサーバーの時刻）', async () => {
  const writes = [];
  const db = { newKey: (p) => `${p}/k1`.split('/').pop(), SERVER_TIME: 'NOW', update: async (path, v) => writes.push([path, v]) };
  await sendChat(db, 'c1', { uid: 'u1', name: 'KYUGO', char: 'kyugo' }, { preset: 8 });
  assert.deepEqual(writes, [['', { 'chat/c1/k1': { uid: 'u1', name: 'KYUGO', char: 'kyugo', preset: 8, at: 'NOW' }, 'chatLast/u1': { at: 'NOW', key: 'k1' } }]]);
});

test('受け取り: 古い順に、最新の50件。表示の文（定型文は読む人の言語、自由な文はそのまま）', () => {
  const obj = {};
  for (let i = 0; i < 60; i++) obj[`k${String(i).padStart(2, '0')}`] = { uid: 'u', name: 'A', char: 'cat', preset: 2, at: 1000 + i };
  const list = lastMessages(obj);
  assert.equal(list.length, CHAT_SHOW);
  assert.equal(list[0].at, 1010);
  assert.equal(list[49].id, 'k59');
  assert.deepEqual(lastMessages(null), []);
  assert.equal(displayText({ preset: 0 }, 'ja'), 'READYを おして！');
  assert.equal(displayText({ text: 'やあ' }, 'en'), 'やあ');
});

test('定型文は2秒に1回、自由な文は1秒に1回（2026-10-22 のユーザー依頼）', () => {
  assert.equal(canSend(4000, 5500, 'preset'), false);
  assert.equal(canSend(4000, 6000, 'preset'), true);
  assert.equal(canSend(4000, 5000, 'text'), true);
  assert.equal(canSend(null, 1, 'preset'), true);
});

test('音: 最初の受け取りでは鳴らさない。そのあと、いちばん新しい文が変わって、自分以外なら鳴らす（からのチャットへの最初の1件も）', async () => {
  const { nextChime } = await import('../src/net/chat.js');
  const m = (id, uid) => ({ id, uid });
  let st = { loaded: false, lastId: null };
  let r = nextChime(st, [m('a', 'u2')], 'u1');
  assert.equal(r.chime, false, '最初の受け取り');
  st = r.state;
  r = nextChime(st, [m('a', 'u2')], 'u1');
  assert.equal(r.chime, false, '同じ');
  st = r.state;
  r = nextChime(st, [m('a', 'u2'), m('b', 'u1')], 'u1');
  assert.equal(r.chime, false, '自分の文');
  st = r.state;
  r = nextChime(st, [m('a', 'u2'), m('b', 'u1'), m('c', 'u2')], 'u1');
  assert.equal(r.chime, true);
  st = nextChime({ loaded: false, lastId: null }, [], 'u1').state;
  assert.equal(nextChime(st, [m('a', 'u2')], 'u1').chime, true, 'からのチャットへの最初の1件');
});
