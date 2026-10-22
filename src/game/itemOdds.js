// アイテムの出やすさ（設計書 docs/superpowers/specs/2026-10-22-items-design.md の 5章）。遊んで調整するのは、この表だけ
export const ITEMS = ['banana', 'green', 'shell', 'mushroom', 'star', 'lightning'];

const row = (banana, green, shell, mushroom, star, lightning) => ({ banana, green, shell, mushroom, star, lightning });

// 人の表（%）。上から 1位〜8位の行
export const HUMAN_ODDS = [
  row(45, 30, 20, 5, 0, 0),
  row(35, 30, 20, 15, 0, 0),
  row(25, 25, 20, 20, 5, 5),
  row(15, 20, 20, 30, 10, 5),
  row(10, 15, 20, 35, 15, 5),
  row(5, 10, 20, 35, 25, 5),
  row(0, 5, 20, 35, 35, 5),
  row(0, 0, 20, 35, 40, 5),
];

// CPU の表（%）。Shell と Green Shell は出ない。その分を Banana と Mushroom に足した（2026-10-22 のユーザー依頼）
const cpuRow = (banana, mushroom, star, lightning) => row(banana, 0, 0, mushroom, star, lightning);
export const CPU_ODDS = [
  cpuRow(70, 30, 0, 0),
  cpuRow(60, 40, 0, 0),
  cpuRow(47, 43, 5, 5),
  cpuRow(35, 50, 10, 5),
  cpuRow(27, 53, 15, 5),
  cpuRow(20, 50, 25, 5),
  cpuRow(12, 48, 35, 5),
  cpuRow(10, 45, 40, 5),
];

// 何番目の行を使うか（0〜7）。8台より少ないときは、1位は1位の行、最下位は8位の行、間は同じ割合の位置の行
export function oddsRow(rank, count) {
  if (count <= 1) return 0;
  return Math.round(((rank - 1) * 7) / (count - 1));
}

// 下半分の順位か（下から「台数 ÷ 2 の切り捨て」台）。Lightning はこのときだけ出る
export function lowerHalf(rank, count) {
  return rank > count - Math.floor(count / 2);
}

// その順位の出やすさ（%）。下半分でなければ、Lightning の分を Mushroom に足す
export function itemOdds(rank, count, cpu = false) {
  const odds = { ...(cpu ? CPU_ODDS : HUMAN_ODDS)[oddsRow(rank, count)] };
  if (!lowerHalf(rank, count)) {
    odds.mushroom += odds.lightning;
    odds.lightning = 0;
  }
  return odds;
}

// 箱を取った瞬間の順位からアイテムを決める（r は 0〜1 の数）
export function rollItem(rank, count, cpu = false, r = Math.random()) {
  const odds = itemOdds(rank, count, cpu);
  let x = r * 100;
  for (const it of ITEMS) {
    if (x < odds[it]) return it;
    x -= odds[it];
  }
  return 'mushroom';
}
