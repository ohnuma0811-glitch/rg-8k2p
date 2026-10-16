// 効果音（その場でプログラムから作って鳴らす）と、鳴りつづける音（エンジン・ドリフトのキュルキュル）
// audio.ctx がない（音が使えない・まだタップしていない）ときは、何もしない
import { midiToHz } from './notes.js';
import { engineParams, DRIFT_VOLUME, WALL_VOLUME } from './mix.js';

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

  // 気絶したような「ピヨピヨ」（バンプで転がって走れない3秒の間。2026-10-15 のユーザー依頼）
  // 高い2つの音を小鳥がさえずるようにくり返す。一時停止で止められるよう、専用のつなぎ口（piyo）を通す
  let piyo = null;
  function piyoPiyo(at, times) {
    const ctx = audio.ctx;
    if (piyo) piyo.disconnect();
    piyo = ctx.createGain();
    piyo.connect(audio.sfxOut);
    const bus = piyo;
    const chirp = (t, f) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 1.35, t + 0.06);
      o.frequency.exponentialRampToValueAtTime(f * 1.1, t + 0.11);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + 0.15);
    };
    const t0 = ctx.currentTime + at;
    for (let k = 0; k < times; k++) {
      chirp(t0 + k * 0.25, 2200);
      chirp(t0 + k * 0.25 + 0.12, 2700);
    }
    setTimeout(() => {
      if (piyo === bus) {
        bus.disconnect();
        piyo = null;
      }
    }, (at + times * 0.25 + 0.5) * 1000);
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
    // 加速（赤い煙のドリフトのあとのミニターボ、スタートダッシュ）: 高く伸び上がる「シュイーン」（2026-10-15 のユーザー依頼）
    boost: () => {
      burst('bandpass', 600, 5000, 0.7, 0.45); // 風を切る「シュ」
      tone('sawtooth', 300, 0.75, 0.07, { to: 1600 }); // 「イーン」と伸び上がる音
      tone('square', 600, 0.75, 0.04, { to: 3200 }); // 1オクターブ上を重ねて、キラッと
    },
    // 壁にぶつかったとき: 低い「ドン」に、スマホのスピーカーでも聞こえる中くらいの高さの「ガン」を重ねる
    wall: () => {
      const v = WALL_VOLUME;
      burst('lowpass', 400, 80, 0.2, 0.45 * v);
      tone('sine', 90, 0.15, 0.18 * v, { to: 50 });
      burst('bandpass', 1500, 500, 0.15, 0.3 * v);
      tone('square', 260, 0.1, 0.1 * v, { to: 130 });
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
      burst('bandpass', 2500, 600, 0.12, 0.7); // 着いた瞬間の鋭い「バン」（スマホでも聞こえる高さ）
      burst('lowpass', 3000, 60, 1.0, 0.8);
      tone('sine', 70, 0.9, 0.6, { to: 28 });
      burst('highpass', 7000, 2500, 1.1, 0.3);
      tone('square', 160, 0.25, 0.1, { to: 60 });
      burst('lowpass', 1500, 80, 0.5, 0.15, { at: 0.2 }); // こだま（小さく）
    },
    // バンプの警告「ピッピッ」（高く短い音を2回）
    bumpWarn: () => {
      tone('square', 1320, 0.09, 0.18);
      tone('square', 1320, 0.09, 0.18, { at: 0.14 });
      tone('square', 1760, 0.12, 0.12, { at: 0.28 });
    },
    // バンプを乗り越える「コトン」（小さく）
    hump: () => {
      tone('triangle', 180, 0.08, 0.25, { to: 120 });
      burst('lowpass', 900, 300, 0.05, 0.15);
    },
    // スクールバスとすれちがう「ブウウーン」（2026-10-16 のユーザー依頼）: 低いエンジンの音が近づいて大きくなり、
    // すれちがうと高さが少し下がって（ドップラー）遠ざかる
    busPass: () => {
      const ctx = audio.ctx;
      const t = ctx.currentTime;
      const low = ctx.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = 420;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.55);
      g.gain.setValueAtTime(0.5, t + 0.7);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
      low.connect(g).connect(audio.sfxOut);
      for (const f of [58, 87]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(f * 1.12, t);
        o.frequency.setValueAtTime(f * 1.12, t + 0.6);
        o.frequency.exponentialRampToValueAtTime(f * 0.82, t + 1.0);
        o.connect(low);
        o.start(t);
        o.stop(t + 1.7);
      }
    },
    // イノシシが飛び出す前の「ブヒッ」: のこぎりの波を、低い所から上げて下げる（0.25秒。2026-10-16）
    boarWarn: () => {
      const ctx = audio.ctx;
      const t = ctx.currentTime;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 900;
      band.Q.value = 1.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.4, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      band.connect(g).connect(audio.sfxOut);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(180, t);
      o.frequency.linearRampToValueAtTime(340, t + 0.08);
      o.frequency.exponentialRampToValueAtTime(150, t + 0.25);
      o.connect(band);
      o.start(t);
      o.stop(t + 0.26);
    },
    // サルが投げるときの「キキッ」: 高い三角の波を2回、すばやく上げ下げ（2026-10-16）
    monkey: () => {
      const ctx = audio.ctx;
      const t0 = ctx.currentTime;
      for (const d of [0, 0.13]) {
        const t = t0 + d;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.28, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        g.connect(audio.sfxOut);
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(1300, t);
        o.frequency.linearRampToValueAtTime(2300, t + 0.04);
        o.frequency.exponentialRampToValueAtTime(1100, t + 0.1);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.11);
      }
    },
    // 恐竜に食べられた「ぎゃーーー」（ファイルがないときの代わり）: 高い声のような音を、ふるわせながら下げる
    eaten: () => {
      const ctx = audio.ctx;
      const t = ctx.currentTime;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 1400;
      band.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.45, t + 0.05);
      g.gain.setValueAtTime(0.45, t + 1.0);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
      band.connect(g).connect(audio.sfxOut);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(700, t);
      o.frequency.linearRampToValueAtTime(900, t + 0.15);
      o.frequency.exponentialRampToValueAtTime(380, t + 1.6);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 9;
      const depth = ctx.createGain();
      depth.gain.value = 40;
      lfo.connect(depth).connect(o.frequency);
      o.connect(band);
      o.start(t);
      lfo.start(t);
      o.stop(t + 1.65);
      lfo.stop(t + 1.65);
    },
    // ぬかるみのスリップの音（4秒）: タイヤが空回りするような「キュルキュル」と、泥の「ビチャビチャ」をゆらしながら
    mudSlip: () => {
      const ctx = audio.ctx;
      const t = ctx.currentTime;
      const dur = 4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.32, t + 0.1);
      g.gain.setValueAtTime(0.32, t + dur - 0.6);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      g.connect(audio.sfxOut);
      // キュルキュル: 高めの三角の波を、速くゆらす
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 1150;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 7;
      const depth = ctx.createGain();
      depth.gain.value = 260;
      lfo.connect(depth).connect(o.frequency);
      const og = ctx.createGain();
      og.gain.value = 0.35;
      o.connect(og).connect(g);
      // ビチャビチャ: 雑音を低めのフィルターに通し、フィルターをゆらす
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx);
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 500;
      f.Q.value = 2;
      const lfo2 = ctx.createOscillator();
      lfo2.frequency.value = 4;
      const d2 = ctx.createGain();
      d2.gain.value = 250;
      lfo2.connect(d2).connect(f.frequency);
      src.connect(f).connect(g);
      for (const n of [o, lfo, lfo2, src]) {
        n.start(t);
        n.stop(t + dur);
      }
    },
    // 木の実が当たった「コツン」: 短い木の音（高めの三角の波、0.06秒）
    nutHit: () => {
      const ctx = audio.ctx;
      const t = ctx.currentTime;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      g.connect(audio.sfxOut);
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(900, t);
      o.frequency.exponentialRampToValueAtTime(600, t + 0.06);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.07);
    },
    // スクールバスにぶつかった音（車どうしの「バン」と同じ）
    busHit: () => SOUNDS.bump(),
    // 牛にぶつかった「モー」: のこぎりの波2つを、口の形のようなバンドパスに通し、ゆっくり下げる
    moo: () => {
      const ctx = audio.ctx;
      const t = ctx.currentTime;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.setValueAtTime(500, t);
      band.frequency.linearRampToValueAtTime(700, t + 0.3);
      band.frequency.linearRampToValueAtTime(450, t + 0.9);
      band.Q.value = 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.35, t + 0.1);
      g.gain.setValueAtTime(0.35, t + 0.6);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.95);
      band.connect(g).connect(audio.sfxOut);
      for (const f of [110, 112]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(f, t);
        o.frequency.linearRampToValueAtTime(f * 1.08, t + 0.25);
        o.frequency.exponentialRampToValueAtTime(f * 0.86, t + 0.9);
        o.connect(band);
        o.start(t);
        o.stop(t + 1);
      }
    },
    // バンプで転がる: ジャンプ台の着地と同じ作りの派手な「バーン」と、0.4秒あとから「ピヨピヨ」（走れない1秒の間）
    tumble: () => {
      burst('bandpass', 2500, 600, 0.12, 0.85);
      burst('lowpass', 3000, 60, 1.0, 0.95);
      tone('sine', 70, 0.9, 0.7, { to: 28 });
      burst('highpass', 7000, 2500, 1.1, 0.35);
      tone('square', 160, 0.25, 0.12, { to: 60 });
      piyoPiyo(0.4, 3);
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
      if (squeal) squeal.gain.gain.setTargetAtTime(on ? DRIFT_VOLUME * speed01 : 0, ctx.currentTime, 0.05);
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
      if (piyo) {
        piyo.disconnect();
        piyo = null;
      }
    },
  };
}
