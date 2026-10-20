import { sampleAt, stageAt } from './track.js';
// Global City（2026-10-20）: 世界の都市のコースの、動かない決まり
// 景色の群れ（ステージの番号の配列。自動の区間の景色は 'space' 'warp'）が、今見えるか
// 今のステージとその前後だけ（遠くの都市は描かない。軽くするため）。宇宙・ワープの間は、その景色だけ
export function stageVisible(groupStages, cur, autoId) {
  if (autoId === 'space' || autoId === 'warp') return groupStages.includes(autoId);
  return groupStages.some((k) => typeof k === 'number' && Math.abs(k - cur) <= 1);
}

// 自動の区間の景色（Global City）: 宇宙は高さ 150m より上だけ、ワープは3つ目の輪っかを過ぎてから（leg 2）。ほかは null（ふつうのステージの景色）
export function autoViewOf(kart) {
  const a = kart.auto;
  if (!a) return null;
  if (a.id === 'space') return kart.y >= 150 ? 'space' : null;
  if (a.id === 'warp') return a.leg >= 2 ? 'warp' : null;
  return a.id;
}

// 見せるステージ（Global City）: ふつうは今のステージ。宇宙から下りてくる後半は、着く所（香港）のステージ
// （京都の青空が一瞬出てから香港の夜になった。最後のレビュー）
export function viewStage(track, kart, cur) {
  const st = kart.auto;
  if (st?.id !== 'space') return cur;
  const leg = track.autos.find((a) => a.id === st.id)?.legs[st.leg];
  return leg && st.t > leg.time / 2 ? stageAt(track, leg.to) : cur;
}

// 新幹線（2026-10-20）: 万能タイプの最高速の SHINKANSEN_FACTOR 倍で、線路（道の横 off m、高さ y）を走る。
// 並走の道の加速板（最高速の 1.3倍）なら追いぬける（2026-10-20 のユーザー依頼）
export const SHINKANSEN_FACTOR = 1.12;
export function shinkansenPose(track, train, time, topSpeed) {
  const len = train.to - train.from;
  const s = train.from + ((((train.s0 + topSpeed * SHINKANSEN_FACTOR * time - train.from) % len) + len) % len);
  const p = sampleAt(track, s);
  return { x: p.x - Math.sin(p.h) * train.off, y: train.y, z: p.z + Math.cos(p.h) * train.off, heading: p.h };
}
