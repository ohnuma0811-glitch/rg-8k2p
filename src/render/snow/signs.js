// Kyugo Mountain の案内（2026-10-18 のユーザー依頼）: トンネルのカーブの矢印の板、分かれ道と合流の手前の横断幕
import { createBuilder } from '../town/builder.js?v=0e5d133';
import { banner } from '../town/kit.js?v=0e5d133';

const TURN_LOOK = 15; // 前後この点数の向きの差で、カーブを見る
const TURN_MIN = 0.25; // この角度（rad）より曲がる所に板を置く
const ARROW_EVERY = 12; // 板の間（m）

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// トンネルのカーブの、外がわの壁に置く矢印の板の場所。dir: 1 右へ曲がる、-1 左へ。side: 板を置く壁（外がわ = -dir）
export function curveArrowSpots(track) {
  const { samples } = track;
  const out = [];
  let last = -Infinity;
  for (let i = TURN_LOOK; i < track.length - TURN_LOOK; i++) {
    const p = samples[i];
    if (!p.tunnel || !samples[i - TURN_LOOK].tunnel || !samples[i + TURN_LOOK].tunnel) continue;
    const turn = wrap(samples[i + TURN_LOOK].h - samples[i - TURN_LOOK].h);
    if (Math.abs(turn) < TURN_MIN || i - last < ARROW_EVERY) continue;
    last = i;
    out.push({ i, dir: Math.sign(turn), side: -Math.sign(turn) });
  }
  return out;
}

// 横断幕の場所と文字。分かれ道の手前（本線）と、合流の手前（本線と分かれ道の両方）
export function guideBanners(track) {
  const { samples } = track;
  const out = [];
  for (const path of (track.paths ?? []).slice(1)) {
    out.push({ kind: 'fork', i: (path.fork - 45 + track.length) % track.length, text: 'A ↑ Shortcut     B → Right road', color: '#d8262b' });
    // 合流の手前: その道から見て、合流のあとに曲がる向き（2026-10-18 のユーザー依頼「左に曲がれ、を英語で」）
    for (const i of [(path.join - 40 + track.length) % track.length, path.start + path.count - 40]) {
      out.push({ kind: 'merge', i, text: turnText(track, i, path.join), color: '#2a62b8' });
    }
  }
  return out;
}

// 横断幕の所から、合流の 50m 先までに曲がる向き
export function turnText(track, i, join) {
  let k = join;
  for (let c = 0; c < 50; c++) k = track.samples[k].next;
  const turn = wrap(track.samples[k].h - track.samples[i].h);
  if (turn < -0.35) return '← TURN LEFT';
  if (turn > 0.35) return 'TURN RIGHT →';
  return '↑ GO STRAIGHT';
}

// 黒い板に黄色の矢印（曲がる向きを指す）
function arrowDraw(dir) {
  const draw = (g, w, h) => {
    g.fillStyle = '#111111';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd400';
    for (const k of [0, 1]) {
      const x0 = w * (0.18 + k * 0.36);
      g.beginPath();
      // 右向きの「>」（dir -1 のときは左右を逆に描く）
      const pts = [[0, 0.12], [0.22, 0.5], [0, 0.88], [0.12, 0.88], [0.34, 0.5], [0.12, 0.12]];
      pts.forEach(([x, y], n) => {
        const px = dir > 0 ? x0 + x * w : w - (x0 + x * w);
        if (n === 0) g.moveTo(px, y * h);
        else g.lineTo(px, y * h);
      });
      g.closePath();
      g.fill();
    }
  };
  draw.key = `curveArrow:${dir}`;
  return draw;
}

export function buildSigns(track) {
  const b = createBuilder();
  const ryOf = (p) => Math.PI / 2 - p.h; // 部品の +z を走る向きに（部品の +x は道の左）
  for (const sp of curveArrowSpots(track)) {
    const p = track.samples[sp.i];
    const x = -sp.side * (p.wall + 0.5 - 0.5); // 壁の内がわ（+x が左なので、右（side 1）は -x）
    b.push(p.x, p.y, p.z, ryOf(p));
    // 板の表を、走ってくる車の方（-z）へ
    b.label(arrowDraw(sp.dir), [256, 128], x, 3.2, 0, Math.PI, 3.2, 1.6);
    b.pop();
  }
  for (const bn of guideBanners(track)) {
    const p = track.samples[bn.i];
    // 右の道ばた（柵の所）から、道をまたいで左の柵まで（Kampar Town の横断幕と同じ置き方）
    const d = p.wall;
    const x = p.x - Math.sin(p.h) * d;
    const z = p.z + Math.cos(p.h) * d;
    b.push(x, p.y, z, Math.atan2(Math.sin(p.h), -Math.cos(p.h)));
    banner(b, { text: bn.text, span: 2 * p.wall, color: bn.color });
    b.pop();
  }
  return b.build();
}
