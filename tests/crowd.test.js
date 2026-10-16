import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCrowd, CROWD_FILE } from '../src/audio/crowd.js';

// 鳴らした音（バッファ）を記録する、にせものの AudioContext
function fakeAudio() {
  const started = [];
  const node = () => ({ connect(d) { return d; }, disconnect() {}, gain: { value: 0, setTargetAtTime() {} }, pan: { setTargetAtTime() {} } });
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    decodeAudioData: async (bytes) => ({ decoded: bytes.name }),
    createBuffer: () => ({ made: true, getChannelData: () => new Float32Array(8000 * 4) }),
    createBufferSource: () => ({ buffer: null, loop: false, connect(d) { return d; }, start() { started.push(this.buffer); }, stop() {} }),
    createStereoPanner: node,
    createGain: node,
  };
  return { started, audio: { ctx, sfxOut: {} } };
}

test('スタジアムの歓声は、ユーザーが用意した音のファイル（sounds/studiam.mp3）を、くり返し鳴らす（2026-10-16）', async () => {
  assert.equal(CROWD_FILE, 'sounds/studiam.mp3');
  const { started, audio } = fakeAudio();
  const crowd = createCrowd(audio, { fetch: async (url) => ({ ok: true, arrayBuffer: async () => ({ name: url }) }) });
  await crowd.load();
  crowd.start();
  assert.deepEqual(started, [{ decoded: 'sounds/studiam.mp3' }]);
});

test('音のファイルを読みこめないときは、今までの作った歓声を鳴らす', async () => {
  const { started, audio } = fakeAudio();
  const crowd = createCrowd(audio, { fetch: async () => ({ ok: false }) });
  await crowd.load();
  crowd.start();
  assert.equal(started.length, 1);
  assert.ok(started[0].made);
});
