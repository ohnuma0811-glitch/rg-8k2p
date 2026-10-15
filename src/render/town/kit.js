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

export function tree(b, { height = 7, color = COLORS.leaf } = {}) {
  b.cyl(0.25, 0.35, height * 0.45, 6, COLORS.trunk, 0, 0, 0);
  b.cyl(2.2, 2.8, height * 0.6, 7, color, 0, height * 0.4, 0);
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

// 進む向きの、青い丸い標識に白い矢印。dir: -1 左、0 まっすぐ、1 右
export function arrowSign(b, { dir = 0 } = {}) {
  b.cyl(0.08, 0.08, 2.2, 6, 0x9aa0a6, 0, 0, 0);
  b.label(arrowDraw(dir), [128, 128], 0, 2.9, 0.06, 0, 1.4, 1.4);
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
export function chevronBoard(b, { dir = 1 } = {}) {
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
