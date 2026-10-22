import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remainingWith, createPlaytimeSync } from '../src/net/playtimeSync.js';
import { dayKey } from '../src/playtime.js';

const NOW = Date.UTC(2026, 9, 22, 3, 0); // 日本時間 12:00
const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};
function fakeDb() {
  const data = {};
  return {
    data,
    offline: false,
    async get(path) {
      if (this.offline) throw Object.assign(new Error('x'), { offline: true });
      return data[path] ?? null;
    },
    async transaction(path, fn) {
      if (this.offline) throw Object.assign(new Error('x'), { offline: true });
      data[path] = fn(data[path] ?? null);
      return true;
    },
  };
}

test('残り: 上限から、端末とサーバーの多い方を引く。読めない（null）ときは端末だけ', () => {
  assert.equal(remainingWith(300, 600, 20), 600);
  assert.equal(remainingWith(900, 600, 20), 300);
  assert.equal(remainingWith(300, null, 20), 900);
  assert.equal(remainingWith(1500, 0, 20), 0);
  assert.equal(remainingWith(0, null, null), 1200, '上限がなければ20分');
});

test('入ったことのある端末: 足した分をサーバーに足す。KYUGO・SOKI だけ', async () => {
  const db = fakeDb();
  const s = createPlaytimeSync({ storage: memory(), getDb: async () => db });
  s.add('KYUGO', NOW, 30);
  s.add('KENTA', NOW, 30);
  await s.flush();
  assert.equal(db.data[`playtime/KYUGO/${dayKey(NOW)}`], 30);
  assert.equal(db.data[`playtime/KENTA/${dayKey(NOW)}`], undefined);
});

test('つながらないときは、ためておき、つながったら足す（端末を開き直しても残る）', async () => {
  const db = fakeDb();
  db.offline = true;
  const storage = memory();
  const a = createPlaytimeSync({ storage, getDb: async () => db });
  a.add('SOKI', NOW, 40);
  await a.flush();
  db.offline = false;
  const b = createPlaytimeSync({ storage, getDb: async () => db });
  await b.flush();
  assert.equal(db.data[`playtime/SOKI/${dayKey(NOW)}`], 40);
});

test('入ったことのない端末（getDb が null）は、サーバーに足さない・読まない', async () => {
  const s = createPlaytimeSync({ storage: memory(), getDb: async () => null });
  s.add('KYUGO', NOW, 30);
  await s.flush();
  await s.refresh('KYUGO', NOW);
  assert.equal(s.remaining('KYUGO', NOW, 100), 1100);
});

test('refresh でサーバーの使った時間と上限を読み、remaining に使う', async () => {
  const db = fakeDb();
  db.data[`playtime/KYUGO/${dayKey(NOW)}`] = 600;
  db.data['limits/KYUGO'] = 30;
  const s = createPlaytimeSync({ storage: memory(), getDb: async () => db });
  await s.refresh('KYUGO', NOW);
  assert.equal(s.remaining('KYUGO', NOW, 100), 1200);
  assert.equal(s.remaining('KENTA', NOW, 100), Infinity, '制限のない名前');
});
