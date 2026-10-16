// Kampar Town の景色の置き場所（設計書 3.0・4・4.1）。part は src/render/town の部品の名前
// at / from / to は区間の印からの割合（src/game/track.js の markS）、every は並べる間（m）
// side は -1 左・1 右・0 真ん中、back は道のふちから奥へ（m）、radius は置く物の大きさ（ほかの道にかからないか調べる）
// ahead: true は、直角の角の正面に続く道（角に入ってくる向きのまま、角の外の柵の先）
// 写真の番号は docs/reference/kampar/ のファイル名
export const KAMPAR_SCENERY = [
  // とくに大事な景色（設計書 4.1。再現度を高く）
  { part: 'footbridge', at: ['S', 'A', 0.15], side: 1, back: 0, radius: 2 }, // スタートの近くの歩道橋（02）
  { part: 'westlakeVillas', at: ['E', 'F', 0.85], side: -1, back: 2, radius: 20 }, // F の手前の左の高いマンション（40〜42F）
  { part: 'westlakeSchool', at: ['F', 'G', 0.67], side: -1, back: 1, radius: 20 }, // F〜G の左の学校（44〜48）。曲がってすぐでなく、ロータリー G の手前（2026-10-15 のユーザー依頼）
  { part: 'hospitalUtar', at: ['G', 'H', 0.7], side: -1, back: 1, radius: 20 }, // UTAR の病院（49・50・60G）。ロータリー G の先
  { part: 'kamparSign', at: ['J', 'J', 0], ahead: true, back: 5, radius: 18 }, // KAMPAR の看板（75J右・76）。T字路 J の正面（2026-10-15 のユーザー依頼）
  { part: 'pipeBridge', at: ['J', 'S', 0.75], side: 1, back: 2, radius: 8 }, // 川と水道管の橋（77）

  // 走ってくる車の方を向いた、道ばたの大きな看板（まっすぐ走っていても見えるように。2026-10-15 のユーザー依頼）
  // F（WestLake Villas の前の右折）の交差点の奥の右手に、学校へ行く向きの大きな看板「WIS→」（2026-10-16 のユーザー依頼）
  // corner: [u, w] は角からの場所（u は入ってくる向きに、w は曲がる向きと反対へ）。奥（u > 道の幅）の右手（w < -道の幅）
  { part: 'driverBoard', at: ['F', 'F', 0], corner: [24, -24], radius: 9, text: 'WIS →', bg: '#3b2a6b', width: 14, height: 5, top: 9 },
  // Grand Kampar Hotel の看板: B〜C を C へ向かって走るとき正面に見えるよう、C の正面（ふさいだ壁の向こう）の、
  // ホテルの右手に、走ってくる車の方へ向けて（2026-10-16 のユーザー依頼）。corner: [u, w]（w が負なのは曲がる向き＝ホテルの側）
  { part: 'driverBoard', at: ['C', 'C', 0], corner: [26, -10], radius: 9, text: 'Grand Kampar Hotel', bg: '#7a1f2b', fg: '#f2d48a', width: 16, height: 4, top: 10 },
  { part: 'driverBoard', at: ['I', 'J', 0.86], side: 1, back: 3, radius: 2, text: "Lotus's", bg: '#3fc1e8', width: 18, height: 4.4, top: 12 }, // J の手前のまっすぐな所（道がくねる所だと画面の外に出た）

  // スタートの左は山（2026-10-15 のユーザー依頼）
  { part: 'hill', at: ['S', 'A', 0.1], side: -1, back: 12, radius: 30 },

  // 道の上の大きな横断幕（場所が分かるように。2026-10-15 のユーザー依頼）
  { part: 'banner', at: ['E', 'F', 0.6], side: 1, back: 0, radius: 2, text: '← WestLake Villas', color: '#2a62b8' },
  { part: 'banner', at: ['F', 'G', 0.74], side: 1, back: 0, radius: 2, text: '← WIS Open Day Here', color: '#3b2a6b' }, // 校舎の真ん前（校舎は学校の場所から 25m 先）。文字数を減らして「WIS」（2026-10-16 のユーザー依頼）
  { part: 'banner', at: ['G', 'H', 0.58], side: 1, back: 0, radius: 2, text: '← HOSPITAL UTAR', color: '#1f9a96' },

  // そのほかの目印（設計書 4 の表）
  { part: 'curvedMall', at: ['S', 'A', 0.8], side: 1, back: 6, radius: 15 }, // 曲がった屋根の大きな建物（04〜06）
  { part: 'fastFood', at: ['A', 'B', 0.6], side: 1, back: 3, radius: 8 }, // ファストフード店（11）
  { part: 'petrolStation', at: ['A', 'B', 0.72], side: 1, back: 3, radius: 9 }, // ガソリンスタンド（12）
  { part: 'museumSign', at: ['A', 'B', 0.93], side: 1, back: 1, radius: 4 }, // 博物館の看板（13）
  // 1つ目のバンプの先を右に曲がった（B）あと、右手の2つ目の建物（横道の先のショップハウス）の所に、道をまたぐ（歩道橋のような）
  // 緑の横断幕「ECONSAVE →」。下は赤い帯（2026-10-16 のユーザー依頼）
  { part: 'banner', at: ['B', 'C', 0.66], side: 1, back: 0, radius: 2, text: 'ECONSAVE →', style: 'greenRed' },
  { part: 'gBuilding', at: ['B', 'C', 0.85], side: 1, back: 2, radius: 8 }, // 丸い「G」の建物（19C）
  { part: 'hotel', at: ['C', 'D', 0.6], side: 1, back: 3, radius: 10 }, // 白い8階建てのホテル（22）
  { part: 'waterTowerBB', at: ['E', 'F', 0.4], side: 1, back: 6, radius: 6 }, // 「Bandar Barat」の給水塔（38）
  { part: 'facultyBuilding', at: ['G', 'H', 0.8], side: 1, back: 4, radius: 10 }, // 学部の建物（61右）
  { part: 'utarHall', at: ['H', 'I', 0.12], side: 1, back: 6, radius: 18 }, // 大学の大ホール（62右H）
  { part: 'archGate', at: ['G', 'H', 0.97], side: 1, back: 0, radius: 2 }, // H の、UTAR の敷地の入口のアーチ（2026-10-15 のユーザー依頼）
  { part: 'archGate', at: ['H', 'I', 0.97], side: 1, back: 0, radius: 2 }, // I の青いアーチの門（64I）
  { part: 'waterTowerUtar', at: ['I', 'J', 0.12], side: -1, back: 5, radius: 6 }, // UTAR の給水塔（67）

  // ロータリーの出口の目印（2026-10-15 のユーザー依頼）: 島の上と出口の先に矢印の標識、出口の両わきに矢羽根の板、
  // コースでない道は少しだけ描いて、壁と赤白の柵でふさぐ
  { part: 'arrowSign', at: ['A', 'B', 0.3], side: 0, anywhere: true, dir: 0 },
  { part: 'arrowSign', at: ['A', 'B', 0.48], side: 1, back: 0.5, dir: 0 },
  { part: 'chevronBoard', at: ['A', 'B', 0.46], side: -1, back: 0.5, dir: 1 },
  { part: 'chevronBoard', at: ['A', 'B', 0.46], side: 1, back: 0.5, dir: -1 },
  { part: 'stubRoad', at: ['A', 'B', 0.3], side: -1, back: 0, radius: 3 },
  { part: 'stubRoad', at: ['A', 'B', 0.3], side: 1, back: 0, radius: 3 },
  { part: 'arrowSign', at: ['E', 'E', 0], side: 0, anywhere: true, dir: 0 },
  { part: 'arrowSign', at: ['E', 'F', 0.17], side: 1, back: 0.5, dir: 0 },
  { part: 'chevronBoard', at: ['E', 'F', 0.15], side: -1, back: 0.5, dir: 1 },
  { part: 'chevronBoard', at: ['E', 'F', 0.15], side: 1, back: 0.5, dir: -1 },
  { part: 'stubRoad', at: ['E', 'E', 0], side: 1, back: 0, radius: 3 },
  { part: 'arrowSign', at: ['G', 'G', 0], side: 0, anywhere: true, dir: 0 },
  { part: 'arrowSign', at: ['G', 'H', 0.53], side: 1, back: 0.5, dir: 0 },
  { part: 'chevronBoard', at: ['G', 'H', 0.47], side: -1, back: 0.5, dir: 1 },
  { part: 'chevronBoard', at: ['G', 'H', 0.47], side: 1, back: 0.5, dir: -1 },

  // 直角の角の正面に続く道（通行止め。2026-10-15 のユーザー依頼「正面にも道は続いているが、通行止め」）
  { part: 'stubRoad', at: ['A', 'A', 0], ahead: true },
  { part: 'stubRoad', at: ['B', 'B', 0], ahead: true },
  // 直角の角は T字路（2026-10-15 のユーザー依頼）: 曲がる先の道が反対側にも続き（通行止め）、正面はコースの壁でふさぐ。
  // A・B・F は十字路（正面にも道が続く）。交差点 A・B・F には信号機（いつも青）を、入ってくる手前の両側に
  { part: 'stubRoad', at: ['A', 'A', 0], ahead: 'back' },
  { part: 'stubRoad', at: ['B', 'B', 0], ahead: 'back' },
  { part: 'stubRoad', at: ['C', 'C', 0], ahead: 'back' },
  { part: 'stubRoad', at: ['D', 'D', 0], ahead: 'back' },
  { part: 'stubRoad', at: ['D', 'E', 0.7], ahead: 'back' }, // D〜E の角
  { part: 'stubRoad', at: ['F', 'F', 0], ahead: 'back' }, // WestLake Villas の前の角（左の道）
  { part: 'stubRoad', at: ['F', 'F', 0], ahead: true, length: 200 }, // F は十字路: 正面にも 200m の道（入口でふさぐ。2026-10-15 のユーザー依頼）
  { part: 'stubRoad', at: ['J', 'J', 0], ahead: 'back' },
  { part: 'trafficLight', at: ['S', 'A', 0.96], side: -1, back: 0.5, radius: 1 },
  { part: 'trafficLight', at: ['S', 'A', 0.96], side: 1, back: 0.5, radius: 1 },
  { part: 'trafficLight', at: ['A', 'B', 0.9], side: -1, back: 0.5, radius: 1 }, // 角の四角（走れる所）に入らないよう少し手前
  { part: 'trafficLight', at: ['A', 'B', 0.9], side: 1, back: 0.5, radius: 1 },
  { part: 'trafficLight', at: ['E', 'F', 0.96], side: -1, back: 0.5, radius: 1 },
  { part: 'trafficLight', at: ['E', 'F', 0.96], side: 1, back: 0.5, radius: 1 },
  // 町の中の横道（通行止め）
  { part: 'stubRoad', at: ['A', 'B', 0.62], side: -1, back: 0, radius: 3 },
  { part: 'stubRoad', at: ['B', 'C', 0.45], side: 1, back: 0, radius: 3 },
  { part: 'stubRoad', at: ['B', 'C', 0.7], side: -1, back: 0, radius: 3 },
  { part: 'stubRoad', at: ['D', 'E', 0.35], side: 1, back: 0, radius: 3 },
  { part: 'stubRoad', at: ['J', 'S', 0.55], side: 1, back: 0, radius: 3 },
  { part: 'stubRoad', at: ['J', 'S', 0.85], side: -1, back: 0, radius: 3 },

  // スタート〜A（01〜06）: 広い道。左は草むらとやぶ、右は低い建物。道ばたに街灯
  { part: 'bush', from: ['S', 'A', 0.05], to: ['S', 'A', 0.95], every: 9, side: -1, back: 2, radius: 2 },
  { part: 'tree', from: ['S', 'A', 0.1], to: ['S', 'A', 0.9], every: 18, side: -1, back: 6, radius: 3, color: 0x2f7a2c },
  { part: 'lamp', from: ['S', 'A', 0.1], to: ['S', 'A', 0.85], every: 30, side: 1, back: 0.5, radius: 1 },
  { part: 'shophouse', from: ['S', 'A', 0.5], to: ['S', 'A', 0.68], every: 7, side: 1, back: 3, radius: 7, floors: 2, color: 0xe6e2da },
  { part: 'tree', from: ['S', 'A', 0.1], to: ['S', 'A', 0.5], every: 16, side: 1, back: 3, radius: 3 },

  // A〜B（07〜14B）: ショップハウスの町なか
  { part: 'shophouse', from: ['A', 'B', 0.1], to: ['A', 'B', 0.22], every: 6, side: 1, back: 2, radius: 7 },
  { part: 'shophouse', from: ['A', 'B', 0.1], to: ['A', 'B', 0.22], every: 6, side: -1, back: 2, radius: 7, color: 0xf2f0ea },
  { part: 'shophouse', from: ['A', 'B', 0.5], to: ['A', 'B', 0.95], every: 6, side: -1, back: 2, radius: 7, color: 0xf2f0ea },

  // B〜C（15〜19C）: ヤシの並木と、赤い屋根の3階建てショップハウスの並び
  { part: 'palm', from: ['B', 'C', 0.2], to: ['B', 'C', 0.85], every: 12, side: -1, back: 0.5, radius: 1 },
  { part: 'palm', from: ['B', 'C', 0.2], to: ['B', 'C', 0.85], every: 12, side: 1, back: 0.5, radius: 1 },
  { part: 'shophouse', from: ['B', 'C', 0.1], to: ['B', 'C', 0.9], every: 6, side: -1, back: 2, radius: 7, color: 0xeee4d0 },
  { part: 'shophouse', from: ['B', 'C', 0.1], to: ['B', 'C', 0.88], every: 6, side: 1, back: 2, radius: 7, color: 0xf3ead8 },

  // C〜D（20〜25）: レンガの道。白黒の木組みのショップハウス
  { part: 'timberHouse', from: ['C', 'D', 0.1], to: ['C', 'D', 0.9], every: 7, side: -1, back: 2, radius: 7 },
  { part: 'shophouse', from: ['C', 'D', 0.1], to: ['C', 'D', 0.4], every: 6, side: 1, back: 2, radius: 7, color: 0xc77b5a },

  // D〜E（26〜34）: 学校の横の道。学校の塀と、青い屋根の屋根付き通路。右は2階建ての家
  { part: 'wall', from: ['D', 'E', 0.15], to: ['D', 'E', 0.95], every: 10, side: -1, back: 1, radius: 2, length: 10, color: 0x2a5fb8, pattern: 'school' },
  { part: 'walkway', from: ['D', 'E', 0.2], to: ['D', 'E', 0.9], every: 13, side: -1, back: 5, radius: 3, length: 12 },
  { part: 'shophouse', from: ['D', 'E', 0.1], to: ['D', 'E', 0.65], every: 7, side: 1, back: 3, radius: 7, floors: 2, color: 0xf0ece4 },

  // E〜F（35E〜42F）: 白いテントの並び、家、木
  { part: 'tent', from: ['E', 'F', 0.2], to: ['E', 'F', 0.35], every: 6, side: 1, back: 3, radius: 3 },
  { part: 'tree', from: ['E', 'F', 0.2], to: ['E', 'F', 0.9], every: 15, side: -1, back: 3, radius: 3 },
  { part: 'shophouse', from: ['E', 'F', 0.5], to: ['E', 'F', 0.9], every: 7, side: 1, back: 3, radius: 7, floors: 2, color: 0xe8e2d4 },

  // F〜G（43〜60G）: 両側に木の並ぶ道。右は白い手すりの湖と、止まっている車
  { part: 'tree', from: ['F', 'G', 0.05], to: ['F', 'G', 0.9], every: 12, side: 1, back: 1, radius: 3 },
  { part: 'railing', from: ['F', 'G', 0.1], to: ['F', 'G', 0.9], every: 10, side: 1, back: 4, radius: 1, length: 10, color: 0xf2f2f2 },
  { part: 'car', from: ['F', 'G', 0.2], to: ['F', 'G', 0.8], every: 9, side: 1, back: 1.5, radius: 2, color: 0xc8c8c8 },
  { part: 'tree', from: ['F', 'G', 0.32], to: ['F', 'G', 0.78], every: 14, side: 0, radius: 1, crown: 0.45, height: 5 }, // 分離帯の若い木

  // G〜H（61右〜62右H）: 大学の建物と木。右は湖
  { part: 'tree', from: ['G', 'H', 0.6], to: ['G', 'H', 0.95], every: 14, side: 1, back: 2, radius: 3 },

  // H〜I（63HI）: 大学の中。両側に大学の建物、木
  { part: 'tower', from: ['H', 'I', 0.35], to: ['H', 'I', 0.9], every: 45, side: 1, back: 8, radius: 12, floors: 3, width: 36, depth: 16, color: 0xf2f2f0, stripe: 0x8fa0ad },
  { part: 'tree', from: ['H', 'I', 0.05], to: ['H', 'I', 0.95], every: 15, side: -1, back: 3, radius: 3 },

  // I〜J（65〜75J）: Jalan Perdana。大きな木と止まっている車。左に大きな店、右に家具の店
  { part: 'tree', from: ['I', 'J', 0.05], to: ['I', 'J', 0.6], every: 18, side: -1, back: 2, radius: 3, height: 10 },
  { part: 'tree', from: ['I', 'J', 0.05], to: ['I', 'J', 0.6], every: 18, side: 1, back: 2, radius: 3, height: 10 },
  { part: 'car', from: ['I', 'J', 0.05], to: ['I', 'J', 0.5], every: 8, side: -1, back: 0.5, radius: 2, color: 0x9da7ad },
  { part: 'shed', at: ['I', 'J', 0.75], side: -1, back: 5, radius: 20 },
  { part: 'shed', at: ['I', 'J', 0.82], side: 1, back: 3, radius: 20, color: 0x8fd8ee }, // Lotus's の建物（右。牛のいる所）

  // J〜スタート（76〜78）: 4階建ての古いショップハウス、木、やぶ、道ばたの街灯
  { part: 'shophouse', from: ['J', 'S', 0.1], to: ['J', 'S', 0.25], every: 6, side: -1, back: 3, radius: 7, floors: 4, color: 0xe6dcc0 },
  { part: 'shophouse', from: ['J', 'S', 0.4], to: ['J', 'S', 0.6], every: 6, side: -1, back: 3, radius: 7, floors: 4, color: 0xc79a6a },
  { part: 'tree', from: ['J', 'S', 0.1], to: ['J', 'S', 0.9], every: 16, side: 1, back: 3, radius: 3 },
  { part: 'bush', from: ['J', 'S', 0.6], to: ['J', 'S', 0.95], every: 9, side: -1, back: 2, radius: 2 },
  { part: 'lamp', from: ['J', 'S', 0.15], to: ['J', 'S', 0.9], every: 30, side: 1, back: 0.5, radius: 1 },
];
