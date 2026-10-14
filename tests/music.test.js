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

import { renderSong, createMusic, FINAL_LAP_RATE } from '../src/audio/music.js';

test('曲を作れない端末（OfflineAudioContext がない）では null を返し、止まらない', async () => {
  const buf = await renderSong(SONGS.title, { makeOffline: () => { throw new Error('no offline'); } });
  assert.equal(buf, null);
});

test('曲が作れなくても、流す・速さを変える・止めるを呼んで止まらない', async () => {
  const audio = { ctx: null, musicOut: null };
  const m = createMusic(audio, { render: async () => null });
  await m.play('kenta');
  m.setRate(FINAL_LAP_RATE);
  m.stop();
  assert.equal(FINAL_LAP_RATE, 1.12);
});

// Web Audio のかわり（テスト用）: 曲を流す・止める・音量の変化を覚える
function fakeMusicContext() {
  const log = [];
  const ctx = {
    currentTime: 10,
    log,
    createBufferSource: () => ({
      buffer: null,
      loop: false,
      playbackRate: { setTargetAtTime() {} },
      connect(n) {
        return n;
      },
      start: (t = 0) => log.push(t ? `start@${t.toFixed(1)}` : 'start'),
      stop: (t) => log.push(`stop@${t.toFixed(1)}`),
    }),
    createGain: () => ({
      gain: {
        setValueAtTime() {},
        setTargetAtTime: (v, t, tc) => log.push(`gain ${v} from ${t} tc ${tc.toFixed(2)}`),
      },
      connect(n) {
        return n;
      },
    }),
  };
  return ctx;
}

test('曲を止めるときは、だんだん小さくして（フェードアウト）から止める（2026-10-15 のユーザー依頼）', async () => {
  const ctx = fakeMusicContext();
  const audio = { ctx, musicOut: {} };
  const m = createMusic(audio, { render: async () => ({ duration: 15 }) });
  await m.play('title');
  assert.ok(ctx.log.includes('start@10.0'), 'すぐに流す');
  m.stop(1.5);
  assert.ok(ctx.log.some((l) => l.startsWith('gain 0 from 10')), 'だんだん小さくする');
  assert.ok(ctx.log.includes('stop@11.6'), '小さくなってから止める');
  // もう一度止めても何もしない
  const n = ctx.log.length;
  m.stop();
  assert.equal(ctx.log.length, n);
});

test('タイトルの曲は、タイトル専用（どのコースの曲ともちがう）', () => {
  assert.notEqual(SONGS.title, SONGS.kenta);
  assert.notEqual(SONGS.title.lead, SONGS.results.lead);
});

test('勝利の曲がある。ゴールのファンファーレのあとから流せる（少しあとから始める）（2026-10-15 のユーザー依頼）', async () => {
  assert.ok(SONGS.victory, '勝利の曲');
  const ctx = fakeMusicContext();
  const m = createMusic({ ctx, musicOut: {} }, { render: async () => ({ duration: 12.8 }) });
  await m.play('victory', { delay: 1.5 });
  assert.ok(ctx.log.includes('start@11.5'), ctx.log.join(' / '));
});
