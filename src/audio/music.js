// 曲: 楽譜のデータから音の並びを作り（テストできる）、OfflineAudioContext で一度だけ音にして、ループで流す
import { parseTrack, chordNotes, chordSteps, midiToHz } from './notes.js?v=ee5a8c1';
import { SONGS } from './songs.js?v=ee5a8c1';

// 16分音符1つの秒数と、曲1回分の秒数
export const stepSec = (song) => 60 / song.bpm / 4;
export const loopSec = (song) => song.bars * 16 * stepSec(song);

// 曲の音の並び: [{ t（秒）, dur（秒）, inst, midi? }]
export function songEvents(song) {
  const s = stepSec(song);
  const ev = [];
  for (const n of parseTrack(song.lead).notes) ev.push({ t: n.step * s, dur: n.len * s * 0.9, inst: 'lead', midi: n.midi });
  for (const c of chordSteps(song.chords)) {
    // ハモリ（コードの3つの音を長くのばす）
    for (const midi of chordNotes(c.name, 4)) ev.push({ t: c.step * s, dur: c.len * s, inst: 'pad', midi });
    // ベース: 8分音符で、根音を低い・高いと交互に
    const root = chordNotes(c.name, 2)[0];
    for (let k = 0; k < c.len; k += 2) ev.push({ t: (c.step + k) * s, dur: s * 1.8, inst: 'bass', midi: root + ((k / 2) % 2 ? 12 : 0) });
  }
  for (let bar = 0; bar < song.bars; bar++) {
    for (const inst of ['kick', 'snare', 'hat']) {
      [...song.drums[inst]].forEach((c, k) => {
        if (c === 'x') ev.push({ t: (bar * 16 + k) * s, dur: s, inst });
      });
    }
  }
  return ev;
}

// 残響の余り（loopLen より後ろ）を曲の頭に重ねて、loopLen の長さにする（ループのつなぎ目で残響が切れない）
export function wrapTail(channels, loopLen) {
  return channels.map((data) => {
    const out = data.slice(0, loopLen);
    for (let i = loopLen; i < data.length; i++) out[(i - loopLen) % loopLen] += data[i];
    return out;
  });
}

export const FINAL_LAP_RATE = 1.12; // 最後の周は、曲をこの速さで流す
const REVERB_SEC = 1.5; // 残響の長さ

function defaultOffline(channels, length, sampleRate) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  return new OAC(channels, length, sampleRate);
}

