// 効果音（その場でプログラムから作って鳴らす）と、鳴りつづける音（エンジン・ドリフトのキュルキュル）
// audio.ctx がない（音が使えない・まだタップしていない）ときは、何もしない
import { midiToHz } from './notes.js?v=1c640b0';
import { engineParams } from './mix.js?v=1c640b0';

export function createSfx(audio) {
  let noise = null; // 1秒の雑音（使い回す）
  let engine = null; // { oscs, filter, gain }
  let squeal = null; // { src, filter, gain }

  function noiseBuffer(ctx) {
    if (!noise) {
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noise;
  }

  // 短い音: type の波で、freq から to まで高さを変えながら、dur 秒で消える
  function tone(type, freq, dur, gain, { to = freq, at = 0 } = {}) {
    const ctx = audio.ctx;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to !== freq) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.sfxOut);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // 短い雑音: フィルター（type）の周波数を from から to へ動かす
  function burst(type, from, to, dur, gain, { at = 0 } = {}) {
    const ctx = audio.ctx;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(audio.sfxOut);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // 和音を順に鳴らす（ファンファーレ）
  function arpeggio(midis, gap, dur, gain) {
    midis.forEach((m, i) => {
      tone('square', midiToHz(m), dur, gain, { at: i * gap });
      tone('triangle', midiToHz(m + 12), dur, gain * 0.5, { at: i * gap });
    });
  }

  // 「ピロリーン」: rise の音を速く順に鳴らし、最後に top の音を hold 秒のばす（2つ少しずらして重ね、キラッと）
  function pirorin(rise, top, hold) {
    rise.forEach((m, i) => tone('square', midiToHz(m), 0.12, 0.12, { at: i * 0.07 }));
    const at = rise.length * 0.07;
    tone('square', midiToHz(top), hold, 0.12, { at });
    tone('triangle', midiToHz(top) * 1.004, hold, 0.08, { at });
  }

  // 「ピヨン」: 高さを一気に上げて、少し戻す
  function boing() {
    const ctx = audio.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(500, t);
    o.frequency.exponentialRampToValueAtTime(1400, t + 0.07);
    o.frequency.exponentialRampToValueAtTime(950, t + 0.18);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 3000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.13, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(f).connect(g).connect(audio.sfxOut);
    o.start(t);
    o.stop(t + 0.25);
  }

  const SOUNDS = {
    count: () => tone('square', 880, 0.3, 0.25),
    go: () => tone('square', 1760, 0.8, 0.25),
    // 周回（1周目・2周目を走り終えたとき）: 「ピロリーン」。ピ・ロ・リと速く上がって、最後の音を長くのばす（2026-10-15 のユーザー依頼）
    lap: () => pirorin([84, 88, 91], 96, 0.9),
    // 最後の周に入るとき: 同じ「ピロリーン」を少し高く、和音で華やかに
    finalLap: () => {
      pirorin([86, 90, 93], 98, 1.1);
      tone('triangle', midiToHz(94), 1.1, 0.06, { at: 0.24 });
    },
    // ゴールのファンファーレ: ド・ミ・ソと上がって、0.36秒後に高い和音をのばす
    finish: () => {
      arpeggio([72, 76, 79], 0.12, 0.2, 0.15);
      [84, 88, 91].forEach((m) => tone('square', midiToHz(m), 1.4, 0.1, { at: 0.36 }));
    },
    // ちょっと悲しいファンファーレ（4位以下）: ミ・レ・ドと下がって、ラ・ド・ミ（A マイナー）をのばす
    finishSad: () => {
      [76, 74, 72].forEach((m, i) => tone('triangle', midiToHz(m), 0.3, 0.18, { at: i * 0.22 }));
      [69, 72, 76].forEach((m) => tone('triangle', midiToHz(m), 1.6, 0.12, { at: 0.7 }));
    },
    spark: () => tone('sine', 1500, 0.12, 0.12, { to: 2200 }),
    boost: () => {
      burst('bandpass', 700, 3500, 0.4, 0.5);
      tone('sawtooth', 220, 0.4, 0.08, { to: 660 });
    },
    wall: () => {
      burst('lowpass', 400, 80, 0.2, 0.8);
      tone('sine', 90, 0.15, 0.3, { to: 50 });
    },
    // 車どうしでぶつかったとき「バン」: 低く響く音（はじめの着地の音を使う。2026-10-15 のユーザー依頼）
    bump: () => {
      burst('lowpass', 1600, 70, 0.6, 1.0);
      tone('sine', 90, 0.5, 0.6, { to: 35 });
      burst('highpass', 3000, 1500, 0.15, 0.25);
    },
    // ドリフトのボタンで跳ねたとき「ピヨン」: 高く上がって、少し戻る（2026-10-15 のユーザー依頼）
    hop: () => boing(),
    // ジャンプ台から着地したとき「ドッバーン」: もっと派手に（2026-10-15 のユーザー依頼）
    // 大きく長い「ドーン」＋地面がゆれる低い音＋シンバルのような「シャーン」＋はじける「バ」＋少し遅れたこだま
    land: () => {
      burst('lowpass', 3000, 60, 1.0, 0.85);
      tone('sine', 70, 0.9, 0.65, { to: 28 });
      burst('highpass', 7000, 2500, 1.1, 0.3);
      tone('square', 160, 0.25, 0.1, { to: 60 });
      burst('lowpass', 1500, 80, 0.5, 0.3, { at: 0.18 });
    },
  };

  return {
    play(name) {
      if (audio.ctx && SOUNDS[name]) SOUNDS[name]();
    },
    engine: {
      start() {
        const ctx = audio.ctx;
        if (!ctx || engine) return;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 900;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        filter.connect(gain).connect(audio.sfxOut);
        const oscs = [-8, 8].map((detune) => {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = 55;
          o.detune.value = detune;
          o.connect(filter);
          o.start();
          return o;
        });
        engine = { oscs, filter, gain };
      },
      // 毎フレーム呼ぶ（値をなめらかに近づけるだけ。物は作らない）
      update(speed, top, boosting) {
        if (!engine) return;
        const p = engineParams(speed, top, boosting);
        const t = audio.ctx.currentTime;
        for (const o of engine.oscs) o.frequency.setTargetAtTime(p.freq, t, 0.05);
        engine.gain.gain.setTargetAtTime(p.gain, t, 0.08);
      },
      stop() {
        if (!engine) return;
        for (const o of engine.oscs) o.stop();
        engine.gain.disconnect();
        engine = null;
      },
    },
    // ドリフトのキュルキュル（on のあいだ鳴る。speed01 は 0〜1 の速さ）
    drift(on, speed01 = 1) {
      const ctx = audio.ctx;
      if (!ctx) return;
      if (on && !squeal) {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer(ctx);
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2600;
        filter.Q.value = 6;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        src.connect(filter).connect(gain).connect(audio.sfxOut);
        src.start();
        squeal = { src, gain };
      }
      if (squeal) squeal.gain.gain.setTargetAtTime(on ? 0.12 * speed01 : 0, ctx.currentTime, 0.05);
      if (!on && squeal) {
        const s = squeal;
        squeal = null;
        s.src.stop(ctx.currentTime + 0.2);
        setTimeout(() => s.gain.disconnect(), 300);
      }
    },
    // タイトルへ戻る・一時停止・次のレースのとき: 鳴りつづける音を全部止める
    stopAll() {
      this.engine.stop();
      this.drift(false);
    },
  };
}
