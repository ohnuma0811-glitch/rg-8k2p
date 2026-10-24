// 車の様子を送る・届いた様子をなめらかにつなぐ（設計書 docs/superpowers/specs/2026-10-23-vsrace-design.md の 2章 3・3章）
// /race/karts/{車} = { x y z h m v i l c r p [dd ds hp hu tb sp sw bo ai] at t }（キーの意味は計画書「対戦のレースの決まり」）
export const SEND_MS = 83; // 1秒に12回（2026-10-23 のユーザー依頼で10回から）
export const INTERP_DELAY_MS = 150; // ほかの車は、この分だけ遅らせて表示する（2026-10-23 のユーザー依頼で 200 から）
export const EXTRAP_MAX_MS = 250; // 新しいデータが来ないとき、先読みするのはここまで
export const SNAP_DIST = 30; // これより離れた2つ（リスポーン・ワープ）はつながない（m）
export const BUFFER_SIZE = 20; // とっておくデータの数

const round = (v, n) => Math.round(v * 10 ** n) / 10 ** n;

// 送るもの。prog は進んだ距離（順位用）、at は送る端末の、サーバーとのずれを直した時刻、serverTime は db.SERVER_TIME
export function packKart(kart, entry, prog, at, serverTime) {
  const msg = {
    x: round(kart.x, 2), y: round(kart.y, 2), z: round(kart.z, 2),
    h: round(kart.heading, 3), m: round(kart.move, 3), v: round(kart.speed, 2), i: kart.seg,
    l: entry.lap, c: entry.checkpoint ? 1 : 0,
  };
  if (entry.rel != null) msg.r = round(entry.rel, 1);
  if (Number.isFinite(prog)) msg.p = round(prog, 1);
  // 見た目だけの様子は、0 でないときだけ（ふつうに走っているときは送らない）
  const extra = {
    dd: kart.drift?.active ? kart.drift.dir : 0,
    ds: kart.drift?.active ? kart.drift.stage : 0,
    hp: round(kart.hop || 0, 2),
    hu: round(kart.hump || 0, 2),
    tb: round(kart.tumble || 0, 2),
    sp: round(kart.spin || 0, 2),
    sw: kart.swallowed ? 1 : 0,
    bo: kart.boost > 0 ? 1 : 0,
    ai: kart.airborne ? 1 : 0,
    bl: round(kart.blast || 0, 2),
    sm: kart.small != null && kart.small !== 1 ? round(kart.small, 2) : 0,
    st: round(kart.smallTime || 0, 1),
    sq: round(kart.squash || 0, 2),
    sr: round(kart.star || 0, 1),
    ob: (kart.orbit ?? []).reduce((bits, slot) => bits | (1 << slot), 0),
    oa: kart.orbit?.length ? round(kart.orbitAngle || 0, 2) : 0,
    tr: kart.trailing || 0,
    mu: kart.swapItem ? round(kart.muddy || 0, 1) : 0,
    zp: round(kart.zap || 0, 2),
  };
  for (const [key, val] of Object.entries(extra)) if (val) msg[key] = val;
  msg.at = Math.round(at);
  msg.t = serverTime;
  return msg;
}

export function unpackKart(msg) {
  const dd = msg.dd ?? 0;
  return {
    x: msg.x, y: msg.y ?? 0, z: msg.z,
    heading: msg.h ?? 0, move: msg.m ?? msg.h ?? 0, speed: msg.v ?? 0, seg: msg.i ?? 0,
    drift: { active: dd !== 0, dir: dd, stage: msg.ds ?? 0, counter: false, flicks: 0, time: 0 },
    hop: msg.hp ?? 0, hump: msg.hu ?? 0, tumble: msg.tb ?? 0, spin: msg.sp ?? 0,
    swallowed: !!msg.sw, boost: msg.bo ? 1 : 0, airborne: !!msg.ai,
    blast: msg.bl ?? 0, small: msg.sm ?? 1, smallTime: msg.st ?? 0, squash: msg.sq ?? 0, star: msg.sr ?? 0,
    orbit: [0, 1, 2].filter((slot) => (msg.ob ?? 0) & (1 << slot)), orbitAngle: msg.oa ?? 0,
    trailing: msg.tr ?? 0, muddy: msg.mu ?? 0, swapItem: !!msg.mu, zap: msg.zp ?? 0,
  };
}

