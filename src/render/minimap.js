// 右上のコースマップ: コースの形と、だれがどこを走っているかを点で描く
// 地図の座標: コースの x は右、z は下

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

// 地図を作る。draw(dots) で毎回、車の点を描く。dots = [{ x, z, color, me }]（me は自分の車。大きく、白いふち）
// 大きさは resize() のときだけ調べ、コースの形はそのとき別のキャンバスに1回だけ描いておく（毎フレームは写すだけ）
export function createMinimap(canvas, track) {
  const ctx = canvas.getContext('2d');
  const roadCanvas = document.createElement('canvas');
  let fit = null;
  let w = 0;
  let h = 0;
  let ratio = 1;

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
    fit = mapFit(track.samples, w, h, 8);
    // コースの形とスタートライン
    const rc = roadCanvas.getContext('2d');
    rc.setTransform(ratio, 0, 0, ratio, 0, 0);
    const road = new Path2D();
    track.samples.forEach((p, i) => {
      const q = fit(p.x, p.z);
      if (i === 0) road.moveTo(q.x, q.y);
      else road.lineTo(q.x, q.y);
    });
    road.closePath();
    rc.lineJoin = 'round';
    rc.strokeStyle = 'rgba(255,255,255,0.9)';
    rc.lineWidth = 7;
    rc.stroke(road);
    rc.strokeStyle = '#555c66';
    rc.lineWidth = 4;
    rc.stroke(road);
    const s = track.samples[track.startIndex];
    const q = fit(s.x, s.z);
    rc.fillStyle = '#fff';
    rc.fillRect(q.x - 3, q.y - 3, 6, 6);
  }

  function draw(dots) {
    if (!fit) return;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(roadCanvas, 0, 0, w, h);
    // 自分の車を最後に（いちばん上に）描く
    const order = [...dots].sort((a, b) => (a.me ? 1 : 0) - (b.me ? 1 : 0));
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
