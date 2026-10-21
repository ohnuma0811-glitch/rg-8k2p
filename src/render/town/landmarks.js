// その場所だけの目印（設計書 4・4.1）。写真と見くらべて作る
// 部品の前（道の側）は +z、道ぞいの長さは x、地面は y = 0（src/render/town/kit.js と同じ）
import { COLORS, tower, bus } from './kit.js?v=3d564fd';

// 文字の板の絵（同じ文字は使い回す）
function textDraw(text, fg, bg, weight = 'bold') {
  const draw = (g, w, h) => {
    if (bg) {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
    }
    g.fillStyle = fg;
    const lines = text.split(' / ');
    g.font = `${weight} ${Math.floor((h / lines.length) * 0.6)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    lines.forEach((l, k) => g.fillText(l, w / 2, (h * (k + 0.5)) / lines.length, w * 0.94));
  };
  draw.key = `text:${text}:${fg}:${bg}:${weight}`;
  return draw;
}

// 立体の1文字（KAMPAR の看板）。背景なし
function letterDraw(ch, color) {
  const draw = (g, w, h) => {
    g.fillStyle = color;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 6;
    g.font = `bold ${Math.floor(h * 0.95)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.strokeText(ch, w / 2, h / 2 + 4);
    g.fillText(ch, w / 2, h / 2 + 4);
  };
  draw.key = `letter:${ch}:${color}`;
  return draw;
}

// 丸い紋章（緑の山の絵。KAMPAR の看板の左）
function emblemDraw() {
  const draw = (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#7a4a2a';
    g.beginPath();
    g.arc(w / 2, h / 2, w / 2 - 8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#9fd3f0';
    g.beginPath();
    g.arc(w / 2, h / 2, w / 2 - 14, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2e8f3e';
    g.beginPath();
    g.moveTo(16, h * 0.7);
    g.lineTo(w * 0.42, h * 0.28);
    g.lineTo(w * 0.6, h * 0.5);
    g.lineTo(w * 0.72, h * 0.36);
    g.lineTo(w - 16, h * 0.7);
    g.fill();
  };
  draw.key = 'emblem:kampar';
  return draw;
}

// F の手前の左の WestLake Villas（写真 40・41・42F）: 20階くらいの塔が4本、少しずつずらして並ぶ
// 明るい灰色と白、縦に濃い灰緑の窓の列。下に白い横じまの長い駐車場。角の植え込みに、青い曲がった看板
function westlakeVillas(b) {
  b.box(110, 12, 36, COLORS.white, 0, 0, -22); // 駐車場（多階）
  for (let f = 1; f < 5; f++) b.box(110.4, 0.6, 36.4, 0xaeb4b4, 0, f * 2.6, -22); // 横じまの帯
  for (const [x, z] of [[-40, -28], [-13, -34], [14, -28], [41, -34]]) {
    b.push(x, 12, z);
    tower(b, { floors: 20, width: 18, depth: 16, color: 0xe2e3df, stripe: 0x5f7f78 });
    b.pop();
  }
}

// F〜H の左の Westlake International School（写真 44〜48、学校（道から）.png）
function westlakeSchool(b) {
  // 道ぞいの灰色の金網のフェンスと、その奥の広い芝生のグラウンド（白いサッカーゴール）
  b.box(130, 1.8, 0.1, 0x8f979c, 0, 0, 0);
  b.box(70, 0.04, 60, 0x6fb64f, -35, 0, -31); // グラウンド（校舎の左）
  for (const x of [-62, -8]) {
    b.box(0.15, 2.4, 0.15, COLORS.white, x, 0, -27);
    b.box(0.15, 2.4, 0.15, COLORS.white, x, 0, -34);
    b.box(0.15, 0.15, 7.3, COLORS.white, x, 2.4, -30.5);
  }
  // 校舎（白い5階建て、緑のパネル、オレンジのベランダの帯。屋上に濃い灰色の楕円の屋根と、オレンジの A の字の柱）
  b.push(25, 0, -50); // 校舎（道から見える所に。2026-10-15 のユーザー依頼「学校だと分からなかった」）
  b.box(46, 18, 22, COLORS.white, 0, 0, 0);
  for (let f = 0; f < 5; f++) for (let x = -18; x <= 18; x += 6) b.box(3.2, 1.8, 0.2, 0x3aa35a, x, f * 3.6 + 1.2, 11.1);
  for (const y of [3.4, 7]) b.box(46.4, 0.5, 22.6, 0xe0802a, 0, y, 0);
  b.box(34, 0.8, 30, 0x4a4f55, 4, 22, 0); // 張り出した楕円の屋根（箱を重ねて丸く見せる）
  b.box(42, 0.8, 22, 0x4a4f55, 4, 22, 0);
  b.box(24, 0.8, 36, 0x4a4f55, 4, 22, 0);
  for (const x of [-8, 16]) {
    b.box(0.5, 4.2, 0.5, 0xe0702a, x - 1.6, 18, 13);
    b.box(0.5, 4.2, 0.5, 0xe0702a, x + 1.6, 18, 13);
    b.box(3.7, 0.5, 0.5, 0xe0702a, x, 21.5, 13);
  }
  // 屋上の大きな看板（遠くから学校だと分かるように）
  b.box(36, 4.4, 0.4, COLORS.white, 4, 23, 11);
  b.label(textDraw('WESTLAKE INTERNATIONAL SCHOOL', '#2b6b3a', '#ffffff'), [1024, 128], 4, 25.2, 11.25, 0, 35, 4.2);
  b.cyl(1.6, 1.6, 0.2, 16, 0x2b6b3a, -1, 12.5, 11.2);
  b.box(60, 0.4, 6, COLORS.white, -8, 3.6, 14); // 1階の前の、白い柱が並ぶ屋根付きの通路
  for (let x = -36; x <= 20; x += 4) b.box(0.4, 3.6, 0.4, COLORS.white, x, 0, 16.5);
  b.pop();
  // 校舎の前の、赤い舗装の前庭と、植え込みの白い「木」の字のオブジェ（写真「学校（道から）.png」。2026-10-15 のユーザー依頼）
  // 道からよく見えるように、フェンスのすぐ奥に。まん中は「木」を3つ重ねた「森」、両わきに「木」。まわりに低い木
  b.box(50, 0.06, 22, 0xc85a3a, 25, 0, -20);
  b.box(34, 0.4, 7, COLORS.grass, 25, 0, -6);
  const ki = (x, y, k = 1) => {
    const W = COLORS.white;
    b.box(0.35 * k, 3.4 * k, 0.35 * k, W, x, y, -6); // たての棒
    b.box(2.8 * k, 0.35 * k, 0.35 * k, W, x, y + 2.3 * k, -6); // よこの棒
    for (const sx of [-1, 1]) for (let i = 1; i <= 3; i++) b.box(0.55 * k, 0.45 * k, 0.35 * k, W, x + sx * 0.42 * i * k, y + (2.1 - 0.5 * i) * k, -6); // ななめのはらい
  };
  ki(25, 0.4 + 3.4 * 1.6 + 0.2, 1.6); // 森の上の「木」（下の2つの上に重ねる）
  ki(21.2, 0.4, 1.6); // 森の下の左の「木」
  ki(28.8, 0.4, 1.6); // 森の下の右の「木」
  ki(13, 0.4, 1.3);
  ki(37, 0.4, 1.3);
  for (const x of [9, 17, 33, 41]) {
    b.cyl(0.2, 0.25, 1.6, 6, 0x6a4a30, x, 0.4, -7.5);
    b.cyl(0.4, 1.6, 2.6, 8, 0x3c8f3a, x, 1.8, -7.5);
  }
  // 黄色いスクールバス
  for (let k = 0; k < 4; k++) {
    b.push(58 + k * 4, 0, -40, 0);
    bus(b);
    b.pop();
  }
  // 入口: 赤レンガの車道、守衛所、道の上の黄色の格子。入口の横に水路と緑の手すりの橋
  b.box(10, 0.07, 40, 0xc85a3a, 55, 0, -20);
  b.box(4, 3, 4, COLORS.white, 50, 0, -12);
  for (let k = -4; k <= 4; k += 2) b.box(10, 0.08, 0.3, 0xf2c200, 55, 0.01, -3 + k);
  b.box(4, 0.1, 30, 0x5f9fc8, 63, 0, -15);
  b.box(0.2, 1, 6, 0x5fae4b, 61, 0, -2);
}

// G のロータリーの所の UTAR の病院（写真 49・50・60G）
function hospitalUtar(b) {
  b.push(0, 0, -70);
  b.box(70, 30, 30, COLORS.white, 0, 0, 0);
  for (let f = 0; f < 8; f++) b.box(70.4, 1.2, 30.4, 0x1f9a96, 0, f * 3.6 + 2.2, 0); // 緑青色の帯
  b.box(24, 34, 26, 0xf2f2f2, -40, 0, 4);
  b.box(18, 22, 22, 0xe6e6e6, 40, 0, 6);
  b.label(textDraw('HOSPITAL UTAR', '#1f6fb2', '#ffffff'), [512, 96], 0, 31.5, 15.3, 0, 20, 3.4);
  b.pop();
  // 道ばたの、灰色の低い壁（病院のマーク）。名前は横断幕と屋上だけ（看板の重複をなくす。2026-10-15 のユーザー依頼）
  b.box(28, 3, 1.5, 0x9a9fa3, -10, 0, -4);
  b.box(2.4, 2.4, 0.3, 0x2a9a8f, -24, 1.4, -3.1);
  // 入口の上をまたぐ、青い鉄骨のアーチの橋（三角の骨組み）
  for (let k = 0; k <= 40; k++) {
    const a = (k / 40) * Math.PI;
    const x = 30 - Math.cos(a) * 20;
    b.box(1.8, 0.8, 2.6, 0x2a6fd8, x, Math.sin(a) * 9 + 0.3, -12);
    if (k % 4 === 0) b.box(0.25, 1.6, 2.6, 0x2a6fd8, x, Math.max(0, Math.sin(a) * 9 - 1.3), -12); // 三角の骨組み
  }
  b.box(5, 3, 4, COLORS.white, 22, 0, -6); // 守衛所
  for (let x = 34; x <= 46; x += 2) b.box(1, 0.9, 0.4, x % 4 ? 0xd8262b : 0xffffff, x, 0, -4); // 赤白の車止め
}

// J〜スタートの左の KAMPAR の看板（写真 75J右・76・76左）: 1文字ずつ色がちがう立体の文字
// T字路 J の正面（Lotus's を抜けて右に曲がる所。2026-10-15 のユーザー依頼）に置く。前（+z）が、角に入ってくる車の方
function kamparSign(b) {
  b.box(34, 1.5, 14, COLORS.grass, 0, 0, -7); // 芝生の土手
  b.box(26, 0.1, 4, 0xc8604a, 0, 1.5, -2.5); // レンガの広場
  const letters = [['K', '#1d2f6b'], ['A', '#6a2c8f'], ['M', '#1f5fbf'], ['P', '#f2b51f'], ['A', '#2e8f3e'], ['R', '#e8742a']];
  letters.forEach(([ch, color], k) => {
    const x = -9.75 + k * 3.9;
    b.box(3.4, 4.6, 0.7, parseInt(color.slice(1), 16), x, 1.5, -2.2); // 文字の厚み
    b.label(letterDraw(ch, color), [128, 160], x, 3.8, -1.8, 0, 3.9, 4.9);
  });
  b.label(emblemDraw(), [128, 128], -14.5, 4.1, -1.8, 0, 4, 4); // 丸い紋章（緑の山）
  b.box(0.4, 2.6, 0.4, 0x7a7a7a, -14.5, 1.5, -2.1);
  // 後ろの4階建ての古いショップハウスの並び
  for (let k = 0; k < 6; k++) b.box(6, 13.6, 12, [0xe6dcc0, 0xc79a6a, 0xd9a48a][k % 3], -15 + k * 6, 0, -22);
  b.label(textDraw('RESTORAN', '#ffffff', '#7a2a1a'), [256, 64], -9, 3.6, -15.9, 0, 6, 1.4);
}

// スタートの近くの歩道橋（写真 02）: 道をまるごとまたぐ。四角いコンクリートの柱、灰色の手すり、
// 真ん中の道をまたぐ所だけ緑青色の丸い屋根、両はしは道ばたへ下りる長いスロープ
// 道のふちに置き、前（+z）の向きに道を越える
function footbridge(b, { span = 34 } = {}) {
  const top = 6;
  b.box(3, 0.6, span + 6, COLORS.concrete, 0, top, span / 2);
  for (const z of [-2, span / 2, span + 2]) b.box(1.2, top, 1.2, COLORS.concrete, 0, 0, z);
  for (const x of [-1.45, 1.45]) {
    b.box(0.08, 1.1, span + 6, 0xb8bdc2, x, top + 0.6, span / 2);
    for (let z = -3; z <= span + 3; z += 1.5) b.box(0.06, 1.1, 0.06, 0xb8bdc2, x, top + 0.6, z);
  }
  for (let k = 0; k <= 8; k++) {
    const a = (k / 8) * Math.PI;
    b.box(0.6, 0.2, 14, 0x2a9a8f, -Math.cos(a) * 1.6, top + 2.2 + Math.sin(a) * 1.2, span / 2);
  }
  // 高速道路のような緑の案内板（スタートから見える側。2026-10-16 のユーザー依頼）。
  // 右の道ばたの部品では +x が走ってくる車の方なので、+x 側に、前（絵の面）を +x へ向けて付ける
  b.box(0.3, 4.2, 15.4, 0xffffff, 1.95, top + 0.2, span / 2); // 白いふち
  b.label(highwaySignDraw(), [1024, 280], 2.12, top + 2.3, span / 2, Math.PI / 2, 15, 4);
  // 両はしのスロープ（道に平行に、道ばたへ下りる）
  for (const z of [-3, span + 3]) {
    for (let k = 0; k < 8; k++) b.box(3, 0.4, 2.4, COLORS.concrete, 3 + k * 3, top - (k + 1) * (top / 8), z);
  }
}

// 緑の案内板の絵: 2行、左に行き先と距離、右に矢印（マレーシアの高速道路の案内板ふう）
function highwaySignDraw() {
  const draw = (g, w, h) => {
    g.fillStyle = '#0b6b3a';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 8;
    g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#ffffff';
    g.font = `bold ${Math.floor(h * 0.25)}px sans-serif`;
    g.textBaseline = 'middle';
    // 行き先は左寄せ、距離は右寄せで同じ列、矢印も同じ列（250km↑ と 100km→ が縦にそろう。2026-10-16 のユーザー依頼）
    [['Kuala Lumpur', '250 km', '↑'], ['Ipoh', '100 km', '→']].forEach(([name, dist, arrow], k) => {
      const y = (h * (k + 0.5)) / 2;
      g.textAlign = 'left';
      g.fillText(name, w * 0.05, y);
      g.textAlign = 'right';
      g.fillText(dist, w * 0.85, y);
      g.textAlign = 'center';
      g.fillText(arrow, w * 0.91, y);
    });
  };
  draw.key = 'highway:KL250:Ipoh100:cols';
  return draw;
}

// J〜スタートの、川と大きな水道管の橋（写真 77）
function pipeBridge(b) {
  b.box(30, 1, 4, 0x8f979c, 0, 3, 0);
  for (const z of [-1, 1]) b.cylX(0.6, 30, 10, 0xc9cdd0, 0, 4.6, z); // 横に寝かせた大きな水道管2本
  for (const x of [-12, 0, 12]) b.box(0.8, 3, 0.8, 0x8f979c, x, 0, 0);
  b.box(30, 0.05, 14, 0x6f8f9f, 0, 0.02, 0); // 川
}

// スタート〜A の右の、曲がった銀色の屋根の横長の建物（写真 04〜06）
function curvedMall(b) {
  b.box(60, 9, 24, 0xd9d6cf, 0, 0, -14);
  for (let f = 1; f < 3; f++) b.box(60.2, 1.4, 0.2, COLORS.darkGlass, 0, f * 3.6 - 1, -1.9);
  for (let k = 0; k <= 8; k++) {
    const a = (k / 8) * Math.PI;
    b.box(62, 0.6, 3.4, 0xb9bec4, 0, 9 + Math.sin(a) * 3, -14 - Math.cos(a) * 12); // 丸い屋根（細い板を弧に並べる）
  }
  b.box(60, 0.5, 4, 0xb4553a, 0, 3.2, 0.5); // 1階の赤い屋根の張り出し
}

// A〜B の右の、錫の鉱山の博物館の大きな文字の看板（写真 13）
function museumSign(b) {
  b.box(16, 2.4, 1.2, 0x55585e, 0, 0, 0);
  b.label(textDraw('MUZIUM PERLOMBONGAN BIJIH TIMAH KINTA / KINTA TIN MINING (GRAVEL PUMP) MUSEUM', '#ffffff', '#55585e'), [1024, 128], 0, 1.3, 0.62, 0, 15.6, 2);
  b.box(8, 0.3, 4, COLORS.grass, 0, 0, -2);
}

// C の角の、丸い「G」のロゴの黒っぽい2階建て（写真 19C）
function gBuilding(b) {
  b.box(20, 8, 16, 0x3a3d42, 0, 0, -8);
  b.box(20.4, 0.6, 16.4, 0x2a2c30, 0, 8, -8);
  b.box(14, 2.5, 0.3, 0xd8262b, 0, 0.3, 0.2); // 下の赤い日よけ
  b.cyl(2.2, 2.2, 0.3, 20, 0x2a2c30, 4, 5, 0.3);
  b.label(textDraw('G', '#e8b04a', '#2a2c30'), [128, 128], 4, 5.2, 0.5, 0, 3.6, 3.6);
}

// C〜D の右の、白い8階建てのホテル（写真 22・22右側）
function hotel(b) {
  b.box(30, 26, 18, 0xf0eee6, 0, 0, -12);
  for (let f = 1; f < 8; f++) for (let x = -12; x <= 12; x += 4) b.box(2, 1.6, 0.2, COLORS.darkGlass, x, f * 3.2 + 0.6, -2.9);
  b.box(31, 1.2, 19, 0xe2ded2, 0, 26, -12);
  for (const x of [-15, 15]) b.box(3, 29, 3, 0xe8e4da, x, 0, -3); // 角の飾りの柱
  b.box(14, 0.5, 5, 0x3a3d42, 0, 4, 0); // 1階の屋根の張り出し
  // 屋上の名前の看板（2026-10-15 のユーザー依頼）
  // 屋根のふち（z=-2.5）や柱より前に出して、建物にうもれないように
  b.box(24, 3.4, 0.4, 0x7a1f2b, 0, 27.2, -1.2);
  b.label(textDraw('Grand Kampar Hotel', '#f2d48a', '#7a1f2b'), [1024, 128], 0, 28.9, -0.95, 0, 23, 2.9);
}

// E〜F の右の「Bandar Barat」の給水塔（写真 38）: 太い円柱の上に、白い大きな丸い水入れ
function waterTowerBB(b) {
  b.cyl(2.2, 2.6, 18, 12, 0xe8e8e8, 0, 0, -6);
  b.cyl(7, 4, 6, 16, 0xf4f4f4, 0, 18, -6);
  b.cyl(7, 7, 4, 16, 0xf4f4f4, 0, 24, -6);
  b.label(textDraw('Bandar Barat', '#1f5fbf', '#f4f4f4'), [512, 96], 0, 26, 1.05, 0, 9, 1.6);
}

// I〜J の左の UTAR の給水塔（写真 67）: 細い白い柱の組み合わせの上に、白い丸い水入れ、青い帯に「UTAR」
function waterTowerUtar(b) {
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    b.box(0.4, 16, 0.4, 0xf2f2f2, Math.cos(a) * 4, 0, -6 + Math.sin(a) * 4);
  }
  for (const y of [5, 10]) b.cyl(4.3, 4.3, 0.4, 16, 0xf2f2f2, 0, y, -6);
  b.cyl(6, 6, 5, 20, 0xf6f6f6, 0, 16, -6);
  b.cyl(6.05, 6.05, 1.6, 20, 0x2a5fb8, 0, 18.5, -6);
  b.label(textDraw('UTAR', '#ffffff', '#2a5fb8'), [256, 64], 0, 19.3, 0.1, 0, 5, 1.3);
}

// H の右の UTAR の大ホール（写真 62右H）: 中国風の灰色の大きな屋根（ゆるく反った箱を重ねる）と、ピンクの柱の並び
function utarHall(b) {
  b.box(50, 10, 34, 0xe8e2d8, 0, 0, -22);
  for (let x = -24; x <= 24; x += 4) b.box(1, 10, 1, 0xd0457a, x, 0, -4); // ピンクの柱
  for (let k = 0; k < 4; k++) b.box(60 - k * 10, 1.4, 44 - k * 8, k % 2 ? 0x8f969c : 0xa3aab0, 0, 10 + k * 1.6, -22); // 段々の屋根
  b.box(16, 2, 10, 0x8f969c, 0, 16.4, -22);
  b.box(30, 0.6, 6, 0x8f969c, 40, 4, -8); // 横の屋根付きの通路
  for (let x = 28; x <= 52; x += 4) b.box(0.8, 4, 0.8, 0xd0457a, x, 0, -6);
}

// G〜H の右の学部の建物（写真 61右）: 白い長い2階建て、灰色の屋根、オレンジの看板
function facultyBuilding(b) {
  b.box(46, 8, 16, 0xf2f2f0, 0, 0, -10);
  b.box(48, 0.8, 18, 0x8f969c, 0, 8, -10);
  for (let x = -20; x <= 20; x += 5) b.box(0.6, 8, 0.6, 0xd8d8d8, x, 0, -1.6);
  b.box(4, 3, 0.3, 0xe8742a, -16, 4, -1.7);
}

// I の青い鉄のアーチの門（写真 64I）: 道をまたぐ大きなアーチ（道のふちに置き、前の向きに道を越える）
function archGate(b, { span = 34 } = {}) {
  // 弧にそって、短い鉄骨を重なるくらい細かく並べる（すき間ができないように）
  const N = 48;
  for (let k = 0; k <= N; k++) {
    const a = (k / N) * Math.PI;
    const z = span / 2 - Math.cos(a) * (span / 2);
    const y = Math.sin(a) * 11;
    for (const x of [-1.2, 1.2]) b.box(0.5, 0.9, 1.6, 0x2a6fd8, x, y, z);
    if (k % 3 === 0) b.box(2.4, 0.3, 0.3, 0x2a6fd8, 0, y + 0.3, z); // 2本の弧をつなぐ横の骨
  }
  // アーチの上の大きな「UTAR」（走ってくる車の方を向く。2026-10-15 のユーザー依頼「良く見えるところに大きく」）
  b.box(0.4, 4.4, 15, 0x2a6fd8, 0, 11.4, span / 2);
  b.label(textDraw('UTAR', '#ffffff', '#2a6fd8'), [512, 160], 0.25, 13.6, span / 2, Math.PI / 2, 14, 4.2);
}

export const PARTS = { westlakeVillas, westlakeSchool, hospitalUtar, kamparSign, footbridge, pipeBridge, curvedMall, museumSign, gBuilding, hotel, waterTowerBB, waterTowerUtar, utarHall, facultyBuilding, archGate };
