// 森の部品セット（Soki Forest。2026-10-16）。どの部品も (b, opts) を受けとり、builder の b に形を足す
// 部品の前（道の側）は +z、道ぞいの長さは x、地面は y = 0（街の部品 src/render/town/kit.js と同じ）
const TRUNK = 0x6b4a2f; // こげ茶の幹
const LOG = 0x7a5230; // 丸太
const LOG_DARK = 0x5e3f25;
const LEAF = [0x5fbf3f, 0x4caa36, 0x3f962f, 0x6fcf4a]; // ブロッコリーの木の葉（明るい緑と緑）

// ブロッコリーのような木: こげ茶の幹の上に、丸いかたまりを少しずつずらして重ねる。k で形を変える
export function broccoliTree(b, { size = 1, k = 0 } = {}) {
  const h = 4 * size;
  b.cyl(0.35 * size, 0.5 * size, h, 6, TRUNK, 0, 0, 0);
  const n = 2 + (k % 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + k;
    const r = (2 + ((k + i) % 3) * 0.5) * size;
    const off = i === 0 ? 0 : 1.6 * size;
    const y = h - 0.6 * size + (i === 0 ? 1.6 * size : ((k + i) % 2) * 0.9 * size);
    // 丸いかたまり: 下が広く上がすぼんだ低い円柱を2つ重ねる
    b.cyl(r * 0.85, r, r * 0.9, 6, LEAF[(k + i) % LEAF.length], Math.cos(a) * off, y, Math.sin(a) * off);
    b.cyl(r * 0.45, r * 0.85, r * 0.55, 6, LEAF[(k + i + 1) % LEAF.length], Math.cos(a) * off, y + r * 0.9, Math.sin(a) * off);
  }
}

// 大きな丘の頂上の大きな木（ほかより3倍大きい）
export function bigTree(b) {
  broccoliTree(b, { size: 3, k: 5 });
}

// 丸太の柵（長さ length、道ぞい x）
export function logFence(b, { length = 6 } = {}) {
  b.cylX(0.18, length, 6, LOG, 0, 0.55, 0);
  b.cylX(0.18, length, 6, LOG, 0, 1.05, 0);
  for (let x = -length / 2; x <= length / 2 + 0.01; x += 2) b.cyl(0.16, 0.18, 1.3, 6, LOG_DARK, x, 0, 0);
}

// 大きな丘の見晴らしの柵（木のまわりを丸太の柵で囲む）
export function lookoutFence(b) {
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    b.push(Math.cos(a) * 9, 0, Math.sin(a) * 9, -a + Math.PI / 2);
    logFence(b, { length: 8 });
    b.pop();
  }
}

// 道をまたぐ丸太の門と、木の板の看板（text。小文字もそのまま）。道のふちに置き、前（+z）の向きに道をまたぐ
export function logGate(b, { text = '', span = 32 } = {}) {
  const height = 7;
  for (const z of [0, span]) {
    b.cyl(0.7, 0.8, height + 1.5, 7, LOG, 0, 0, z);
    b.cyl(0.9, 0.9, 0.4, 7, LOG_DARK, 0, height + 1.5, z);
  }
  b.push(0, height, span / 2, 0);
  b.box(0.9, 0.9, span + 2, LOG, 0, 0, 0);
  b.box(0.8, 0.8, span + 1, LOG_DARK, 0, 1.0, 0);
  b.pop();
  // 看板の板（白い地にこげ茶の文字）。走ってくる車の方を向ける
  b.box(0.3, 3, span * 0.55, 0x8a6038, 0, height - 3.2, span / 2);
  for (const x of [-0.16, 0.16]) b.label(gateDraw(text), [512, 128], x, height - 1.7, span / 2, x < 0 ? -Math.PI / 2 : Math.PI / 2, span * 0.5, 2.5);
}
function gateDraw(text) {
  const draw = (g, w, h) => {
    g.fillStyle = '#f6efe0';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#5e3f25';
    g.lineWidth = 8;
    g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#5e3f25';
    g.font = `bold ${Math.floor(h * 0.58)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 3, w * 0.92);
  };
  draw.key = `gate:${text}`;
  return draw;
}

// 赤いかさに白い水玉のきのこ（size 倍）
export function mushroom(b, { size = 1 } = {}) {
  const s = size;
  b.cyl(0.45 * s, 0.6 * s, 1.6 * s, 8, 0xf3eee2, 0, 0, 0);
  b.cyl(0, 1.7 * s, 1.3 * s, 10, 0xd8302a, 0, 1.4 * s, 0);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    b.box(0.35 * s, 0.2 * s, 0.35 * s, 0xffffff, Math.cos(a) * 0.95 * s, 1.75 * s, Math.sin(a) * 0.95 * s, a);
  }
  b.box(0.35 * s, 0.2 * s, 0.35 * s, 0xffffff, 0, 2.55 * s, 0);
}

// 岩（灰色の箱を重ねる）
export function rock(b, { size = 1 } = {}) {
  const s = size;
  b.box(2.6 * s, 1.6 * s, 2.0 * s, 0x8d8b86, 0, 0, 0, 0.3);
  b.box(1.6 * s, 1.0 * s, 1.4 * s, 0x9c9a94, 0.4 * s, 1.4 * s, 0.1 * s, -0.4);
}

// 切り株
export function stump(b) {
  b.cyl(0.7, 0.8, 0.8, 8, LOG, 0, 0, 0);
  b.cyl(0.62, 0.62, 0.05, 8, 0xd9b77e, 0, 0.8, 0);
}

// 低い草と、赤・黄・白の小さな花
export function flowers(b) {
  b.box(2.4, 0.4, 1.4, 0x4f9f3a, 0, 0, 0);
  const colors = [0xe2443a, 0xf2c530, 0xffffff, 0xe2443a, 0xf2c530];
  colors.forEach((c, k) => b.box(0.3, 0.3, 0.3, c, -1 + k * 0.5, 0.4, ((k * 3) % 3) * 0.4 - 0.4));
}

// 草のしげみ
export function bush(b, { size = 1 } = {}) {
  const s = size;
  b.cyl(1.0 * s, 1.4 * s, 1.0 * s, 7, 0x3f8f30, 0, 0, 0);
  b.cyl(0.5 * s, 1.0 * s, 0.7 * s, 7, 0x4caa36, 0.4 * s, 0.9 * s, -0.2 * s);
}

// サルのいる高い木（内の道の道ばた）: 高い幹の、高さ 9m に道の方（+x）へのびる枝、その上に葉。サルは枝の上にすわる
export function monkeyTree(b) {
  b.cyl(0.55, 0.8, 13, 7, TRUNK, -1.5, 0, 0);
  b.box(3.5, 0.45, 0.45, TRUNK, 0, 8.6, 0);
  b.cyl(2.6, 3.4, 2.6, 7, LEAF[1], -1.5, 12, 0);
  b.cyl(1.4, 2.6, 1.6, 7, LEAF[3], -1.5, 14.6, 0);
  b.cyl(1.8, 2.4, 1.6, 7, LEAF[2], 0.5, 10.6, 1.2);
}
