// 性能の点数（設計書 docs/superpowers/specs/2026-10-23-vsrace-design.md の 4章）。待合室にいる間、各端末が測って /lobby/{uid}/score に書く。
// 点数がいちばん高い端末が CPU を全部動かす（host）。点数のもとは、1秒に描けている回数と、サーバーとの往復の時間とそのばらつき（電波の安定を重く見る）
export const PING_EVERY_MS = 2000; // 往復を測る間かく
export const PING_KEEP = 5; // 最新の何回で数えるか
export const PING_FAIL_MS = 1000; // つながらなかった回の往復
export const PING_PATH = 'limits/PING'; // だれでも読めて、だれも見ていない所（読むたびにサーバーまで行く）

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function median(list) {
  const s = [...list].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

// 0〜100。描ける回数 30点 + 電波 70点
export function perfScore(fps, rtts) {
  const draw = clamp01((fps || 0) / 60) * 30;
  if (!rtts.length) return Math.round(draw);
  const med = median(rtts);
  const jitter = rtts.reduce((a, r) => a + Math.abs(r - med), 0) / rtts.length;
  const net = clamp01(1 - (med + 2 * jitter) / 1000) * 70;
  return Math.round(draw + net);
}

export async function ping(db, clock = () => Date.now()) {
  const t0 = clock();
  await db.get(PING_PATH);
  return clock() - t0;
}

// fps: 今の fps を返す関数。stop でやめる
export function startPerf(db, uid, { fps, clock = () => Date.now(), every = PING_EVERY_MS, timers = { setInterval, clearInterval } }) {
  const rtts = [];
  let sent = null; // 書けた点数
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      let ms;
      try {
        ms = await ping(db, clock);
      } catch {
        ms = PING_FAIL_MS;
      }
      rtts.push(ms);
      if (rtts.length > PING_KEEP) rtts.shift();
      const s = perfScore(fps(), rtts);
      if (sent === null || Math.abs(s - sent) >= 2) {
        await db.set(`lobby/${uid}/score`, s).then(() => { sent = s; }, () => {});
      }
    } finally {
      busy = false;
    }
  };
  const first = tick();
  const id = timers.setInterval(tick, every);
  return { tick, first, stop: () => timers.clearInterval(id) };
}
