// レース中の表示（スピード計など）

// スピード計は、速く見えるよう実際の1.5倍で出す（最高速 時速約148km → 221 と表示。表示だけで、車の速さは変えない）
export const SPEED_SHOW = 1.5;

// スピード計の数字: m/s を km/h の整数（1.5倍）にして、3けた（足りない所は空白）
export function speedText(mps) {
  const kmh = Math.min(999, Math.round(Math.abs(mps) * 3.6 * SPEED_SHOW));
  return String(kmh).padStart(3, ' ');
}
