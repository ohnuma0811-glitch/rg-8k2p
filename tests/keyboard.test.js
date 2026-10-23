import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyboardInset } from '../src/keyboard.js';

// 2026-10-23: Android タブレットで文字を打つと、キーボードで入力欄が隠れた
test('キーボードの高さ: 見えている画面（visualViewport）の下からはみ出た分。キーボードがなければ 0', () => {
  assert.equal(keyboardInset({ height: 800, offsetTop: 0 }, 800), 0);
  assert.equal(keyboardInset({ height: 450, offsetTop: 0 }, 800), 350);
  assert.equal(keyboardInset({ height: 450, offsetTop: 50 }, 800), 300, '画面が上にずれている分は引く');
  assert.equal(keyboardInset({ height: 790, offsetTop: 0 }, 800), 0, '小さなずれ（40px 未満）は 0');
  assert.equal(keyboardInset(null, 800), 0, 'visualViewport がない');
});
