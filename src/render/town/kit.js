// 街の部品セット（何度も使う形）。どの部品も (b, opts) を受けとり、builder の b に形を足す
// 部品の前（道の側）は +z、道ぞいの長さは x、地面は y = 0
export const COLORS = {
  concrete: 0xd8d4cc,
  white: 0xf4f2ee,
  glass: 0x6f8ea6,
  darkGlass: 0x3d5566,
  redRoof: 0xb4553a,
  grass: 0x5aa04a,
  trunk: 0x7a5a3a,
  leaf: 0x3f8f3a,
  palmLeaf: 0x4f9a3c,
  cream: 0xe9dcc0,
};

// ショップハウス1軒分（幅 width m）。1階は屋根付きの歩道（柱）、2階から上は窓の並び。屋根は roof: 'red'（赤い瓦）か 'flat'
export function shophouse(b, { floors = 3, width = 6, depth = 14, color = COLORS.cream, roof = 'red', trim = COLORS.white } = {}) {
  const fh = 3.4;
  b.box(width, fh * floors, depth, color, 0, 0, -depth / 2);
  b.box(width, 0.3, 2.2, trim, 0, fh - 0.3, 1.1); // 歩道の屋根
  for (const x of [-width / 2 + 0.2, width / 2 - 0.2]) b.box(0.35, fh - 0.3, 0.35, trim, x, 0, 2); // 柱
  for (let f = 1; f < floors; f++) {
    for (const x of [-width / 4, width / 4]) b.box(width / 3, 1.5, 0.12, COLORS.glass, x, f * fh + 0.9, 0.02);
  }
  if (roof === 'red') {
    b.box(width + 0.4, 0.5, depth + 0.6, COLORS.redRoof, 0, fh * floors, -depth / 2);
    b.box(width * 0.6, 1.2, depth * 0.5, COLORS.redRoof, 0, fh * floors + 0.5, -depth / 2);
  }
}

export function palm(b, { height = 8 } = {}) {
  b.cyl(0.18, 0.28, height, 6, COLORS.trunk, 0, 0, 0);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    b.box(3.2, 0.12, 0.7, COLORS.palmLeaf, Math.cos(a) * 1.4, height - 0.3, Math.sin(a) * 1.4, -a);
  }
}

// 木。crown は葉の広がりの倍率（分離帯の上の若い木は 0.45 くらいにして、道にはみ出さない）
export function tree(b, { height = 7, color = COLORS.leaf, crown = 1 } = {}) {
  b.cyl(0.25, 0.35, height * 0.45, 6, COLORS.trunk, 0, 0, 0);
  b.cyl(2.2 * crown, 2.8 * crown, height * 0.6, 7, color, 0, height * 0.4, 0);
}

export function lamp(b) {
  b.cyl(0.1, 0.14, 8, 6, 0x9aa0a6, 0, 0, 0);
  b.box(1.6, 0.15, 0.3, 0x9aa0a6, 0.7, 7.9, 0);
}

export function railing(b, { length = 10, color = 0xb8bdc2, height = 1.1 } = {}) {
  b.box(length, 0.1, 0.1, color, 0, height, 0);
  b.box(length, 0.08, 0.08, color, 0, height * 0.5, 0);
  for (let x = -length / 2; x <= length / 2; x += 2) b.box(0.08, height, 0.08, color, x, 0, 0);
}

// 塀。pattern: 'school'（青に赤のひし形の模様。学校の塀）など
export function wall(b, { length = 10, height = 2, color = COLORS.concrete, pattern = null } = {}) {
  b.box(length, height, 0.3, color, 0, 0, 0);
  if (pattern === 'school') {
    for (let x = -length / 2 + 1; x < length / 2; x += 2) b.box(0.9, 0.9, 0.05, 0xd8262b, x, height * 0.3, 0.17, 0);
  }
}

export function car(b, { color = 0xdadada } = {}) {
  b.box(4.2, 0.9, 1.8, color, 0, 0.3, 0);
  b.box(2.4, 0.7, 1.6, COLORS.darkGlass, -0.2, 1.2, 0);
}

