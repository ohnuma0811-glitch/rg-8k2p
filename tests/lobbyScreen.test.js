import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lobbyRows, messageRows, voteRows } from '../src/lobbyScreen.js';

test('待合室の一覧: 顔・名前・READY、自分の行は me。人数', () => {
  const html = lobbyRows([{ uid: 'u1', name: 'KYUGO', char: 'kyugo', ready: true }, { uid: 'u2', name: 'SOKI', char: 'cat', ready: false }], 'u2');
  assert.ok(html.includes('KYUGO') && html.includes('SOKI'));
  assert.ok(html.includes('2 players'));
  assert.equal((html.match(/class="row me/g) ?? []).length, 1);
  assert.ok(/KYUGO[\s\S]*✓/.test(html));
  assert.ok(html.includes('face-svg'));
});

test('チャットの行: 定型文は読む人の言語、自由な文はそのまま（文字はエスケープ）、自分の文は mine', () => {
  const msgs = [{ id: 'a', uid: 'u1', name: 'KYUGO', char: 'kyugo', preset: 8 }, { id: 'b', uid: 'u2', name: 'SOKI', char: 'cat', text: '<b>やあ</b>' }];
  const ja = messageRows(msgs, 'u2', 'ja');
  assert.ok(ja.includes('いいしょうぶだった！'));
  assert.ok(ja.includes('&lt;b&gt;やあ&lt;/b&gt;'));
  assert.equal((ja.match(/class="msg mine/g) ?? []).length, 1);
  assert.ok(messageRows(msgs, 'u2', 'en').includes('Good game!'));
});

test('投票の行: コースごとに、選んだ人の顔（今の投票の票だけ）', () => {
  const html = voteRows(['Kenta Circuit', 'Kampar Town'], { u1: { voteId: 'v', course: 1 }, u2: { voteId: 'old', course: 0 } }, 'v', [{ uid: 'u1', char: 'tiger' }, { uid: 'u2', char: 'cat' }]);
  assert.ok(html.includes('Kenta Circuit') && html.includes('Kampar Town'));
  assert.equal((html.match(/face-svg/g) ?? []).length, 1);
  assert.ok(/data-course="1"[\s\S]*face-svg/.test(html));
});
