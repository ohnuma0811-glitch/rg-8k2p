// キャラ8人（設計書 docs/superpowers/specs/2026-10-22-characters-design.md）。能力は 1〜5（速さへの直し方は src/game/stats.js）
// body: カートの色（8人で重ならない）。voice: ジャンプ台で飛ぶときの声（male: 「イヤッホー！」、female: 「おう！」）
export const CHARS = [
  { id: 'kyugo', name: 'Kyugo', stats: { accel: 3, top: 3, handling: 3 }, body: 0xc11f0a, voice: 'male' },
  { id: 'soki', name: 'Soki', stats: { accel: 3, top: 3, handling: 3 }, body: 0x1c3c88, voice: 'male' },
  { id: 'penguin', name: 'Penguin-man', stats: { accel: 3, top: 3, handling: 3 }, body: 0x4aa3df, voice: 'male' },
  { id: 'rabbit', name: 'Rabbit Girl', stats: { accel: 5, top: 2, handling: 3 }, body: 0xff7eb6, voice: 'female' },
  { id: 'mouse', name: 'Mouse Boy', stats: { accel: 5, top: 2, handling: 3 }, body: 0x2fa36b, voice: 'male' },
  // Tiger と Elephant は速いので、曲がりにくく（handling 2 → 1。2026-10-22 のユーザー依頼）
  { id: 'tiger', name: 'Big Tiger', stats: { accel: 2, top: 5, handling: 1 }, body: 0xe67e22, voice: 'male' },
  { id: 'elephant', name: 'Rampage Elephant', stats: { accel: 2, top: 5, handling: 1 }, body: 0x8e44ad, voice: 'male' },
  { id: 'cat', name: 'Lightning Cat', stats: { accel: 3, top: 2, handling: 5 }, body: 0xf5c400, voice: 'female' },
];

// id のキャラ。知らない id（古い保存など）は Kyugo
export function charOf(id) {
  return CHARS.find((c) => c.id === id) ?? CHARS[0];
}

// カートの色の文字（'#c11f0a'）
export function colorOf(c) {
  return `#${c.body.toString(16).padStart(6, '0')}`;
}

// 大会の CPU: 自分以外の7人から、かぶらない n 人（大会の最初に1回。2026-10-22 のユーザーの判断）
export function pickCpus(myId, n = 4, rand = Math.random) {
  const rest = CHARS.filter((c) => c.id !== myId).map((c) => c.id);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return rest.slice(0, n);
}

// 車の番号 k（0〜count-1）のキャラ。mySlot が自分、ほかは cpuIds の順
export function lineupOf(myId, cpuIds, count, mySlot) {
  let n = 0;
  return Array.from({ length: count }, (_, k) => (k === mySlot ? charOf(myId) : charOf(cpuIds[n++])));
}
