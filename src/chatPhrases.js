// 待合室のチャットの定型文（設計書 docs/superpowers/specs/2026-10-22-lobby-design.md の 5章）。[English, 日本語]
// 送るのは番号だけ。受け取った端末が、読む人の言語の文にする。順番を変えると、前に送った番号の意味が変わるので、足すときは最後に足す
export const PHRASES = [
  ['Press READY!', 'READYを おして！'],
  ["Let's call on LINE!", 'LINEを つなごうよ！'],
  ["Let's call on WhatsApp!", 'WhatsAppを つなごうよ！'],
  ['Hello!', 'こんにちは！'],
  ['Ready?', 'じゅんび できた？'],
  ["Let's go!", 'いくよ！'],
  ['Wait a sec!', 'ちょっと まって！'],
  ['One more!', 'もう いっかい！'],
  ['Good game!', 'いいしょうぶだった！'],
  ['Nice!', 'ナイス！'],
  ['So close!', 'おしい！'],
  ["I'll win next time!", 'つぎは まけないよ！'],
  ['Bye!', 'またね！'],
];

export function phrase(n, lang) {
  const p = PHRASES[n];
  return p ? p[lang === 'ja' ? 1 : 0] : '';
}

// 最初の言語: 端末の言語が日本語なら日本語、それ以外は English
export function defaultLang(navLang) {
  return /^ja/i.test(navLang ?? '') ? 'ja' : 'en';
}

// コースが決まったときの知らせ
export function pickedText(courseName, count, lang) {
  if (lang === 'ja') return `${courseName} — ${count}人がえらびました！`;
  return `${courseName} — ${count} ${count === 1 ? 'player' : 'players'} picked!`;
}
