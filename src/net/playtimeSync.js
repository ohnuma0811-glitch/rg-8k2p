// 遊べる時間をサーバーにも（設計書 docs/superpowers/specs/2026-10-22-gamecode-design.md の 6章）
// 端末の記録（src/playtime.js）はそのまま。一度でも GAME CODE を正しく入れた端末だけ、/playtime/{名前}/{日付} に足す
import { dayKey, isLimited, DEFAULT_LIMIT_MIN } from '../playtime.js';

const PENDING_KEY = 'race.playPending';

// 残りの秒数: 上限（なければ20分）から、端末とサーバーの使った時間の多い方を引く（サーバーが読めないときは端末だけ）
export function remainingWith(localUsed, serverUsed, limitMin) {
  const used = Math.max(localUsed, serverUsed ?? 0);
  return Math.max(0, (limitMin ?? DEFAULT_LIMIT_MIN) * 60 - used);
}

function read(storage) {
  try {
    return JSON.parse(storage.getItem(PENDING_KEY)) ?? {};
  } catch {
    return {};
  }
}
function write(storage, v) {
  try {
    storage.setItem(PENDING_KEY, JSON.stringify(v));
  } catch {
    // 保存できない端末でも止まらない
  }
}

// getDb(): 入ったことのある端末なら db（{ get, transaction }）、そうでなければ null（Promise）
export function createPlaytimeSync({ storage, getDb }) {
  const cache = {}; // 名前 → { day, used, limit }（サーバーの数字。refresh で読む）
  let sending = null;
  return {
    add(name, nowMs, sec) {
      if (!isLimited(name) || sec <= 0) return;
      const p = read(storage);
      const key = `${name}|${dayKey(nowMs)}`;
      p[key] = (p[key] ?? 0) + sec;
      write(storage, p);
    },
    flush() {
      sending ??= (async () => {
        const db = await getDb().catch(() => null);
        if (!db) return;
        for (const [key, sec] of Object.entries(read(storage))) {
          const [name, day] = key.split('|');
          try {
            await db.transaction(`playtime/${name}/${day}`, (cur) => (cur ?? 0) + sec);
          } catch {
            return; // つながらない: 残りは次に
          }
          const p = read(storage);
          delete p[key];
          write(storage, p);
          if (cache[name]?.day === day) cache[name].used = (cache[name].used ?? 0) + sec;
        }
      })().finally(() => {
        sending = null;
      });
      return sending;
    },
    async refresh(name, nowMs) {
      if (!isLimited(name)) return;
      const db = await getDb().catch(() => null);
      if (!db) return;
      const day = dayKey(nowMs);
      try {
        const [used, limit] = await Promise.all([db.get(`playtime/${name}/${day}`), db.get(`limits/${name}`)]);
        cache[name] = { day, used: typeof used === 'number' ? used : 0, limit: typeof limit === 'number' ? limit : null };
      } catch {
        // 読めないときは、前の数字（なければ端末だけ）
      }
    },
    remaining(name, nowMs, localUsed) {
      if (!isLimited(name)) return Infinity;
      const c = cache[name];
      const fresh = c && c.day === dayKey(nowMs);
      return remainingWith(localUsed, fresh ? c.used : null, fresh ? c.limit : null);
    },
  };
}
