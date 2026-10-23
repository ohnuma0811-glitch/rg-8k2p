// 右上のコースマップ: コースの形と、だれがどこを走っているかを点で描く
// 地図の座標: コースの x は右、z は下
import { stageAt } from '../game/track.js?v=564e67b';

// コース全体を、幅 w・高さ h（余白 pad）の中に、縦横の比を変えずに収める。(x, z) → { x, y }（画面の点）
export function mapFit(samples, w, h, pad) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of samples) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const scale = Math.min((w - 2 * pad) / (maxX - minX), (h - 2 * pad) / (maxZ - minZ));
  const ox = (w - (maxX - minX) * scale) / 2 - minX * scale;
  const oy = (h - (maxZ - minZ) * scale) / 2 - minZ * scale;
  return (x, z) => ({ x: ox + x * scale, y: oy + z * scale });
}

// 地図に描く道ごとの点の並び: 本線（閉じる）と、分かれ道ごとに「分かれる所＋道の点＋合流する所」。
// 片道のコース（Global City）は、無い道・自動の区間をぬく（その切れ目で道が分かれる）
export function minimapPaths(track) {
  const { samples } = track;
  const paths = track.paths ?? [{ start: 0, count: track.length }];
  const out = [];
  paths.forEach((p, k) => {
    const list = k === 0 ? samples.slice(0, track.length) : [samples[p.fork], ...samples.slice(p.start, p.start + p.count), samples[p.join]];
    if (!list.some((q) => q.void || q.auto)) {
      out.push(list);
      return;
    }
    let run = [];
    for (const q of list) {
      if (q.void || q.auto) {
        if (run.length > 1) out.push(run);
        run = [];
      } else run.push(q);
    }
    if (run.length > 1) out.push(run);
  });
  return out;
}

// 自動の区間（点線で描く）
export function minimapDashes(track) {
  return (track.autos ?? []).map((a) => track.samples.slice(0, track.length).filter((q) => q.auto === a.id));
}

// ステージのあるコース（World Cities）: ステージ k の所だけの地図の線（2026-10-22 のユーザー依頼「エリアごとに表示」）
// スタートの後ろ（道の終わりより後ろの点）はステージ 0、ゴールのあとの周回は最後のステージ
function stageOf(track, q) {
  return stageAt(track, q.s > track.marks.END ? q.s - track.length : q.s);
}
export function stagePaths(track, k) {
  const out = [];
  for (const list of minimapPaths(track)) {
    let run = [];
    for (const q of list) {
      if (stageOf(track, q) === k) run.push(q);
      else {
        if (run.length) out.push(run);
        run = [];
      }
    }
    if (run.length) out.push(run);
  }
  return out;
}

// 地図に出す車の点: ステージのあるコースでは、同じステージにいる車だけ（stage が undefined なら全部）
export function mapDots(dots, stage) {
  return stage === undefined ? dots : dots.filter((d) => d.stage === undefined || d.stage === stage);
}

// 地図を作る。draw(dots) で毎回、車の点を描く。dots = [{ x, z, color, me }]（me は自分の車。大きく、白いふち）
// 大きさは resize() のときだけ調べ、コースの形はそのとき別のキャンバスに1回だけ描いておく（毎フレームは写すだけ）
export function createMinimap(canvas, track) {
  const ctx = canvas.getContext('2d');
  const roadCanvas = document.createElement('canvas');
  let fit = null;
  let w = 0;
  let h = 0;
  let ratio = 1;
  const staged = !!track.stages?.length;
  let stage = 0; // ステージのあるコースで、いま描いているステージ

  function resize() {
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const r = window.devicePixelRatio || 1;
    if (cw === w && ch === h && r === ratio) return;
    w = cw;
    h = ch;
    ratio = r;
    if (!w || !h) return;
    canvas.width = roadCanvas.width = Math.round(w * ratio);
    canvas.height = roadCanvas.height = Math.round(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    build();
  }

  // コースの形（ステージのあるコースは、そのステージの所だけを枠いっぱいに）
  function build() {
    const lines = staged ? stagePaths(track, stage) : minimapPaths(track);
    fit = mapFit(staged ? lines.flat() : track.samples, w, h, 8);
    // コースの形とスタートライン
    const rc = roadCanvas.getContext('2d');
    rc.setTransform(ratio, 0, 0, ratio, 0, 0);
    rc.clearRect(0, 0, w, h);
    const road = new Path2D();
    lines.forEach((ps, k) => {
      ps.forEach((p, i) => {
        const q = fit(p.x, p.z);
        if (i === 0) road.moveTo(q.x, q.y);
        else road.lineTo(q.x, q.y);
      });
      if (k === 0 && !track.open) road.closePath();
    });
    rc.lineJoin = 'round';
    rc.strokeStyle = 'rgba(255,255,255,0.9)';
    rc.lineWidth = 7;
    rc.stroke(road);
    rc.strokeStyle = '#555c66';
    rc.lineWidth = 4;
    rc.stroke(road);
    // 自動の区間（Global City の大ジャンプ・宇宙・ワープ）は、細い点線
    const dash = new Path2D();
    for (const ps of staged ? [] : minimapDashes(track)) {
      ps.forEach((p, i) => {
        const q = fit(p.x, p.z);
        if (i === 0) dash.moveTo(q.x, q.y);
        else dash.lineTo(q.x, q.y);
      });
    }
    rc.setLineDash([4, 4]);
    rc.strokeStyle = 'rgba(255,255,255,0.8)';
    rc.lineWidth = 2;
    rc.stroke(dash);
    rc.setLineDash([]);
    if (staged && stage !== 0) return;
    const s = track.samples[track.startIndex];
    const q = fit(s.x, s.z);
    rc.fillStyle = '#fff';
    rc.fillRect(q.x - 3, q.y - 3, 6, 6);
  }

  // dots = [{ x, z, color, me, stage }]。cur は自分のいるステージ（ステージのあるコースだけ）
  function draw(dots, cur) {
    if (staged && cur !== undefined && cur !== stage && w && h) {
      stage = cur;
      build();
    }
    if (!fit) return;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(roadCanvas, 0, 0, w, h);
    // 自分の車を最後に（いちばん上に）描く
    const order = [...mapDots(dots, staged ? stage : undefined)].sort((a, b) => (a.me ? 1 : 0) - (b.me ? 1 : 0));
    for (const d of order) {
      const p = fit(d.x, d.z);
      ctx.beginPath();
      ctx.arc(p.x, p.y, d.me ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = d.color;
      ctx.fill();
      ctx.lineWidth = d.me ? 2.5 : 1.5;
      ctx.strokeStyle = d.me ? '#fff' : '#222';
      ctx.stroke();
    }
  }

  return { draw, resize };
}
