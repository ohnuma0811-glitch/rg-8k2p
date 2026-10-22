import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHRASES, phrase, defaultLang, pickedText } from '../src/chatPhrases.js';

test('定型文は13個。先頭は Press READY!、次に通話の2つ。START の文はない', () => {
  assert.equal(PHRASES.length, 13);
  assert.deepEqual(PHRASES[0], ['Press READY!', 'READYを おして！']);
  assert.deepEqual(PHRASES[1], ["Let's call on LINE!", 'LINEを つなごうよ！']);
  assert.deepEqual(PHRASES[2], ["Let's call on WhatsApp!", 'WhatsAppを つなごうよ！']);
  assert.deepEqual(PHRASES[12], ['Bye!', 'またね！']);
  assert.ok(!PHRASES.some(([en]) => /START/.test(en)));
});

test('番号から、読む人の言語の文に', () => {
  assert.equal(phrase(8, 'en'), 'Good game!');
  assert.equal(phrase(8, 'ja'), 'いいしょうぶだった！');
  assert.equal(phrase(99, 'en'), '');
});

test('最初の言語は端末の言語（ja で始まれば日本語）', () => {
  assert.equal(defaultLang('ja-JP'), 'ja');
  assert.equal(defaultLang('ja'), 'ja');
  assert.equal(defaultLang('en-US'), 'en');
  assert.equal(defaultLang('ms-MY'), 'en');
  assert.equal(defaultLang(undefined), 'en');
});

test('コースが決まったときの知らせ', () => {
  assert.equal(pickedText('Kampar Town', 3, 'en'), 'Kampar Town — 3 players picked!');
  assert.equal(pickedText('Kampar Town', 1, 'en'), 'Kampar Town — 1 player picked!');
  assert.equal(pickedText('Kampar Town', 3, 'ja'), 'Kampar Town — 3人がえらびました！');
});
