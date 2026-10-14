import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speedText } from '../src/hud.js';

test('スピード計: m/s を km/h の整数にして、3けたで出す（足りない所は空ける）', () => {
  assert.equal(speedText(41), '148');
  assert.equal(speedText(10), ' 36');
  assert.equal(speedText(0), '  0');
});

test('スピード計: バックしているときも、速さ（プラス）で出す。999 より上は 999', () => {
  assert.equal(speedText(-6), ' 22');
  assert.equal(speedText(400), '999');
});
