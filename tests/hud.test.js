import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speedText } from '../src/hud.js';

test('スピード計: 速く見えるよう、実際の km/h の1.5倍を整数・3けたで出す（足りない所は空ける）', () => {
  assert.equal(speedText(41), '221');
  assert.equal(speedText(10), ' 54');
  assert.equal(speedText(0), '  0');
});

test('スピード計: バックしているときも、速さ（プラス）で出す。999 より上は 999', () => {
  assert.equal(speedText(-6), ' 32');
  assert.equal(speedText(400), '999');
});
