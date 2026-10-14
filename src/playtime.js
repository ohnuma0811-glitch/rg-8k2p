// 遊べる時間（名前が KYUGO・SOKI のときだけ、1日20分まで）。M2 は端末の中で数える（M4 でサーバーにも記録する）
// 1日の区切りは日本時間の深夜2時（深夜2時から次の深夜2時までの24時間）
export const LIMITED_NAMES = ['KYUGO', 'SOKI'];
export const DEFAULT_LIMIT_MIN = 20;
const JST = 9 * 3600 * 1000;
const DAY_START = 2 * 3600 * 1000; // 深夜2時

// その時刻が属する「1日」の名前（日本時間の深夜2時で区切った日付。例 '2026-10-14'）
export function dayKey(nowMs) {
  const d = new Date(nowMs + JST - DAY_START);
  return d.toISOString().slice(0, 10);
}

export function isLimited(name) {
  return LIMITED_NAMES.includes(name);
}

// 使った秒数。store は { 日付: { 名前: 秒 } }
export function usedSec(store, name, nowMs) {
  return store[dayKey(nowMs)]?.[name] ?? 0;
}

// 残りの秒数。制限のない名前は Infinity
export function remainingSec(store, name, nowMs, limitMin = DEFAULT_LIMIT_MIN) {
  if (!isLimited(name)) return Infinity;
  return Math.max(0, limitMin * 60 - usedSec(store, name, nowMs));
}

// 遊んだ秒数を足す（制限のない名前は記録しない）。古い日の記録は消す
export function addPlay(store, name, nowMs, sec) {
  if (!isLimited(name) || sec <= 0) return store;
  const key = dayKey(nowMs);
  const today = { ...(store[key] ?? {}) };
  today[name] = (today[name] ?? 0) + sec;
  return { [key]: today };
}

// 画面に出す残り時間（1分を切ったら秒で）
export function remainingText(sec) {
  if (sec === Infinity) return '';
  if (sec < 60) return `Today: ${Math.ceil(sec)} sec left`;
  return `Today: ${Math.floor(sec / 60)} min left`;
}