export function bus(b) {
  b.box(10, 2.6, 2.5, 0xf2c200, 0, 0.4, 0);
  b.box(9.4, 0.8, 2.52, COLORS.darkGlass, 0, 1.7, 0);
}

// 赤白のしまの柵（コースでない道をふさぐ）
export function barrier(b, { length = 10 } = {}) {
  for (let k = 0; k < length; k++) b.box(1, 1, 0.3, k % 2 ? 0xffffff : 0xd8262b, -length / 2 + k + 0.5, 0, 0);
}

// 道ばたの標識を、走ってくる車の方へ向ける回転（左の道ばたでは部品の +x が進む向き、右では逆）
function towardDriver(side) {
  return side < 0 ? -Math.PI / 2 : side > 0 ? Math.PI / 2 : Math.PI;
}

// 進む向きの、青い丸い標識に白い矢印。dir: -1 左、0 まっすぐ、1 右。走ってくる車の方を向く
export function arrowSign(b, { dir = 0, side = -1 } = {}) {
  b.push(0, 0, 0, towardDriver(side));
  b.cyl(0.08, 0.08, 2.2, 6, 0x9aa0a6, 0, 0, 0);
  b.label(arrowDraw(dir), [128, 128], 0, 2.9, 0.06, 0, 1.4, 1.4);
  b.pop();
}
function arrowDraw(dir) {
  const draw = (g, w, h) => {
    g.fillStyle = '#1f5fbf';
    g.beginPath();
    g.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate((dir * Math.PI) / 2);
    g.fillStyle = '#fff';
    g.fillRect(-10, -10, 20, 44);
    g.beginPath();
    g.moveTo(-30, -6);
    g.lineTo(0, -44);
    g.lineTo(30, -6);
    g.fill();
    g.restore();
  };
  draw.key = `arrow${dir}`;
  return draw;
}

// 黄色と黒のしまの矢羽根の板（カーブの向きを指す）
export function chevronBoard(b, { dir = 1, side = -1 } = {}) {
  b.push(0, 0, 0, towardDriver(side));
  for (const x of [-0.6, 0.6]) b.cyl(0.06, 0.06, 1.2, 6, 0x9aa0a6, x, 0, 0);
  const draw = (g, w, h) => {
    g.fillStyle = '#ffd400';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#111';
    for (let x = -h; x < w; x += 48) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + 24 * dir, h / 2);
      g.lineTo(x, h);
      g.lineTo(x + 18, h);
      g.lineTo(x + 18 + 24 * dir, h / 2);
      g.lineTo(x + 18, 0);
      g.fill();
    }
  };
  draw.key = `chevron${dir}`;
  b.label(draw, [256, 96], 0, 1.7, 0.06, 0, 2.4, 0.9);
  b.pop();
}

// コースでない道（少しだけ道を描き、コンクリートの壁と赤白の柵でふさぐ。2026-10-15 のユーザー依頼「街らしく」）
export function stubRoad(b, { width = 14, length = 30 } = {}) {
  b.box(width, 0.03, length, 0x55585e, 0, 0, -length / 2);
  b.box(0.15, 0.04, length, 0xf2f2f2, 0, 0.01, -length / 2); // 真ん中の白線
  for (const x of [-width / 2 - 1.5, width / 2 + 1.5]) b.box(3, 0.15, length, 0xb9b4a8, x, 0, -length / 2); // 歩道
  b.box(width + 6, 0.9, 0.4, 0xd8d4cc, 0, 0, -0.2); // コンクリートの壁（通行止め）
  barrier(b, { length: width });
}

export function tent(b) {
  b.box(5, 2.4, 5, COLORS.white, 0, 0, 0);
  b.cyl(0, 3.6, 1.6, 4, COLORS.white, 0, 2.4, 0);
}

