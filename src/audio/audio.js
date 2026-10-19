// 音のおおもと: 最初のタップで AudioContext を作る、ON/OFF（端末に覚える）、全体の音量、裏に回ったら止める
// 音が使えない端末では ctx が null のまま。ほかの音の部品は、ctx がなければ何もしない
import { load, save } from '../storage.js?v=412c7a8';

export const MUSIC_VOLUME = 0.45; // 曲の音量（全体を 1 として。0.55 から気持ち下げた: 2026-10-15 のユーザー依頼）

function defaultContext() {
  const AC = window.AudioContext || window.webkitAudioContext;
  return new AC();
}

export function createAudio({ makeContext = defaultContext, store = { load, save } } = {}) {
  let on = store.load('sound', true) !== false;
  let ctx = null;
  let master = null;
  let musicOut = null;
  let sfxOut = null;
  let broken = false;

  function ensure() {
    if (ctx || broken) return ctx;
    try {
      ctx = makeContext();
      master = ctx.createGain();
      master.gain.value = on ? 1 : 0;
      master.connect(ctx.destination);
      musicOut = ctx.createGain();
      musicOut.gain.value = MUSIC_VOLUME;
      musicOut.connect(master);
      sfxOut = ctx.createGain();
      sfxOut.connect(master);
    } catch {
      broken = true;
      ctx = master = musicOut = sfxOut = null;
    }
    return ctx;
  }

  return {
    get ctx() {
      return ctx;
    },
    get master() {
      return master;
    },
    get musicOut() {
      return musicOut;
    },
    get sfxOut() {
      return sfxOut;
    },
    // 最初のタップ・クリック・キーのときに呼ぶ（iPhone・Android は、さわるまで音を出せない）
    unlock() {
      const c = ensure();
      if (c && c.state !== 'running') c.resume().catch(() => {});
    },
    isOn: () => on,
    setOn(value) {
      on = !!value;
      store.save('sound', on);
      if (master) master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.02);
    },
    // 画面が見えなくなったとき・戻ったとき
    pause() {
      if (ctx) ctx.suspend().catch(() => {});
    },
    resume() {
      if (ctx) ctx.resume().catch(() => {});
    },
  };
}
