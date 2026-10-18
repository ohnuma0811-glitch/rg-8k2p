// TIME TRIAL のみんなの記録（2026-10-18 のユーザー依頼「ソロで一番速いタイムは全ての端末で共有」）。DOM に依存しない
// Super Kyugo＆Soki Brothers の「みんなのランキング」と同じしくみ: 置き場所は Google スプレッドシート（apps-script/Code.gs）、
// URL は src/config.js。電波がないときは端末にためて、つながったときに送る
export const TIME_RANK = 10; // コースごとに残す人数
const PENDING_KEY = 'race.ttPending';
const CACHE_KEY = 'race.ttShared';
const CHARACTERS = ['kyugo', 'soki'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 「18-Oct-26」
export function dateText(d) {
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${String(d.getFullYear() % 100).padStart(2, '0')}`;
}

export function validTime(e) {
  return Boolean(e)
    && typeof e.id === 'string' && /^[A-Za-z0-9-]{8,40}$/.test(e.id)
    && typeof e.course === 'string' && e.course.length > 0 && e.course.length <= 40
    && typeof e.name === 'string' && /^[A-Z]{1,12}$/.test(e.name)
    && CHARACTERS.includes(e.character)
    && typeof e.time === 'number' && Number.isFinite(e.time) && e.time > 0 && e.time < 3600
    && typeof e.date === 'string' && /^\d{2}-[A-Z][a-z]{2}-\d{2}$/.test(e.date);
}

const pick = ({ id, course, name, character, time, date }) => ({ id, course, name, character, time, date });

function read(storage, key, fallback) {
  try {
    return JSON.parse(storage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function write(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // 保存できない端末でも止まらない
  }
}

// サーバーから受け取った記録を、おかしな記録を除いて整える（{ コース名: [記録] }）
function clean(r) {
  const out = {};
  if (!r || typeof r !== 'object') return out;
  for (const [course, list] of Object.entries(r)) {
    if (Array.isArray(list)) out[course] = list.filter(validTime).map(pick);
  }
  return out;
}

// みんなの記録に、まだ送っていない記録を合わせて、コースごとに速い順の上位 TIME_RANK 人（同じタイムは先にあった方が上）
export function mergeTimes(cache, pending) {
  const all = {};
  for (const [course, list] of Object.entries(cache)) all[course] = [...list];
  for (const p of pending) {
    const list = (all[p.course] ??= []);
    if (!list.some((e) => e.id === p.id)) list.push(pick(p));
  }
  const out = {};
  for (const [course, list] of Object.entries(all)) {
    out[course] = list
      .map((e, i) => ({ e, i }))
      .sort((a, b) => a.e.time - b.e.time || a.i - b.i)
      .map(({ e }) => e)
      .slice(0, TIME_RANK);
  }
  return out;
}

export class SharedTimes {
  constructor({ url, fetch, storage, makeId }) {
    this.url = url;
    this.fetch = fetch;
    this.storage = storage;
    this.makeId = makeId;
    this.pending = read(storage, PENDING_KEY, []).filter(validTime);
    this.cache = clean(read(storage, CACHE_KEY, null));
    this.sending = null;
  }

  get enabled() {
    return Boolean(this.url);
  }

  view() {
    return mergeTimes(this.cache, this.pending);
  }

  // ゴールした記録。まず端末にためて、送る。送る所がないときは、その端末の上位だけを残す
  add(entry) {
    const e = { ...pick(entry), id: entry.id || this.makeId() };
    this.pending.push(e);
    if (!this.enabled) {
      const keep = new Set(Object.values(mergeTimes({}, this.pending)).flat().map((x) => x.id));
      this.pending = this.pending.filter((p) => keep.has(p.id));
    }
    write(this.storage, PENDING_KEY, this.pending);
    return this.flush().then(() => e);
  }

  // ためた記録を送る。送れた物だけ消す（同じ記録が2回届いても、サーバーが1つにまとめる）
  flush() {
    if (!this.enabled) return Promise.resolve();
    if (!this.sending) {
      this.sending = (async () => {
        for (const p of [...this.pending]) {
          try {
            // text/plain で送る（Google のサーバーへ、確認の通信なしで届く）
            const res = await this.fetch(this.url, { method: 'POST', body: JSON.stringify(p) });
            if (!res.ok) break;
          } catch {
            break;
          }
          // 送れた記録は、受け取り直すまで出るように、受け取った記録の方へ移す
          (this.cache[p.course] ??= []).push(pick(p));
          this.pending = this.pending.filter((q) => q.id !== p.id);
          write(this.storage, PENDING_KEY, this.pending);
        }
      })().finally(() => {
        this.sending = null;
      });
    }
    return this.sending;
  }

  // 送ってから、みんなの記録を受け取り直す。つながらなければ前に受け取った物
  async refresh() {
    if (!this.enabled) return this.view();
    await this.flush();
    try {
      const res = await this.fetch(this.url, { method: 'GET' });
      if (res.ok) {
        this.cache = clean(await res.json());
        write(this.storage, CACHE_KEY, this.cache);
      }
    } catch {
      // 前に受け取った物のまま
    }
    return this.view();
  }
}
