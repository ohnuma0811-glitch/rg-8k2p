import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVoices, VOICE_FILES, VOICE_GAIN } from '../src/audio/voice.js';

// 声を鳴らすところを記録する、にせものの AudioContext
function fakeAudio() {
  const log = [];
  const ctx = {
    currentTime: 0,
    decodeAudioData: async (bytes) => ({ decoded: bytes.name }),
    createBufferSource: () => ({ buffer: null, connect(g) { return g; }, start() { log.push(['start', this.buffer.decoded]); } }),
    createGain: () => ({ gain: { value: 1 }, connect(d) { log.push(['gain', this.gain.value, d]); return d; } }),
  };
  return { log, audio: { ctx, sfxOut: 'sfxOut' } };
}
const fakeFetch = async (url) => ({ ok: true, arrayBuffer: async () => ({ name: url }) });

test('声のファイルは男の子用と女の子用（男衆「イヤッホー！」・女衆「おう！」、フリー素材）と、恐竜に食べられたときの「ぎゃーーー」', () => {
  assert.deepEqual(VOICE_FILES, { male: 'sounds/yahoo-male.mp3', female: 'sounds/yahoo-female.mp3', scream: 'sounds/dino-scream.mp3', roar: 'sounds/dino-roar.mp3', rocket: 'sounds/rocket-start.mp3', horn: 'sounds/horn.mp3', warp: 'sounds/Shortbridge16-2.mp3', launch: 'sounds/49053354-rocket-launch-306441.mp3', ring: 'sounds/Onoma-Impact10-1(High).mp3' }); // ring: ワープの輪っかを通る音（2026-10-22 にユーザーが用意） // launch: 宇宙へ行く発射台の急な坂（2026-10-21 にユーザーが用意） // warp: ワープの音（2026-10-21 にユーザーが用意）
  assert.ok(VOICE_GAIN.female > VOICE_GAIN.male); // 女の子の声のファイルは少し小さいので、大きめに鳴らす
});

test('読みこんだあと、キャラの声の種類で鳴らす', async () => {
  const { log, audio } = fakeAudio();
  const v = createVoices(audio, { fetch: fakeFetch });
  await v.load();
  v.play('female');
  assert.deepEqual(log, [['gain', VOICE_GAIN.female, 'sfxOut'], ['start', 'sounds/yahoo-female.mp3']]);
});

test('音が使えない・まだ読みこめていない・読みこみに失敗したときは、何もしない（止まらない）', async () => {
  createVoices({ ctx: null }).play('male');
  const { log, audio } = fakeAudio();
  const v = createVoices(audio, { fetch: async () => ({ ok: false }) });
  v.play('male');
  await v.load();
  v.play('male');
  assert.deepEqual(log, []);
});

test('大きさの倍率をつけて鳴らせる（遠くの恐竜の声を小さく。2026-10-16）', async () => {
  const { log, audio } = fakeAudio();
  const v = createVoices(audio, { fetch: fakeFetch });
  await v.load();
  v.play('roar', 0.5);
  assert.deepEqual(log, [['gain', VOICE_GAIN.roar * 0.5, 'sfxOut'], ['start', 'sounds/dino-roar.mp3']]);
});
