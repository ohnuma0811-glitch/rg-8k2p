// レース中の表示（スピード計など）

// スピード計の数字: m/s を km/h の整数にして、3けた（足りない所は空白）
export function speedText(mps) {
  const kmh = Math.min(999, Math.round(Math.abs(mps) * 3.6));
  return String(kmh).padStart(3, ' ');
}
