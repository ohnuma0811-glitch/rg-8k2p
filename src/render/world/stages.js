import { stageVisible } from '../../game/world.js?v=3562af2';
import { stageAt } from '../../game/track.js?v=3562af2';
// root.userData.stageGroups の群れの見え方を決める（毎フレーム。変わったときだけ visible を書く）
export function applyStageVisibility(root, cur, autoId, win = null) {
  for (const g of root.userData.stageGroups ?? []) {
    const v = stageVisible(g.userData.stages, cur, autoId, win);
    if (g.visible !== v) g.visible = v;
  }
}

// 動く物（乗り物・亀）を、道の s の所のステージの群れに入れる（遠くのステージから見えないように。2026-10-22 のユーザー依頼「お台場から NY のタクシーが見える」）
export function attachStage(root, track, model, s) {
  if (!track.stages?.length) return;
  model.userData.stages = [stageAt(track, s)];
  (root.userData.stageGroups ??= []).push(model);
}
