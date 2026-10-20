// Global City（2026-10-20）: 世界の都市のコースの、動かない決まり
// 景色の群れ（ステージの番号の配列。自動の区間の景色は 'space' 'warp'）が、今見えるか
// 今のステージとその前後だけ（遠くの都市は描かない。軽くするため）。宇宙・ワープの間は、その景色だけ
export function stageVisible(groupStages, cur, autoId) {
  if (autoId === 'space' || autoId === 'warp') return groupStages.includes(autoId);
  return groupStages.some((k) => typeof k === 'number' && Math.abs(k - cur) <= 1);
}