// 周回を数えるための様子（race.entries[k] に入れる）
export function entryOf(msg) {
  return { lap: msg.l ?? 0, rel: msg.r ?? null, checkpoint: !!msg.c };
}

// lags: 届いたときの遅れ（こちらの時刻 - at）。端末の時計のずれも入る
export function createBuffer() {
  return { list: [], lags: [] };
}

// 届いたデータを足す。時刻（at）が前のものより古い・同じなら捨てる
export function pushSample(buf, msg, recvAt) {
  if (!msg || typeof msg.at !== 'number') return false;
  const last = buf.list[buf.list.length - 1];
  if (last && msg.at <= last.at) return false;
  buf.list.push(msg);
  if (buf.list.length > BUFFER_SIZE) buf.list.shift();
  if (typeof recvAt === 'number') {
    buf.lags.push(recvAt - msg.at);
    if (buf.lags.length > BUFFER_SIZE) buf.lags.shift();
  }
  return true;
}

// now（こちらの時刻）のときに見せる、送った端末の時刻。最近いちばん早く届いたときの遅れを引き、INTERP_DELAY_MS 遅らせる。
// 端末の時計のずれ（サーバーの時刻への直しのずれ）が見せる時刻に入らない（2026-10-23: スマホの車が坂道でカクカクして埋まった）
export function renderTime(buf, now) {
  const lag = buf.lags?.length ? Math.min(...buf.lags) : 0;
  return now - lag - INTERP_DELAY_MS;
}

function lerpAngle(a, b, t) {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
}

// time（送った端末の時刻の物差し）のときの様子
export function sampleAt(buf, time) {
  const L = buf.list;
  if (!L.length) return null;
  if (time <= L[0].at) return unpackKart(L[0]);
  const last = L[L.length - 1];
  if (time >= last.at) {
    // 先読み: 進む向きに、その速さで（EXTRAP_MAX_MS まで）
    const p = unpackKart(last);
    const dt = Math.min(time - last.at, EXTRAP_MAX_MS) / 1000;
    p.x += Math.cos(p.move) * p.speed * dt;
    p.z += Math.sin(p.move) * p.speed * dt;
    // 高さも、最後の2つの上り下りの速さで（坂道で地面に埋まらない）。ワープで飛んだ2つは使わない
    const prev = L[L.length - 2];
    if (prev && Math.hypot(last.x - prev.x, last.z - prev.z) <= SNAP_DIST) p.y += (((last.y ?? 0) - (prev.y ?? 0)) / (last.at - prev.at)) * 1000 * dt;
    return p;
  }
  let j = 1;
  while (L[j].at <= time) j++;
  const a = unpackKart(L[j - 1]);
  const b = unpackKart(L[j]);
  const u = (time - L[j - 1].at) / (L[j].at - L[j - 1].at);
  if (Math.hypot(b.x - a.x, b.z - a.z) > SNAP_DIST) return u < 0.5 ? a : b;
  const near = u < 0.5 ? a : b; // 数で表せない様子（ドリフト・点の番号など）は近い方
  return {
    ...near,
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    z: a.z + (b.z - a.z) * u,
    heading: lerpAngle(a.heading, b.heading, u),
    move: lerpAngle(a.move, b.move, u),
    speed: a.speed + (b.speed - a.speed) * u,
  };
}

export function dueToSend(lastAt, now) {
  return now - lastAt >= SEND_MS;
}

// subscribe(cb) → 後始末の関数。最初の値が来るまで待つ（ms を過ぎたら null）。値が来たら購読は取り消す
export function firstValue(subscribe, ms, timers = { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (id) => clearTimeout(id) }) {
  return new Promise((resolve) => {
    let done = false;
    let off = null;
    let timer = null;
    const end = (v) => {
      if (done) return;
      done = true;
      timers.clearTimeout(timer);
      if (off) off();
      resolve(v);
    };
    timer = timers.setTimeout(() => end(null), ms);
    off = subscribe((v) => end(v));
    if (done && off) off();
  });
}
