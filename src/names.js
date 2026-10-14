// 名前: アルファベットだけ、最大12文字、大文字。最近の名前は5件まで（最近のものが先頭）
export const NAME_MAX = 12;
export const RECENT_MAX = 5;

export function isValidName(name) {
  return typeof name === 'string' && /^[A-Z]{1,12}$/.test(name);
}

// 1文字足す（A〜Z だけ。12文字まで）
export function typeLetter(name, letter) {
  if (!/^[A-Z]$/.test(letter) || name.length >= NAME_MAX) return name;
  return name + letter;
}

export function addRecent(list, name) {
  if (!isValidName(name)) return list;
  return [name, ...list.filter((n) => n !== name)].slice(0, RECENT_MAX);
}
