import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS } from '../src/audio/songs.js';
import { parseTrack } from '../src/audio/notes.js';
import { songEvents, loopSec, wrapTail } from '../src/audio/music.js';

test('どの曲も、メロディ・コード・ドラムの長さが小節の数とそろう', () => {
  for (const [name, song] of Object.entries(SONGS)) {
    assert.equal(parseTrack(song.lead).steps, song.bars * 16, `${name} のメロディ`);
    assert.equal(song.chords.length, song.bars, `${name} のコード`);
    for (const [part, pat] of Object.entries(song.drums)) assert.match(pat, /^[x.]{16}$/, `${name} の ${part}`);
    for (const n of parseTrack(song.lead).notes) assert.ok(n.midi >= 55 && n.midi <= 96, `${name} の音が高すぎ・低すぎ ${n.midi}`);
  }
});

test('曲の長さ: Kenta Circuit は 160 BPM・16小節で 24 秒', () => {
  assert.equal(SONGS.kenta.bpm, 160);
  assert.ok(Math.abs(loopSec(SONGS.kenta) - 24) < 1e-9);
});

test('コースごとに曲がある（コースのデータの music が SONGS にある）', async () => {
  const tracks = await import('../src/data/tracks.js');
  for (const [name, course] of Object.entries(tracks)) {
    if (!course || !course.points) continue;
    assert.ok(SONGS[course.music], `${name} の曲 ${course.music}`);
  }
});

test('曲の音の並び: ドラムは小節ごとに、ベースは8分音符で、どれも曲の中に収まる', () => {
  const song = SONGS.kenta;
  const ev = songEvents(song);
  const count = (inst) => ev.filter((e) => e.inst === inst).length;
  assert.equal(count('kick'), song.bars * [...song.drums.kick].filter((c) => c === 'x').length);
  assert.equal(count('bass'), song.bars * 8);
  assert.equal(count('pad'), song.chords.reduce((s, bar) => s + bar.split(' ').length * 3, 0));
  assert.equal(count('lead'), parseTrack(song.lead).notes.length);
  const L = loopSec(song);
  for (const e of ev) assert.ok(e.t >= 0 && e.t < L && e.dur > 0, JSON.stringify(e));
});

test('残響の余りを曲の頭に重ねる（ループのつなぎ目が切れない）', () => {
  const ch = new Float32Array([1, 2, 3, 4, 10, 20]);
  const [out] = wrapTail([ch], 4);
  assert.deepEqual([...out], [11, 22, 3, 4]);
});
