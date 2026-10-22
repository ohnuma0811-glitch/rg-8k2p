// 遊べる時間をサーバーにも（設計書 docs/superpowers/specs/2026-10-22-gamecode-design.md の 6章）
// 端末の記録（src/playtime.js）はそのまま。一度でも GAME CODE を正しく入れた端末だけ、
// /playtime/{名前}/{日付}/{uid} に「この端末の合計秒」を絶対値で書く（何度送っても二重にならない）。
// /playtime/{名前}/{日付}/reset は GM のリセットの時刻（ミリ秒）。見たら、この端末の分を0にする
import { dayKey, isLimited, DEFAULT_LIMIT_MIN } from '../playtime.js?v=fe31b32';

const MINE_KEY = 'race.playMine'; // { '名前|日付': この端末の合計秒 }（今日の分だけ）
const RESET_KEY = 'race.playReset'; // { '名前|日付': 見たリセットの時刻 }

// 残りの秒数: 上限（なければ20分）から、端末とサーバーの使った時間の多い方を引く（サーバーが読めないときは端末だけ）
export function remainingWith(localUsed, serverUsed, limitMin) {
  const used = Math.max(localUsed, serverUsed ?? 0);
  return Math.max(0, (limitMin ?? DEFAULT_LIMIT_MIN) * 60 - used);
}

// p を最長 ms 待つ（遅くても進む。失敗しても投げない）。SOLO の名前の画面で、つながらない端末を長く待たせないため
export function waitUpTo(p, ms) {
  return Promise.race([p.catch(() => undefined), new Promise((r) => setTimeout(r, ms))]);
}

// 読んでも書いても投げない storage（ブロックされた端末・null でも止まらない）
export function safeStorage(raw) {
  return {
    getItem(k) {
      try {
        return raw ? raw.getItem(k) : null;
      } catch {
        return null;
      }
    },
    setItem(k, v) {
      try {
        raw?.setItem(k, v);
      } catch {
        // 保存できない端末でも止まらない
      }
    },
  };
}

function read(storage, k) {
  try {
    return JSON.parse(storage.getItem(k)) ?? {};
  } catch {
    return {};
  }
}
function write(storage, k, v) {
  try {
    storage.setItem(k, JSON.stringify(v));
  } catch {
    // 保存できない端末でも止まらない
  }
}

// getDb(): 入ったことのある端末なら db（{ get, set }）、そうでなければ null（Promise）
// getUid(): この端末の uid（Promise）。onReset(name, day): GM のリセットを見たとき（端末の記録を0にする）
export function createPlaytimeSync({ storage, getDb, getUid, onReset = () => {} }) {
  const cache = {}; // 名前 → { day, others, mine, limit }（サーバーの数字。refresh で読む）
  const mine = read(storage, MINE_KEY); // 開いたときに読む。そのあとは手元の値が正（保存できなくても動く）
  const seenReset = read(storage, RESET_KEY);
  let sending = null;
  let dirty = false;
  const keyOf = (name, nowMs) => `${name}|${dayKey(nowMs)}`;
  const mineNow = (key) => mine[key] ?? 0;

  async function sendAll() {
    const db = await getDb().catch(() => null);
    if (!db) return;
    const uid = await getUid().catch(() => null);
    if (!uid) return;
    for (const [key, sec] of Object.entries(mine)) {
      if (!(sec > 0)) continue;
      const [name, day] = key.split('|');
      try {
        await db.set(`playtime/${name}/${day}/${uid}`, sec);
      } catch {
        return; // つながらない: 同じ数字を次にまた送る
      }
      if (cache[name]?.day === day) cache[name].mine = Math.max(cache[name].mine ?? 0, sec);
    }
  }

  return {
    add(name, nowMs, sec) {
      if (!isLimited(name) || sec <= 0) return;
      const today = dayKey(nowMs);
      for (const k of Object.keys(mine)) if (!k.endsWith(`|${today}`)) delete mine[k];
      const key = keyOf(name, nowMs);
      mine[key] = (mine[key] ?? 0) + sec;
      write(storage, MINE_KEY, mine);
      dirty = true;
    },
    flush() {
      if (sending) {
        dirty = true; // 送っている途中の分は、終わったあとにもう一度
        return sending;
      }
      sending = (async () => {
        do {
          dirty = false;
          await sendAll();
        } while (dirty);
      })().finally(() => {
        sending = null;
      });
      return sending;
    },
    async refresh(name, nowMs) {
      if (!isLimited(name)) return;
      const db = await getDb().catch(() => null);
      if (!db) return;
      const uid = await getUid().catch(() => null);
      const day = dayKey(nowMs);
      try {
        const [node, limit] = await Promise.all([db.get(`playtime/${name}/${day}`), db.get(`limits/${name}`)]);
        const kids = node && typeof node === 'object' ? node : {};
        const key = `${name}|${day}`;
        const reset = typeof kids.reset === 'number' ? kids.reset : 0;
        let serverMine = typeof kids[uid] === 'number' ? kids[uid] : 0;
        if (reset > (seenReset[key] ?? 0)) {
          mine[key] = 0;
          write(storage, MINE_KEY, mine);
          seenReset[key] = reset;
          write(storage, RESET_KEY, seenReset);
          serverMine = 0;
          onReset(name, day);
        }
        let others = 0;
        for (const [k, v] of Object.entries(kids)) if (k !== 'reset' && k !== uid && typeof v === 'number') others += v;
        cache[name] = { day, others, mine: serverMine, limit: typeof limit === 'number' ? limit : null };
      } catch {
        // 読めないときは、前の数字（なければ端末だけ）
      }
    },
    remaining(name, nowMs, localUsed) {
      if (!isLimited(name)) return Infinity;
      const c = cache[name];
      if (!c || c.day !== dayKey(nowMs)) return remainingWith(localUsed, null, null);
      const used = c.others + Math.max(c.mine, mineNow(keyOf(name, nowMs)));
      return remainingWith(used, null, c.limit);
    },
  };
}
