// 車どうしの押し合い: 重なったら、おたがいに押し戻すだけ（はじき飛ばさない）
// 高さが離れている（ジャンプで上を飛んでいる）車とはぶつからない
// スピードが少し落ちるのは、ぶつかった最初の1回だけで、空中では落ちない（並んで走ったり飛んだりしても遅くならない）
// prev は前の回にぶつかっていた組（'a-b'）。今回ぶつかっている組を返す
export const KART_RADIUS = 1.1; // 車の大きさ（半径 m）
export const BUMP_KEEP = 0.98; // ぶつかったときに残る速さの割合

export function pushApart(karts, prev = new Set()) {
  const now = new Set();
  const min = KART_RADIUS * 2;
  for (let a = 0; a < karts.length; a++) {
    for (let b = a + 1; b < karts.length; b++) {
      const A = karts[a];
      const B = karts[b];
      if (A.respawn > 0 || B.respawn > 0 || A.tumble > 0 || B.tumble > 0 || Math.abs(A.y - B.y) > 1.5) continue;
      const dx = B.x - A.x;
      const dz = B.z - A.z;
      const d = Math.hypot(dx, dz);
      if (d >= min || d === 0) continue;
      const push = (min - d) / 2;
      const nx = dx / d;
      const nz = dz / d;
      A.x -= nx * push;
      A.z -= nz * push;
      B.x += nx * push;
      B.z += nz * push;
      const key = `${a}-${b}`;
      now.add(key);
      if (!prev.has(key) && !A.airborne && !B.airborne) {
        A.speed *= BUMP_KEEP;
        B.speed *= BUMP_KEEP;
      }
    }
  }
  return now;
}

// k 番の車が、今回新しくぶつかった数（効果音用）。prev・now は pushApart が返す組（'a-b'）
export function newBumps(prev, now, k) {
  let n = 0;
  for (const key of now) {
    if (prev.has(key)) continue;
    const [a, b] = key.split('-').map(Number);
    if (a === k || b === k) n++;
  }
  return n;
}
