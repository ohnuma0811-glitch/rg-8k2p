// 曲: 楽譜のデータから音の並びを作り（テストできる）、OfflineAudioContext で一度だけ音にして、ループで流す
import { parseTrack, chordNotes, chordSteps } from './notes.js';

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
