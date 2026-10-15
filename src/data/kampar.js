// Kampar Town の景色の置き場所（設計書 4・4.1）。part は src/render/town の部品の名前
// at / from / to は区間の印からの割合（src/game/track.js の markS）、every は並べる間（m）
// side は -1 左・1 右・0 真ん中（分離帯の上）、back は道のふちから奥へ（m）、radius は置く物の大きさ（ほかの道にかからないか調べる）
// 写真の番号は docs/reference/kampar/ のファイル名
export const KAMPAR_SCENERY = [
  // とくに大事な景色（設計書 4.1。再現度を高く）
  { part: 'footbridge', at: ['S', 'A', 0.15], side: 1, back: 0, radius: 2 }, // スタートの近くの歩道橋（02）
  { part: 'westlakeVillas', at: ['E', 'F', 0.85], side: -1, back: 30, radius: 20 }, // F の手前の左の高いマンション（40〜42F）
  { part: 'westlakeSchool', at: ['F', 'G', 0.45], side: -1, back: 3, radius: 20 }, // F〜H の左の学校（44〜48）
  { part: 'hospitalUtar', at: ['G', 'H', 0.12], side: -1, back: 6, radius: 20 }, // UTAR の病院（49・50・60G）
  { part: 'kamparSign', at: ['J', 'S', 0.3], side: -1, back: 3, radius: 12 }, // KAMPAR の看板（75J右・76）
  { part: 'pipeBridge', at: ['J', 'S', 0.75], side: 1, back: 2, radius: 8 }, // 川と水道管の橋（77）

  // スタート〜A（01〜06）: 分離帯のある広い道。左は草むらとやぶ、右は低い建物。分離帯に街灯
  { part: 'bush', from: ['S', 'A', 0.05], to: ['S', 'A', 0.95], every: 9, side: -1, back: 2, radius: 2 },
  { part: 'tree', from: ['S', 'A', 0.1], to: ['S', 'A', 0.9], every: 18, side: -1, back: 6, radius: 3, color: 0x2f7a2c },
  { part: 'lamp', from: ['S', 'A', 0.1], to: ['S', 'A', 0.85], every: 30, side: 0, radius: 1 },
  { part: 'shophouse', from: ['S', 'A', 0.55], to: ['S', 'A', 0.85], every: 7, side: 1, back: 3, radius: 7, floors: 2, color: 0xe6e2da },
  { part: 'tree', from: ['S', 'A', 0.1], to: ['S', 'A', 0.5], every: 16, side: 1, back: 3, radius: 3 },

  // A〜B（07〜14B）: ショップハウスの町なか。右にファストフード店とガソリンスタンド
  { part: 'shophouse', from: ['A', 'B', 0.1], to: ['A', 'B', 0.35], every: 6, side: 1, back: 2, radius: 7 },
  { part: 'shophouse', from: ['A', 'B', 0.1], to: ['A', 'B', 0.35], every: 6, side: -1, back: 2, radius: 7, color: 0xf2f0ea },
  { part: 'fastFood', at: ['A', 'B', 0.62], side: 1, back: 3, radius: 8 },
  { part: 'petrolStation', at: ['A', 'B', 0.88], side: 1, back: 3, radius: 9 },
  { part: 'tree', from: ['A', 'B', 0.6], to: ['A', 'B', 0.95], every: 14, side: -1, back: 3, radius: 3 },

  // B〜C（15〜19C）: ヤシの並木の分離帯と、赤い屋根の3階建てショップハウスの並び
  { part: 'palm', from: ['B', 'C', 0.2], to: ['B', 'C', 0.8], every: 12, side: 0, radius: 1 },
  { part: 'shophouse', from: ['B', 'C', 0.1], to: ['B', 'C', 0.9], every: 6, side: -1, back: 2, radius: 7, color: 0xeee4d0 },
  { part: 'shophouse', from: ['B', 'C', 0.1], to: ['B', 'C', 0.9], every: 6, side: 1, back: 2, radius: 7, color: 0xf3ead8 },

  // C〜D（20〜25）: レンガの道。白黒の木組みのショップハウス
  { part: 'timberHouse', from: ['C', 'D', 0.1], to: ['C', 'D', 0.9], every: 7, side: -1, back: 2, radius: 7 },
  { part: 'shophouse', from: ['C', 'D', 0.1], to: ['C', 'D', 0.9], every: 6, side: 1, back: 2, radius: 7, color: 0xc77b5a },

  // D〜E（26〜34）: 学校の横の道。学校の塀と、青い屋根の屋根付き通路。右は2階建ての家
  { part: 'wall', from: ['D', 'E', 0.15], to: ['D', 'E', 0.95], every: 10, side: -1, back: 1, radius: 2, length: 10, color: 0x2a5fb8, pattern: 'school' },
  { part: 'walkway', from: ['D', 'E', 0.2], to: ['D', 'E', 0.9], every: 13, side: -1, back: 5, radius: 3, length: 12 },
  { part: 'shophouse', from: ['D', 'E', 0.1], to: ['D', 'E', 0.9], every: 7, side: 1, back: 3, radius: 7, floors: 2, color: 0xf0ece4 },

  // E〜F（35E〜42F）: 白いテントの並び、家、木
  { part: 'tent', from: ['E', 'F', 0.1], to: ['E', 'F', 0.45], every: 6, side: 1, back: 3, radius: 3 },
  { part: 'tree', from: ['E', 'F', 0.1], to: ['E', 'F', 0.9], every: 15, side: -1, back: 3, radius: 3 },
  { part: 'shophouse', from: ['E', 'F', 0.5], to: ['E', 'F', 0.9], every: 7, side: 1, back: 3, radius: 7, floors: 2, color: 0xe8e2d4 },

  // F〜G（43〜60G）: 両側に木の並ぶ道。右は白い手すりの湖と、止まっている車
  { part: 'tree', from: ['F', 'G', 0.05], to: ['F', 'G', 0.9], every: 12, side: 1, back: 1, radius: 3 },
  { part: 'tree', from: ['F', 'G', 0.15], to: ['F', 'G', 0.7], every: 14, side: 0, radius: 1, crown: 0.45, height: 5 },
  { part: 'railing', from: ['F', 'G', 0.1], to: ['F', 'G', 0.9], every: 10, side: 1, back: 4, radius: 1, length: 10, color: 0xf2f2f2 },
  { part: 'car', from: ['F', 'G', 0.2], to: ['F', 'G', 0.8], every: 9, side: 1, back: 1.5, radius: 2, color: 0xc8c8c8 },
  { part: 'lake', at: ['F', 'G', 0.5], side: 1, back: 6, radius: 4, width: 110, depth: 70 },

  // G〜H（61右〜62右H）: 大学の建物と木。右は湖
  { part: 'tree', from: ['G', 'H', 0.3], to: ['G', 'H', 0.95], every: 14, side: 1, back: 2, radius: 3 },
  { part: 'tree', from: ['G', 'H', 0.3], to: ['G', 'H', 0.85], every: 16, side: 0, radius: 1, crown: 0.45, height: 5 },
  { part: 'tower', from: ['G', 'H', 0.55], to: ['G', 'H', 0.95], every: 40, side: -1, back: 8, radius: 12, floors: 3, width: 34, depth: 16, color: 0xf0f0ee, stripe: 0x9aa3ab },
  { part: 'lake', at: ['G', 'H', 0.6], side: 1, back: 8, radius: 4, width: 90, depth: 60 },

  // H〜I（63HI）: 大学の中。両側に大学の建物、木
  { part: 'tower', from: ['H', 'I', 0.1], to: ['H', 'I', 0.9], every: 45, side: 1, back: 8, radius: 12, floors: 3, width: 36, depth: 16, color: 0xf2f2f0, stripe: 0x8fa0ad },
  { part: 'tree', from: ['H', 'I', 0.05], to: ['H', 'I', 0.95], every: 15, side: -1, back: 3, radius: 3 },

  // I〜J（65〜75J）: Jalan Perdana。大きな木と止まっている車。左に大きな店、右に家具の店
  { part: 'tree', from: ['I', 'J', 0.05], to: ['I', 'J', 0.6], every: 18, side: -1, back: 2, radius: 3, height: 10 },
  { part: 'tree', from: ['I', 'J', 0.05], to: ['I', 'J', 0.6], every: 18, side: 1, back: 2, radius: 3, height: 10 },
  { part: 'car', from: ['I', 'J', 0.05], to: ['I', 'J', 0.5], every: 8, side: -1, back: 0.5, radius: 2, color: 0x9da7ad },
  { part: 'shed', at: ['I', 'J', 0.75], side: -1, back: 5, radius: 20 },
  { part: 'furnitureShop', at: ['I', 'J', 0.85], side: 1, back: 3, radius: 9 },

  // J〜スタート（76〜78）: 4階建ての古いショップハウス、木、やぶ
  { part: 'shophouse', from: ['J', 'S', 0.1], to: ['J', 'S', 0.25], every: 6, side: -1, back: 3, radius: 7, floors: 4, color: 0xe6dcc0 },
  { part: 'shophouse', from: ['J', 'S', 0.4], to: ['J', 'S', 0.6], every: 6, side: -1, back: 3, radius: 7, floors: 4, color: 0xc79a6a },
  { part: 'tree', from: ['J', 'S', 0.1], to: ['J', 'S', 0.9], every: 16, side: 1, back: 3, radius: 3 },
  { part: 'bush', from: ['J', 'S', 0.6], to: ['J', 'S', 0.95], every: 9, side: -1, back: 2, radius: 2 },
  { part: 'lamp', from: ['J', 'S', 0.15], to: ['J', 'S', 0.9], every: 30, side: 0, radius: 1 },
];
