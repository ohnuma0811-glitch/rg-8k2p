// 対戦のアイテムの出来事（設計書 docs/superpowers/specs/2026-10-23-vsitems-design.md の 3章）
// /race/items/{k-n} = { k n ty [it tg id o s c x y z h i v] at t }（キーの意味は計画書「M4-C2 の Global Constraints」）
const round = (v, n) => Math.round(v * 10 ** n) / 10 ** n;
const KEY = /^([0-7])-([0-9]{1,5})$/;

export function itemKey(k, n) {
  return `${k}-${n}`;
}

// seen: 見た（自分が書いた）キー。next[k]: 車 k の次の番号
export function createItemFeed(count) {
  return { seen: new Set(), next: Array.from({ length: count }, () => 0) };
}

export function nextItemKey(feed, k) {
  const key = itemKey(k, feed.next[k]++);
  feed.seen.add(key);
  return key;
}

// 届いた出来事を使ってよいか（まだ見ていない・スタートのあと・キーの形と中身が合う）。使うなら、見たことにして次の番号を進める
export function acceptItem(feed, key, msg, startAt) {
  const m = KEY.exec(key);
  if (!m || feed.seen.has(key) || !msg || typeof msg.at !== 'number') return false;
  if (Number(m[1]) !== msg.k || Number(m[2]) !== msg.n) return false;
  if (startAt == null || msg.at < startAt) return false;
  feed.seen.add(key);
  if (msg.k < feed.next.length) feed.next[msg.k] = Math.max(feed.next[msg.k], msg.n + 1);
  return true;
}

// 出した所（位置・向き・点の番号・最高速）
export function fromOf(kart, topSpeed) {
  return { x: kart.x, y: kart.y ?? 0, z: kart.z, h: kart.heading, i: kart.seg, v: topSpeed };
}

// 送るもの。use・throw・drop は ev.id、hit・orbit・scatter は ev.key がこの出来事のキー
export function packItem(ev, at, serverTime) {
  const key = ev.type === 'use' || ev.type === 'throw' || ev.type === 'drop' ? ev.id : ev.key;
  const [k, n] = key.split('-').map(Number);
  const msg = { k, n, ty: ev.type };
  if (ev.item) msg.it = ev.item;
  if (typeof ev.target === 'number') msg.tg = ev.target;
  if (ev.type === 'hit') msg.id = ev.id;
  if (ev.type === 'orbit') Object.assign(msg, { o: ev.o, s: ev.s });
  if (ev.type === 'scatter') msg.c = ev.c;
  if (ev.from) {
    msg.x = round(ev.from.x, 2);
    msg.y = round(ev.from.y, 2);
    msg.z = round(ev.from.z, 2);
    msg.h = round(ev.from.h, 3);
    msg.i = ev.from.i;
    if (typeof ev.from.v === 'number') msg.v = round(ev.from.v, 2);
  }
  msg.at = Math.round(at);
  msg.t = serverTime;
  return msg;
}

export function unpackItem(key, msg) {
  const ev = { type: msg.ty, k: msg.k, id: msg.ty === 'hit' ? msg.id : key };
  if (msg.it) ev.item = msg.it;
  if (msg.ty === 'use' && msg.it === 'shell') ev.target = typeof msg.tg === 'number' ? msg.tg : null;
  if (msg.ty === 'orbit') Object.assign(ev, { o: msg.o, s: msg.s });
  if (msg.ty === 'scatter') ev.c = msg.c;
  if (typeof msg.x === 'number') {
    ev.from = { x: msg.x, y: msg.y ?? 0, z: msg.z, h: msg.h ?? 0, i: msg.i ?? 0 };
    if (typeof msg.v === 'number') ev.from.v = msg.v;
  }
  ev.at = msg.at;
  return ev;
}

// 遅れ（秒）。時計のずれでマイナス・とても大きくなっても 0〜1
export function lagSec(now, at) {
  return Math.min(1, Math.max(0, (now - at) / 1000));
}

// この端末の車の当たり（stepItems の出力）を、送る出来事にする。番号のない当たり（Star の体当たり）は送らない
export function hitsToEvents(hits, owns) {
  const out = [];
  for (const h of hits) {
    if (!owns(h.k)) continue;
    if (h.type === 'orbitHit') out.push({ type: 'orbit', k: h.k, o: h.o, s: h.s });
    else if (h.id != null && ['blast', 'banana', 'blocked', 'starBlock', 'squash'].includes(h.type)) out.push({ type: 'hit', k: h.k, id: h.id });
    if (h.scatter) out.push({ type: 'scatter', k: h.k, id: h.scatter.id, c: h.scatter.c, from: h.scatter.from });
  }
  return out;
}
