import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteToMidi, midiToHz, parseTrack, chordNotes, chordSteps } from '../src/audio/notes.js';

test('音の名前 → 番号 → 周波数', () => {
  assert.equal(noteToMidi('C4'), 60);
  assert.equal(noteToMidi('A4'), 69);
  assert.equal(noteToMidi('F#5'), 78);
  assert.equal(noteToMidi('Bb3'), 58);
  assert.equal(midiToHz(69), 440);
  assert.ok(Math.abs(midiToHz(81) - 880) < 1e-9);
  assert.throws(() => noteToMidi('H4'));
});

test('楽譜の文字を読む（長さは16分音符の数、R は休み）', () => {
  const t = parseTrack('E5:2 G5:2 R:4 C6:8');
  assert.equal(t.steps, 16);
  assert.deepEqual(t.notes, [
    { step: 0, len: 2, midi: 76 },
    { step: 2, len: 2, midi: 79 },
    { step: 8, len: 8, midi: 84 },
  ]);
  assert.throws(() => parseTrack('C4:0'));
});

test('コードの3つの音と、小節の中のコードの位置', () => {
  assert.deepEqual(chordNotes('C', 4), [60, 64, 67]);
  assert.deepEqual(chordNotes('Am', 3), [57, 60, 64]);
  assert.deepEqual(chordSteps(['C', 'F G']), [
    { step: 0, len: 16, name: 'C' },
    { step: 16, len: 8, name: 'F' },
    { step: 24, len: 8, name: 'G' },
  ]);
});
