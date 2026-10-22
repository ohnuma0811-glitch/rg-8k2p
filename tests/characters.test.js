import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARS, charOf, colorOf, pickCpus, lineupOf } from '../src/data/characters.js';

test('8人と能力（加速・最高速・ハンドル）は、設計書のとおり', () => {
  assert.deepEqual(CHARS.map((c) => [c.id, c.name, c.stats.accel, c.stats.top, c.stats.handling]), [
    ['kyugo', 'Kyugo', 3, 3, 3],
    ['soki', 'Soki', 3, 3, 3],
    ['penguin', 'Penguin-man', 3, 3, 3],
    ['rabbit', 'Rabbit Girl', 5, 2, 3],
    ['mouse', 'Mouse Boy', 5, 2, 3],
    ['tiger', 'Big Tiger', 2, 5, 1], // 速いので曲がりにくく（2026-10-22 のユーザー依頼）
    ['elephant', 'Rampage Elephant', 2, 5, 1],
    ['cat', 'Lightning Cat', 3, 2, 5],
  ]);
});

test('カートの色は8人で重ならない。声は Rabbit Girl と Lightning Cat が女の子', () => {
  assert.equal(new Set(CHARS.map((c) => c.body)).size, 8);
  assert.equal(colorOf(charOf('kyugo')), '#c11f0a');
  assert.equal(colorOf(charOf('soki')), '#1c3c88');
  assert.deepEqual(CHARS.filter((c) => c.voice === 'female').map((c) => c.id), ['rabbit', 'cat']);
  assert.ok(CHARS.every((c) => c.voice === 'female' || c.voice === 'male'));
});

test('charOf: 知らない id（古い保存など）は Kyugo', () => {
  assert.equal(charOf('tiger').name, 'Big Tiger');
  assert.equal(charOf('nobody').id, 'kyugo');
  assert.equal(charOf(undefined).id, 'kyugo');
});

test('大会の CPU: 自分以外の7人から、かぶらない4人', () => {
  for (const me of CHARS.map((c) => c.id)) {
    for (let s = 0; s < 20; s++) {
      let x = s + 1;
      const rand = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
      const ids = pickCpus(me, 4, rand);
      assert.equal(ids.length, 4);
      assert.equal(new Set(ids).size, 4);
      assert.ok(!ids.includes(me));
      assert.ok(ids.every((id) => CHARS.some((c) => c.id === id)));
    }
  }
});

test('lineupOf: 車の番号ごとのキャラ。自分の番号が自分、ほかは CPU の順。TIME TRIAL（1台）は自分だけ', () => {
  const l = lineupOf('soki', ['tiger', 'cat', 'mouse', 'rabbit'], 5, 4);
  assert.deepEqual(l.map((c) => c.id), ['tiger', 'cat', 'mouse', 'rabbit', 'soki']);
  assert.deepEqual(lineupOf('cat', [], 1, 0).map((c) => c.id), ['cat']);
  // 大会の2レース目も、同じ cpuIds なら同じ並び
  assert.deepEqual(lineupOf('soki', ['tiger', 'cat', 'mouse', 'rabbit'], 5, 4), l);
});
