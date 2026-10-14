import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidName, typeLetter, addRecent } from '../src/names.js';

test('名前はアルファベットの大文字だけ、1〜12文字', () => {
  assert.ok(isValidName('KYUGO'));
  assert.ok(isValidName('ABCDEFGHIJKL'));
  assert.ok(!isValidName(''));
  assert.ok(!isValidName('ABCDEFGHIJKLM'));
  assert.ok(!isValidName('Kyugo'));
  assert.ok(!isValidName('KYUGO1'));
});

test('1文字ずつ打てる。12文字より先と、A〜Z 以外は入らない', () => {
  let n = '';
  for (const c of 'SOKI') n = typeLetter(n, c);
  assert.equal(n, 'SOKI');
  assert.equal(typeLetter('ABCDEFGHIJKL', 'M'), 'ABCDEFGHIJKL');
  assert.equal(typeLetter('SOKI', '1'), 'SOKI');
});

test('最近の名前は、新しいものが先頭で、同じ名前は1つだけ、5件まで', () => {
  let list = [];
  for (const n of ['A', 'B', 'C', 'D', 'E', 'F']) list = addRecent(list, n);
  assert.deepEqual(list, ['F', 'E', 'D', 'C', 'B']);
  assert.deepEqual(addRecent(list, 'D'), ['D', 'F', 'E', 'C', 'B']);
  assert.deepEqual(addRecent(list, 'bad'), list);
});

test('保存してある「最近の名前」が壊れていても使えるように、正しい名前だけを残す（レビューの指摘）', async () => {
  const { cleanRecent } = await import('../src/names.js');
  assert.deepEqual(cleanRecent(['KYUGO', '<b>x</b>', 'soki', 'SOKI', 3]), ['KYUGO', 'SOKI']);
  assert.deepEqual(cleanRecent('KYUGO'), []);
  assert.deepEqual(cleanRecent(null), []);
});
