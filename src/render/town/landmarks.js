// その場所だけの目印（設計書 4・4.1）。写真と見くらべて作る
// 部品の前（道の側）は +z、道ぞいの長さは x、地面は y = 0（src/render/town/kit.js と同じ）
import { COLORS, tower, bus } from './kit.js';

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
function westlakeVillas(b, opts = {}) {
  b.box(110, 12, 36, COLORS.white, 0, 0, -22); // 駐車場（多階）
  for (let f = 1; f < 5; f++) b.box(110.4, 0.6, 36.4, 0xaeb4b4, 0, f * 2.6, -22); // 横じまの帯
  for (const [x, z] of [[-40, -28], [-13, -34], [14, -28], [41, -34]]) {
    b.push(x, 12, z);
    tower(b, { floors: 20, width: 18, depth: 16, color: 0xe2e3df, stripe: 0x5f7f78 });
    b.pop();
  }
  // 交差点の角の植え込みと、青い曲がった看板「WestLake Villas」（建物は道から奥にあるが、看板は道ばた: front で道ばたまでの距離）
  const front = opts.front ?? 26;
  b.box(16, 0.4, 6, COLORS.grass, -46, 0, front);
  b.box(9, 1.6, 0.4, 0x2a62b8, -46, 0.4, front + 1);
  b.label(textDraw('WestLake Villas', '#ffffff', '#2a62b8', 'italic bold'), [512, 96], -46, 1.2, front + 1.25, 0, 8.6, 1.4);
}

// F〜H の左の Westlake International School（写真 44〜48、学校（道から）.png）
function westlakeSchool(b) {
  // 道ぞいの灰色の金網のフェンスと、その奥の広い芝生のグラウンド（白いサッカーゴール）
  b.box(130, 1.8, 0.1, 0x8f979c, 0, 0, 0);
  b.box(130, 0.04, 70, 0x6fb64f, 0, 0, -36);
  for (const x of [-45, 45]) {
    b.box(0.15, 2.4, 0.15, COLORS.white, x, 0, -32);
    b.box(0.15, 2.4, 0.15, COLORS.white, x, 0, -39);
    b.box(0.15, 0.15, 7.3, COLORS.white, x, 2.4, -35.5);
  }
  // 校舎（白い5階建て、緑のパネル、オレンジのベランダの帯。屋上に濃い灰色の楕円の屋根と、オレンジの A の字の柱）
  b.push(25, 0, -95);
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
  b.label(textDraw('WESTLAKE / International School', '#2b6b3a', '#ffffff'), [512, 160], 10, 13.5, 11.25, 0, 13, 4);
  b.cyl(1.6, 1.6, 0.2, 16, 0x2b6b3a, -1, 12.5, 11.2);
  b.box(60, 0.4, 6, COLORS.white, -8, 3.6, 14); // 1階の前の、白い柱が並ぶ屋根付きの通路
  for (let x = -36; x <= 20; x += 4) b.box(0.4, 3.6, 0.4, COLORS.white, x, 0, 16.5);
  b.pop();
  // 校舎の前の、赤い舗装の前庭と、白い棒の人の形のオブジェの植え込み
  b.box(50, 0.06, 26, 0xc85a3a, 25, 0, -66);
  b.box(20, 0.3, 5, COLORS.grass, 25, 0, -60);
  for (let x = 17; x <= 33; x += 4) {
    b.box(0.2, 1.2, 0.2, COLORS.white, x - 0.3, 0.3, -60);
    b.box(0.2, 1.2, 0.2, COLORS.white, x + 0.3, 0.3, -60);
    b.box(0.2, 1.2, 0.2, COLORS.white, x, 1.5, -60);
    b.box(1.6, 0.2, 0.2, COLORS.white, x, 2.2, -60);
  }
  // 黄色いスクールバス
  for (let k = 0; k < 4; k++) {
    b.push(-25 + k * 12, 0, -72, Math.PI / 2);
    bus(b);
    b.pop();
  }
  // 入口: 赤レンガの車道、守衛所、道の上の黄色の格子。入口の横に水路と緑の手すりの橋
  b.box(10, 0.07, 40, 0xc85a3a, 55, 0, -20);
  b.box(4, 3, 4, COLORS.white, 50, 0, -12);
  for (let k = -4; k <= 4; k += 2) b.box(10, 0.08, 0.3, 0xf2c200, 55, 0.01, -3 + k);
  b.box(4, 0.1, 30, 0x5f9fc8, 63, 0, -15);
  b.box(0.2, 1, 6, 0x5fae4b, 61, 0, -2);
  // 道ぞいの紫の大きな看板
  b.box(0.3, 4.5, 0.3, 0x333333, 32, 0, 1);
  b.box(0.3, 4.5, 0.3, 0x333333, 40, 0, 1);
  b.box(10, 5, 0.3, 0x3b2a6b, 36, 4.5, 1);
  b.label(textDraw('SEKOLAH ANTARABANGSA / Westlake / International School', '#ffffff', '#3b2a6b'), [512, 256], 36, 7, 1.2, 0, 9.6, 4.6);
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
  // 道ばたの、灰色の低い壁の看板（青と緑の病院のマーク、青い大きな文字）
  b.box(28, 3, 1.5, 0x9a9fa3, -10, 0, -4);
  b.label(textDraw('HOSPITAL UTAR / HOSPITAL UNIVERSITI TUNKU ABDUL RAHMAN', '#1f6fb2', '#9a9fa3'), [512, 128], -10, 1.6, -3.2, 0, 26, 2.6);
  b.box(2.4, 2.4, 0.3, 0x2a9a8f, -24, 1.4, -3.1);
  // 入口の上をまたぐ、青い鉄骨のアーチの橋（三角の骨組み）
  for (let k = 0; k <= 14; k++) {
    const a = (k / 14) * Math.PI;
    b.box(3.4, 0.5, 2.6, 0x2a6fd8, 30 - Math.cos(a) * 20, Math.sin(a) * 9 + 0.5, -12);
    if (k % 2 === 0) b.box(0.25, 1.6, 2.6, 0x2a6fd8, 30 - Math.cos(a) * 20, Math.sin(a) * 9 - 0.8, -12);
  }
  b.box(5, 3, 4, COLORS.white, 22, 0, -6); // 守衛所
  for (let x = 34; x <= 46; x += 2) b.box(1, 0.9, 0.4, x % 4 ? 0xd8262b : 0xffffff, x, 0, -4); // 赤白の車止め
}