// 高い四角い建物（マンションなど）。stripe は窓の縦の列の色
export function tower(b, { floors = 20, width = 16, depth = 14, color = 0xe2e2df, stripe = 0x6f8a80 } = {}) {
  const h = floors * 3;
  b.box(width, h, depth, color, 0, 0, 0);
  for (const x of [-width / 3, 0, width / 3]) b.box(1.6, h - 2, 0.2, stripe, x, 1, depth / 2 + 0.05);
  b.box(width + 0.6, 1.2, depth + 0.6, 0xf6f6f4, 0, h, 0);
}

// 白黒の木組みのショップハウス（写真 23〜25）: 白い壁に黒い細い格子、三角の屋根
export function timberHouse(b, { floors = 3, width = 7, depth = 14 } = {}) {
  const fh = 3.4;
  const h = fh * floors;
  b.box(width, h, depth, 0xf2efe8, 0, 0, -depth / 2);
  for (let x = -width / 2; x <= width / 2 + 0.01; x += width / 4) b.box(0.18, h - fh, 0.1, 0x2a2a2a, x, fh, 0.03); // 縦の黒い木
  for (let f = 1; f <= floors; f++) b.box(width, 0.18, 0.1, 0x2a2a2a, 0, f * fh - 0.2, 0.03); // 横の黒い木
  for (let f = 1; f < floors; f++) b.box(width / 3, 1.4, 0.12, COLORS.glass, 0, f * fh + 0.9, 0.05);
  b.box(width, 0.3, 2.2, COLORS.white, 0, fh - 0.3, 1.1); // 歩道の屋根
  for (let k = 0; k < 4; k++) b.box(width + 0.4 - k * 1.6, 0.8, depth, 0x4a4f55, 0, h + k * 0.8, -depth / 2); // 三角の屋根（段々）
}

// ガソリンスタンド: 緑と白の平たい屋根を4本の柱で
export function petrolStation(b) {
  for (const [x, z] of [[-6, -2], [6, -2], [-6, -9], [6, -9]]) b.box(0.5, 5, 0.5, COLORS.white, x, 0, z);
  b.box(16, 0.9, 11, 0x1f8f4a, 0, 5, -5.5);
  b.box(16, 0.3, 11.2, COLORS.white, 0, 5.9, -5.5);
  b.box(8, 3.5, 6, COLORS.white, 0, 0, -16); // 小さな店
}

// ファストフード店（実在の店の名前は使わない）
export function fastFood(b) {
  b.box(12, 6, 12, 0xd8262b, 0, 0, -6);
  b.box(12.2, 1.2, 12.2, COLORS.white, 0, 6, -6);
  b.label(textDraw('FRIED CHICKEN', '#d8262b', '#ffffff'), [256, 64], 0, 6.6, 0.15, 0, 10, 1.1);
}

// 屋根付きの通路（学校のまわり。写真 27〜29）。roof の色で青か赤
export function walkway(b, { length = 12, roof = 0x2a5fb8 } = {}) {
  for (let x = -length / 2; x <= length / 2 + 0.01; x += 3) b.box(0.25, 2.6, 0.25, 0x9aa0a6, x, 0, 0);
  b.box(length + 0.6, 0.4, 3, roof, 0, 2.6, 0);
}

// 灰色の横長の平屋の店と、駐車場の屋根（写真 70〜72）
export function shed(b, { color = 0xd9dcdf } = {}) {
  b.box(44, 7, 22, color, 0, 0, -18);
  b.box(44.6, 0.8, 22.6, 0x9aa3ab, 0, 7, -18);
  b.box(30, 0.4, 8, 0x8f969c, 0, 3.2, -3); // 駐車場の屋根
  for (const x of [-14, -7, 0, 7, 14]) b.box(0.3, 3.2, 0.3, 0x9aa0a6, x, 0, -3);
}

// 湖（水の平たい板）
export function lake(b, { width = 120, depth = 80 } = {}) {
  b.box(width, 0.06, depth, 0x5f9fc8, 0, 0.02, -depth / 2);
}

// 低いやぶ
export function bush(b, { color = 0x3c7f35 } = {}) {
  b.box(3, 1.4, 2.4, color, 0, 0, 0);
  b.box(2, 1.9, 1.8, color, 0.8, 0, -0.6);
}