// 曲を音にする（ゲームを開いたあとに一度だけ）。作れない端末では null
export async function renderSong(song, { sampleRate = 22050, makeOffline = defaultOffline } = {}) {
  try {
    const loopLen = Math.round(loopSec(song) * sampleRate);
    const ctx = makeOffline(2, loopLen + Math.round(REVERB_SEC * sampleRate), sampleRate);
    const out = ctx.createDynamicsCompressor();
    out.connect(ctx.destination);
    const dry = ctx.createGain();
    dry.gain.value = 0.8;
    dry.connect(out);
    // 残響: 雑音がだんだん小さくなる響き
    const verb = ctx.createConvolver();
    const ir = ctx.createBuffer(2, Math.round(REVERB_SEC * sampleRate), sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
    }
    verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.2;
    dry.connect(verb).connect(wet).connect(out);
    const noise = ctx.createBuffer(1, sampleRate, sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    const play = makeInstruments(ctx, dry, noise, loopLen / sampleRate + REVERB_SEC);
    for (const e of songEvents(song)) play(e);
    const rendered = await ctx.startRendering();
    const chans = wrapTail([rendered.getChannelData(0), rendered.getChannelData(1)], loopLen);
    const buf = ctx.createBuffer(2, loopLen, sampleRate);
    chans.forEach((d, ch) => buf.getChannelData(ch).set(d));
    return buf;
  } catch {
    return null;
  }
}

// 楽器: 楽器ごとに鳴りっぱなしの発振器（または雑音）を1組だけ作り、音ごとに高さと音量の山を書きこむ
// （音ごとに物を作ると、曲を作るのに何秒もかかる。昔のゲーム機と同じやり方で、ずっと速い）
function makeInstruments(ctx, dest, noise, end) {
  // 音量の山: アタック → 少し下がってのばす → 消える（前の音の余りは、次の音の頭で切る）
  function envelope(param, t, dur, peak, attack = 0.01, release = 0.08) {
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + attack);
    param.setTargetAtTime(peak * 0.7, t + attack, dur * 0.3);
    param.setTargetAtTime(0, t + dur, release / 3);
  }
  // 高さのある楽器（1つのメロディだけを鳴らす）。detunes の数だけ少しずらした音を重ねる
  function tonal(type, detunes, cutoff) {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(dest);
    let input = gain;
    if (cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      f.connect(gain);
      input = f;
    }
    const oscs = detunes.map((detune) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.detune.value = detune;
      o.connect(input);
      o.start(0);
      o.stop(end);
      return o;
    });
    return { oscs, gain: gain.gain };
  }
  // 雑音の楽器（スネア・ハイハット）
  function noisy(cutoff) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(f).connect(gain).connect(dest);
    src.start(0);
    src.stop(end);
    return gain.gain;
  }
  const lead = tonal('square', [-8, 8], 3000);
  const pads = [0, 1, 2].map(() => tonal('triangle', [0], 0));
  const bass = tonal('square', [0], 700);
  const kick = tonal('sine', [0], 0);
  const snareBody = tonal('triangle', [0], 0);
  const snare = noisy(1800);
  const hat = noisy(7000);
  let padIndex = 0;

  return function play(e) {
    const { t, dur } = e;
    if (e.inst === 'lead') {
      for (const o of lead.oscs) o.frequency.setValueAtTime(midiToHz(e.midi), t);
      envelope(lead.gain, t, dur, 0.14);
    } else if (e.inst === 'pad') {
      // コードの3つの音は、3つの楽器に1つずつ
      const pad = pads[padIndex++ % 3];
      pad.oscs[0].frequency.setValueAtTime(midiToHz(e.midi), t);
      envelope(pad.gain, t, dur, 0.035, 0.08, 0.3);
    } else if (e.inst === 'bass') {
      bass.oscs[0].frequency.setValueAtTime(midiToHz(e.midi), t);
      envelope(bass.gain, t, dur, 0.13);
    } else if (e.inst === 'kick') {
      const f = kick.oscs[0].frequency;
      f.setValueAtTime(150, t);
      f.exponentialRampToValueAtTime(45, t + 0.12);
      kick.gain.setValueAtTime(0.7, t);
      kick.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    } else if (e.inst === 'snare') {
      snare.setValueAtTime(0.3, t);
      snare.exponentialRampToValueAtTime(0.0001, t + 0.14);
      snareBody.oscs[0].frequency.setValueAtTime(190, t);
      envelope(snareBody.gain, t, 0.05, 0.15);
    } else if (e.inst === 'hat') {
      hat.setValueAtTime(0.08, t);
      hat.exponentialRampToValueAtTime(0.0001, t + 0.035);
    }
  };
}

// 曲を流す: prepare で作っておき（一度だけ）、play でループ、setRate で速さ、stop でだんだん消す
export function createMusic(audio, { render = renderSong } = {}) {
  const made = new Map(); // 曲の名前 → Promise<AudioBuffer | null>
  let current = null; // { name, src, gain }
  let token = 0;

  function prepare(name) {
    if (!made.has(name)) made.set(name, render(SONGS[name]));
    return made.get(name);
  }

  function stop(fade = 0.4) {
    token++;
    if (!current || !audio.ctx) {
      current = null;
      return;
    }
    const { src, gain } = current;
    const t = audio.ctx.currentTime;
    gain.gain.setTargetAtTime(0, t, fade / 3);
    src.stop(t + fade + 0.1);
    current = null;
  }

  async function play(name) {
    if (current && current.name === name) return;
    stop();
    const my = token;
    const buf = await prepare(name);
    if (my !== token || !buf || !audio.ctx || !audio.musicOut) return; // 待っている間に別の曲に変わった、または作れなかった
    const ctx = audio.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.setTargetAtTime(1, ctx.currentTime, 0.1);
    src.connect(gain).connect(audio.musicOut);
    src.start();
    current = { name, src, gain };
  }

  function setRate(rate) {
    if (current && audio.ctx) current.src.playbackRate.setTargetAtTime(rate, audio.ctx.currentTime, 0.3);
  }

  return { prepare, play, setRate, stop };
}
