import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soundState, soundEvents } from '../src/audio/events.js';
import { newBumps } from '../src/game/collide.js';

const kart = (o = {}) => ({ drift: { active: false, stage: 0 }, boost: 0, airborne: false, onWall: false, ...o });
const st = (o = {}, k = {}) => soundState({ count: '', lap: 0, finished: false, bumps: 0, ...o, kart: kart(k) });

test('はじめの1回は何も鳴らさない', () => {
  assert.deepEqual(soundEvents(null, st(), 3), []);
});

test('カウント: 3・2・1 でポーン、GO! でプォーン', () => {
  assert.deepEqual(soundEvents(st({ count: '' }), st({ count: '3' }), 3), ['count']);
  assert.deepEqual(soundEvents(st({ count: '1' }), st({ count: 'GO!' }), 3), ['go']);
  assert.deepEqual(soundEvents(st({ count: 'GO!' }), st({ count: '' }), 3), []);
});

test('周回: 1周目の終わりは lap、最後の周に入るときは finalLap、ゴールは finish だけ', () => {
  assert.deepEqual(soundEvents(st({ lap: 0 }), st({ lap: 1 }), 3), ['lap']);
  assert.deepEqual(soundEvents(st({ lap: 1 }), st({ lap: 2 }), 3), ['finalLap']);
  assert.deepEqual(soundEvents(st({ lap: 2 }), st({ lap: 3, finished: true }), 3), ['finish']);
});

test('ドリフト: 始まり・火花の色が変わる・終わり。ミニターボで加速の音', () => {
  assert.deepEqual(soundEvents(st(), st({}, { drift: { active: true, stage: 0 } }), 3), ['driftStart']);
  assert.deepEqual(soundEvents(st({}, { drift: { active: true, stage: 0 } }), st({}, { drift: { active: true, stage: 1 } }), 3), ['spark']);
  assert.deepEqual(
    soundEvents(st({}, { drift: { active: true, stage: 2 } }), st({}, { boost: 1.2 }), 3),
    ['driftEnd', 'boost'],
  );
});

test('空中ではドリフトの音を鳴らさない。着地で音', () => {
  const air = st({}, { drift: { active: true, stage: 0 }, airborne: true });
  assert.equal(air.drift, false);
  assert.deepEqual(soundEvents(st({}, { airborne: true }), st(), 3), ['land']);
});

test('壁にぶつかった最初の1回と、車どうしで新しくぶつかったとき', () => {
  assert.deepEqual(soundEvents(st(), st({}, { onWall: true }), 3), ['wall']);
  assert.deepEqual(soundEvents(st({}, { onWall: true }), st({}, { onWall: true }), 3), []);
  assert.deepEqual(soundEvents(st({ bumps: 1 }), st({ bumps: 2 }), 3), ['bump']);
});

test('同じ様子のまま（一時停止中など）は、何も鳴らさない', () => {
  const s = st({ count: '', lap: 1 }, { drift: { active: true, stage: 2 }, boost: 1, onWall: true });
  assert.deepEqual(soundEvents(s, s, 3), []);
});

test('自分（k 番）が新しくぶつかった数を数える', () => {
  const prev = new Set(['0-4']);
  const now = new Set(['0-4', '3-4', '1-2']);
  assert.equal(newBumps(prev, now, 4), 1);
  assert.equal(newBumps(prev, now, 1), 1);
  assert.equal(newBumps(prev, now, 0), 0);
});

test('ゴールの音: 1〜3位は明るいファンファーレと勝利の曲、4位以下はちょっと悲しいファンファーレと別の曲（2026-10-15 のユーザー依頼）', async () => {
  const { finishMusic } = await import('../src/audio/events.js');
  for (const place of [1, 2, 3]) assert.deepEqual(finishMusic(place), { sfx: 'finish', song: 'victory' });
  for (const place of [4, 5, 8]) assert.deepEqual(finishMusic(place), { sfx: 'finishSad', song: 'consolation' });
  const { SONGS } = await import('../src/audio/songs.js');
  assert.ok(SONGS.consolation, '4位以下の曲');
});
