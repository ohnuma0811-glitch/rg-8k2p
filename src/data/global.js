// Global City の名所の置き場所（地図の座標 m。x は東、z は南）。ry は向き（度。北 0、時計回り）。from/to は道の印の範囲
export const GLOBAL_SCENERY = {
  tokyo: {
    palace: { at: [-60, -250], ry: 0 }, // 皇居（宮殿: 低く横に長い、銅色の屋根）
    moat: [[-420, -620], [-320, -560], [-200, -500], [-110, -440]], // お堀（道の北がわ）
    nijubashi: { at: [-110, -390], ry: 135 }, // 二重橋（石の2連アーチ）。道はこの上
    sakura: { from: 'S', to: 'NJ', every: 8 }, // 桜並木（道の両がわ）
    shinmaru: { at: [300, -160], ry: 0 }, // 新丸ビル（高さ 198m）
    marunouchi: [[240, -170], [360, -170], [240, -30], [360, -30], [180, -40], [460, -150]], // 丸の内の高層ビル
    tokyoStation: { at: [480, 60], ry: 90 }, // 東京駅（赤レンガ、長さ 330m。正面は西）
    tokyoTower: { at: [150, 480], ry: 0 }, // 東京タワー（高さ 333m）
    shinkansenLine: { from: 'TT', to: 'SL', off: -30, y: 8 }, // 新幹線の線路（道の北がわ 30m、高架 8m）
    rainbowBridge: { from: 'RB', to: 'RBE' }, // レインボーブリッジ（白い主塔2本、高さ 126m）
    fujiTV: { at: [1110, 880], ry: 180 }, // フジテレビ本社（格子の建物と球体）
    bigJump: { from: 'JP', to: 'AJ' }, // お台場の巨大ジャンプ台
  },
};