// 家具の店（ショップハウスに青い看板）
export function furnitureShop(b) {
  shophouse(b, { floors: 2, width: 12, color: 0xf0f0f0, roof: 'flat' });
  b.label(textDraw('FURNITURE', '#ffffff', '#1f5fbf'), [256, 64], 0, 5.2, 0.3, 0, 10, 2);
}

function textDraw(text, fg, bg) {
  const draw = (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = `bold ${Math.floor(h * 0.55)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2, w * 0.94);
  };
  draw.key = `text:${text}:${fg}:${bg}`;
  return draw;
}

// 道の上の大きな横断幕（場所が分かるように。2026-10-15 のユーザー依頼）。道のふちに置き、前（+z）の向きに道をまたぐ
// text は「 / 」で2行に。color は布の色
export function banner(b, { text = '', span = 31, color = '#d8262b', fg = '#ffffff', height = 6.5 } = {}) {
  for (const z of [0, span]) b.box(0.3, height + 2.2, 0.3, 0x9aa0a6, 0, 0, z);
  b.box(0.12, 0.12, span, 0x9aa0a6, 0, height + 2.2, span / 2);
  // 布（走ってくる車の方を向ける: 右の道ばたに置くと、部品の +x が走ってくる向き）
  b.label(bannerDraw(text, color, fg), [1024, 160], 0.1, height + 1, span / 2, Math.PI / 2, span - 2, 3.2);
}
function bannerDraw(text, bg, fg) {
  const draw = (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 8;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = fg;
    const lines = text.split(' / ');
    g.font = `italic bold ${Math.floor((h / lines.length) * 0.62)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    lines.forEach((l, k) => g.fillText(l, w / 2, (h * (k + 0.5)) / lines.length, w * 0.92));
  };
  draw.key = `banner:${text}:${bg}:${fg}`;
  return draw;
}

// 走ってくる車の方を向いた、道ばたの大きな看板（道をまっすぐ走っていても見えるように。2026-10-15 のユーザー依頼）
export function driverBoard(b, { text = '', bg = '#2a62b8', fg = '#ffffff', width = 14, height = 3.4, top = 8, side = -1 } = {}) {
  b.push(0, 0, 0, towardDriver(side));
  for (const x of [-width / 2 + 0.6, width / 2 - 0.6]) b.box(0.4, top, 0.4, 0x8f979c, x, 0, -0.3);
  b.box(width + 0.4, height + 0.4, 0.3, 0xffffff, 0, top - height / 2 - 0.2, -0.2);
  b.label(boardDraw(text, bg, fg), [1024, 256], 0, top, 0.02, 0, width, height);
  b.pop();
}
function boardDraw(text, bg, fg) {
  const draw = (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    const lines = text.split(' / ');
    g.font = `bold ${Math.floor((h / lines.length) * 0.6)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    lines.forEach((l, k) => g.fillText(l, w / 2, (h * (k + 0.5)) / lines.length, w * 0.94));
  };
  draw.key = `board:${text}:${bg}:${fg}`;
  return draw;
}

// 信号機（いつも青。2026-10-15 のユーザー依頼）。道ばたに立て、腕を道の上へのばし、走ってくる車の方を向ける
export function trafficLight(b, { side = -1 } = {}) {
  b.cyl(0.14, 0.18, 6, 8, 0x5f666c, 0, 0, 0);
  b.box(0.18, 0.18, 6, 0x5f666c, 0, 5.8, 3); // 道の上へのびる腕（前 +z が道の方）
  b.push(0, 5.2, 5.6, towardDriver(side));
  b.box(1.9, 0.7, 0.5, 0x222222, 0, 0, 0); // 横長の信号の箱
  b.box(0.45, 0.45, 0.1, 0x3a3a3a, -0.6, 0.12, 0.26); // 赤（消えている）
  b.box(0.45, 0.45, 0.1, 0x3a3a3a, 0, 0.12, 0.26); // 黄（消えている）
  b.box(0.45, 0.45, 0.1, 0x2bff6a, 0.6, 0.12, 0.26); // 青（ついている）
  b.pop();
}
