// Kampar Town の景色の置き場所（設計書 4・4.1）。part は src/render/town の部品の名前
// at / from / to は区間の印からの割合（src/game/track.js の markS）、every は並べる間（m）
// side は -1 左・1 右・0 真ん中（分離帯の上）、back は道のふちから奥へ（m）、radius は置く物の大きさ（ほかの道にかからないか調べる）
export const KAMPAR_SCENERY = [
  { part: 'shophouse', from: ['A', 'B', 0.1], to: ['A', 'B', 0.35], every: 6, side: 1, back: 2, radius: 7 },
  { part: 'palm', from: ['B', 'C', 0.2], to: ['B', 'C', 0.8], every: 12, side: 0, radius: 1 },
];
