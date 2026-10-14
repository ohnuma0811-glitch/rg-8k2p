import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAudio, MUSIC_VOLUME } from '../src/audio/audio.js';

// Web Audio のかわり（テスト用）。作った物と呼ばれたことを覚える
function fakeContext() {
  const gain = () => ({
    gain: {
      value: 1,
      setTargetAtTime(v) {
        this.value = v;
      },
    },
    connect() {},
  });
  return {
    state: 'suspended',
    currentTime: 0,
    destination: {},
    createGain: gain,
    resume() {
      this.state = 'running';
      return Promise.resolve();
    },
    suspend() {
      this.state = 'suspended';
      return Promise.resolve();
    },
  };
}
function memoryStore(init = {}) {
  const data = { ...init };
  return {
    data,
    load: (k, f) => (k in data ? data[k] : f),
    save: (k, v) => {
      data[k] = v;
    },
  };
}

test('はじめは音が ON。OFF にすると端末に覚え、次に開いたときも OFF', () => {
  const store = memoryStore();
  const a = createAudio({ makeContext: fakeContext, store });
  assert.equal(a.isOn(), true);
  a.setOn(false);
  assert.equal(store.data.sound, false);
  assert.equal(createAudio({ makeContext: fakeContext, store }).isOn(), false);
});

test('最初のタップで1回だけ AudioContext を作り、鳴らせる状態にする', () => {
  let made = 0;
  const a = createAudio({
    makeContext: () => {
      made++;
      return fakeContext();
    },
    store: memoryStore(),
  });
  assert.equal(a.ctx, null, 'タップの前は作らない');
  a.unlock();
  a.unlock();
  assert.equal(made, 1);
  assert.equal(a.ctx.state, 'running');
  assert.equal(a.musicOut.gain.value, MUSIC_VOLUME);
});

test('OFF のときは全体の音量が 0（作る前に OFF でも、作ったあとに OFF にしても）', () => {
  const store = memoryStore({ sound: false });
  const a = createAudio({ makeContext: fakeContext, store });
  a.unlock();
  assert.equal(a.master.gain.value, 0);
  a.setOn(true);
  assert.equal(a.master.gain.value, 1);
  a.setOn(false);
  assert.equal(a.master.gain.value, 0);
});

test('裏に回ったら止め、戻ったら鳴らす。作る前に呼んでも止まらない', () => {
  const a = createAudio({ makeContext: fakeContext, store: memoryStore() });
  a.pause();
  a.resume();
  a.unlock();
  a.pause();
  assert.equal(a.ctx.state, 'suspended');
  a.resume();
  assert.equal(a.ctx.state, 'running');
});

test('音が使えない端末（AudioContext が作れない）でも、止まらずに音なしで動く', () => {
  const a = createAudio({
    makeContext: () => {
      throw new Error('no audio');
    },
    store: memoryStore(),
  });
  a.unlock();
  a.unlock();
  assert.equal(a.ctx, null);
  assert.equal(a.musicOut, null);
  a.setOn(false);
  a.pause();
  a.resume();
});