// J〜スタートの左の KAMPAR の看板（写真 75J右・76・76左）: 1文字ずつ色がちがう立体の文字
function kamparSign(b) {
  b.box(30, 1.5, 12, COLORS.grass, 0, 0, -6); // 芝生の土手
  b.box(16, 0.1, 6, 0xc8604a, 0, 1.5, 3); // レンガの広場
  for (let k = 0; k < 4; k++) b.box(3, 0.38, 1, 0xb8b2a8, -12, k * 0.38, 2 - k); // 土手を上る階段
  const letters = [['K', '#1d2f6b'], ['A', '#6a2c8f'], ['M', '#1f5fbf'], ['P', '#f2b51f'], ['A', '#2e8f3e'], ['R', '#e8742a']];
  letters.forEach(([ch, color], k) => {
    const x = -7.5 + k * 3;
    b.box(2.5, 3.4, 0.6, parseInt(color.slice(1), 16), x, 1.5, -1.4); // 文字の厚み
    b.label(letterDraw(ch, color), [128, 160], x, 3.3, -1.05, 0, 2.9, 3.6);
  });
  b.label(emblemDraw(), [128, 128], -11.5, 3.6, -1.2, 0, 3, 3); // 丸い紋章（緑の山）
  b.box(0.4, 3, 0.4, 0x7a7a7a, -11.5, 1.5, -1.6);
  // 後ろの4階建ての古いショップハウスの並び
  for (let k = 0; k < 6; k++) b.box(6, 13.6, 12, [0xe6dcc0, 0xc79a6a, 0xd9a48a][k % 3], -15 + k * 6, 0, -24);
  b.label(textDraw('RESTORAN', '#ffffff', '#7a2a1a'), [256, 64], -9, 3.6, -17.9, 0, 6, 1.4);
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
  // 両はしのスロープ（道に平行に、道ばたへ下りる）
  for (const z of [-3, span + 3]) {
    for (let k = 0; k < 8; k++) b.box(3, 0.4, 2.4, COLORS.concrete, 3 + k * 3, top - (k + 1) * (top / 8), z);
  }
}

// J〜スタートの、川と大きな水道管の橋（写真 77）
function pipeBridge(b) {
  b.box(30, 1, 4, 0x8f979c, 0, 3, 0);
  for (const z of [-1, 1]) b.cylX(0.6, 30, 10, 0xc9cdd0, 0, 4.6, z); // 横に寝かせた大きな水道管2本
  for (const x of [-12, 0, 12]) b.box(0.8, 3, 0.8, 0x8f979c, x, 0, 0);
  b.box(30, 0.05, 14, 0x6f8f9f, 0, 0.02, 0); // 川
}

export const PARTS = { westlakeVillas, westlakeSchool, hospitalUtar, kamparSign, footbridge, pipeBridge };
