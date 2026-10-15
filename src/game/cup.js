// 大会（2026-10-14 のユーザー依頼）: 全部のレースのポイントの合計で優勝を決める
// レースの数は、できているコースの数（2026-10-15 のユーザー依頼。今は2レース、最後は5レース）
import { racePoints } from './race.js?v=8d6c692';

// count 台の大会を races レースで。車の番号（0〜count-1）は、どのレースでも同じ人・同じ CPU
export function createCup(count, races) {
  return {
    races,
    done: 0, // 走り終えたレースの数
    totals: Array(count).fill(0), // 合計ポイント
    gained: Array(count).fill(0), // 直前のレースで取ったポイント
    lastPlace: Array(count).fill(0), // 直前のレースの順位（1〜）
  };
}

// レースの結果を足す。order は車の番号を1位から順に並べたもの
export function addRace(cup, order) {
  order.forEach((k, n) => {
    const p = racePoints(n + 1);
    cup.totals[k] += p;
    cup.gained[k] = p;
    cup.lastPlace[k] = n + 1;
  });
  cup.done += 1;
}

// 合計ポイントの順に並べた車の番号。同じなら、直前のレースで上だった方を上に
export function standings(cup) {
  return cup.totals
    .map((_, k) => k)
    .sort((a, b) => cup.totals[b] - cup.totals[a] || cup.lastPlace[a] - cup.lastPlace[b]);
}

export function isOver(cup) {
  return cup.done >= cup.races;
}

// 次に走るコース（1レース目から順に、コースの一覧の順）
export function courseOf(courses, cup) {
  return courses[cup.done % courses.length];
}
