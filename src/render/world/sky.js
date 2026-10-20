// ステージごとの空・霧・光（Global City）。宇宙・ワープ・海の底は特別
import { autoViewOf } from '../../game/world.js?v=cd7c3b4';
const SKIES = {
  0: { sky: 0x9fd4ff, fog: [300, 1400], hemi: 1.6, sun: 1.4 }, // 東京: 春の青空
  1: { sky: 0x9fd4ff, fog: [400, 2200], hemi: 1.6, sun: 1.4 }, // 富士山（遠くまで見える）
  2: { sky: 0xa8d8ff, fog: [300, 1400], hemi: 1.6, sun: 1.4 }, // 京都
  3: { sky: 0x0a0a1e, fog: [200, 1100], hemi: 0.55, sun: 0.25 }, // 香港: 夜
  4: { sky: 0x0b3d66, fog: [20, 220], hemi: 0.9, sun: 0.5 }, // 海の底: 青く暗い水
  5: { sky: 0x8fcfff, fog: [300, 1400], hemi: 1.6, sun: 1.4 }, // ニューヨーク: 昼
  6: { sky: 0x3a2050, fog: [250, 1300], hemi: 0.8, sun: 0.6 }, // クアラルンプール: 夕方から夜
};
export function skyFor(track, cur, kart) {
  const view = autoViewOf(kart);
  if (view === 'space') return { sky: 0x000000, fog: [3000, 6000], hemi: 1.0, sun: 1.2, mode: 'space' };
  if (view === 'warp') return { sky: 0x050818, fog: [3000, 6000], hemi: 1.0, sun: 0.8, mode: 'warp' };
  const s = SKIES[cur] ?? SKIES[0];
  return { ...s, mode: cur === 4 && (kart.y ?? 0) < -2 ? 'sea' : 'normal' };
}
