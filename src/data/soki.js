// Soki Forest の景色の置き場所（2026-10-16 の設計書 docs/superpowers/specs/2026-10-16-soki-forest-design.md の 4）
// at / from / to は区間の印からの割合（src/game/track.js の markS）、every は並べる間（m）
// 分かれ道の上は path: 'middle' / 'inner' と、その道の上の割合（at: ['middle', 0.5]、from: 0.1, to: 0.9）
// side: -1 左、1 右。back: 道のふち（柵）からの奥行き（m）
const ROADSIDE = [
  { part: 'flowers', every: 40, back: 2, radius: 2 },
  { part: 'stump', every: 70, back: 3, radius: 1.5 },
  { part: 'bush', every: 30, back: 4, radius: 2 },
];

export const SOKI_SCENERY = [
  // スタートの丸太の門（2026-10-16 のユーザー依頼「Soki Forest」のように小文字も。森の名前の看板は置かない）
  { part: 'logGate', at: ['S', 'S', 0], side: 1, back: 1, span: 32, text: 'Soki Forest', radius: 1 },
  // 大きな丘の頂上の大きな木と、見晴らしの柵
  { part: 'bigTree', at: ['HILL', 'HILL', 0], side: -1, back: 14, radius: 9 },
  { part: 'lookoutFence', at: ['HILL', 'HILL', 0], side: -1, back: 14, radius: 9 },
  // きのこと岩の広場（スタートの右下。絵の、点のある四角の所）
  { part: 'mushroom', at: ['J2', 'S', 0.72], side: -1, back: 12, size: 2.6, radius: 4 },
  { part: 'mushroom', at: ['J2', 'S', 0.78], side: -1, back: 24, size: 3.2, radius: 5 },
  { part: 'mushroom', at: ['J2', 'S', 0.86], side: -1, back: 14, size: 2.2, radius: 4 },
  { part: 'rock', at: ['J2', 'S', 0.75], side: -1, back: 30, size: 1.6, radius: 4 },
  { part: 'rock', at: ['J2', 'S', 0.82], side: -1, back: 10, size: 1.2, radius: 3 },
  { part: 'rock', at: ['J2', 'S', 0.9], side: -1, back: 26, size: 1.8, radius: 4 },
  // 道ばたの花・切り株・しげみ（本線と分かれ道の両側）
  ...ROADSIDE.flatMap((r) => [-1, 1].flatMap((side) => [
    { ...r, side, from: ['S', 'J1', 0.1], to: ['J2', 'S', 0.6] },
    { ...r, side, path: 'middle', from: 0.05, to: 0.95 },
    { ...r, side, path: 'inner', from: 0.05, to: 0.95 },
  ])),
];
