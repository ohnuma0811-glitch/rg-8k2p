import { stageVisible } from '../../game/world.js?v=0e5d133';
// root.userData.stageGroups の群れの見え方を決める（毎フレーム。変わったときだけ visible を書く）
export function applyStageVisibility(root, cur, autoId) {
  for (const g of root.userData.stageGroups ?? []) {
    const v = stageVisible(g.userData.stages, cur, autoId);
    if (g.visible !== v) g.visible = v;
  }
}
