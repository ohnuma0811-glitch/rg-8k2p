import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateBest } from '../src/timetrial.js';

test('TIME TRIAL のいちばん速いタイムは、コースごとに残す。速くなったら新記録（2026-10-18）', () => {
  let r = updateBest({}, 'Kyugo Mountain', 80.5);
  assert.deepEqual(r, { bests: { 'Kyugo Mountain': 80.5 }, best: 80.5, record: true });
  r = updateBest(r.bests, 'Kyugo Mountain', 82);
  assert.deepEqual(r, { bests: { 'Kyugo Mountain': 80.5 }, best: 80.5, record: false });
  r = updateBest(r.bests, 'Kenta Circuit', 40);
  assert.equal(r.bests['Kyugo Mountain'], 80.5);
  assert.equal(r.best, 40);
});
