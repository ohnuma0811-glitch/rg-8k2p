// 音の高さと、曲の書き方（楽譜の文字）を読む部品
const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// 'C4' 'F#5' 'Bb3' → MIDI の番号（C4 = 60）
export function noteToMidi(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`音の名前がおかしい: ${name}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + NAMES[m[1]] + acc;
}

// MIDI の番号 → 周波数（Hz）。A4（69）= 440Hz
export function midiToHz(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

// 'E5:2 G5:2 R:4' → { notes: [{ step, len, midi }], steps }（長さは16分音符の数。R は休み）
export function parseTrack(text) {
  const notes = [];
  let step = 0;
  for (const tok of text.trim().split(/\s+/)) {
    const [name, lenText] = tok.split(':');
    const len = Number(lenText);
    if (!Number.isInteger(len) || len <= 0) throw new Error(`長さがおかしい: ${tok}`);
    if (name !== 'R') notes.push({ step, len, midi: noteToMidi(name) });
    step += len;
  }
  return { notes, steps: step };
}

// コードの名前（'C' 'Am' 'F#m' 'Bb'）→ 3つの音（根音は octave の高さ）
export function chordNotes(name, octave = 4) {
  const m = /^([A-G](#|b)?)(m?)$/.exec(name);
  if (!m) throw new Error(`コードの名前がおかしい: ${name}`);
  const root = noteToMidi(`${m[1]}${octave}`);
  return [root, root + (m[3] ? 3 : 4), root + 7];
}

// 1小節に1つか2つのコード（'F G' は前半が F、後半が G）→ [{ step, len, name }]
export function chordSteps(chords) {
  const out = [];
  chords.forEach((bar, i) => {
    const parts = bar.split(' ');
    const len = 16 / parts.length;
    parts.forEach((name, k) => out.push({ step: i * 16 + k * len, len, name }));
  });
  return out;
}
