import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speedText, slotItem, ITEM_ICONS, ROULETTE_ORDER } from '../src/hud.js';

test('スピード計: 速く見えるよう、実際の km/h の1.5倍を整数・3けたで出す（足りない所は空ける）', () => {
  assert.equal(speedText(41), '221');
  assert.equal(speedText(10), ' 54');
  assert.equal(speedText(0), '  0');
});

test('スピード計: バックしているときも、速さ（プラス）で出す。999 より上は 999', () => {
  assert.equal(speedText(-6), ' 32');
  assert.equal(speedText(400), '999');
});

import { ITEMS } from '../src/game/itemOdds.js';

test('アイテムの枠: 持っているアイテムの絵。ルーレットの間はくるくる変わる。何もなければ出さない', () => {
  assert.equal(slotItem({ held: null, roulette: 0 }), null);
  assert.equal(slotItem({ held: 'star', roulette: 0 }), 'star');
  const seen = new Set();
  for (let r = 2; r > 0; r -= 0.02) seen.add(slotItem({ held: null, roulette: r }));
  assert.equal(seen.size, ROULETTE_ORDER.length);
});

test('6つのアイテムに、それぞれ絵がある（自分たちで描いた SVG）', () => {
  for (const it of ITEMS) assert.ok(ITEM_ICONS[it]?.startsWith('<svg'), it);
  assert.deepEqual([...ROULETTE_ORDER].sort(), [...ITEMS].sort());
});
