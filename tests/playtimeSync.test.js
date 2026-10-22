import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remainingWith, createPlaytimeSync } from '../src/net/playtimeSync.js';
import { dayKey } from '../src/playtime.js';

const NOW = Date.UTC(2026, 9, 22, 3, 0); // 日本時間 12:00
const DAY = dayKey(NOW);
const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m };
};
// 平らな path → 値 の入れ物。get は、その下の子をまとめて返す（サーバーの木のまね）
function fakeDb() {
  const data = {};
  return {
    data,
    offline: false,
    delay: null, // Promise を入れると、set はそれが終わるまで待つ
    sets: [],
    async get(path) {
      if (this.offline) throw Object.assign(new Error('x'), { offline: true });
      if (path in data) return data[path];
      const kids = Object.keys(data).filter((k) => k.startsWith(`${path}/`));
      if (!kids.length) return null;
      return Object.fromEntries(kids.map((k) => [k.slice(path.length + 1), data[k]]));
    },
    async set(path, value) {
      this.sets.push([path, value]);
      if (this.delay) await this.delay;
      if (this.offline) throw Object.assign(new Error('x'), { offline: true });
      data[path] = value;
    },
  };
}
const make = (db, extra = {}) => createPlaytimeSync({ storage: extra.storage ?? memory(), getDb: async () => db, getUid: async () => 'u1', ...extra });

test('残り: 上限から、端末とサーバーの多い方を引く。読めない（null）ときは端末だけ', () => {
  assert.equal(remainingWith(300, 600, 20), 600);
  assert.equal(remainingWith(900, 600, 20), 300);
  assert.equal(remainingWith(300, null, 20), 900);
  assert.equal(remainingWith(1500, 0, 20), 0);
  assert.equal(remainingWith(0, null, null), 1200, '上限がなければ20分');
});

test('入ったことのある端末: この端末の合計を、自分の uid の下に絶対値で書く。KYUGO・SOKI だけ', async () => {
  const db = fakeDb();
  const s = make(db);
  s.add('KYUGO', NOW, 30);
  s.add('KENTA', NOW, 30);
  await s.flush();
  assert.equal(db.data[`playtime/KYUGO/${DAY}/u1`], 30);
  assert.equal(db.data[`playtime/KENTA/${DAY}/u1`], undefined);
  s.add('KYUGO', NOW, 10);
  await s.flush();
  assert.equal(db.data[`playtime/KYUGO/${DAY}/u1`], 40);
});

test('つながらないときは、ためておき、つながったら送る（端末を開き直しても残る）。何度送っても二重にならない', async () => {
  const db = fakeDb();
  db.offline = true;
  const storage = memory();
  const a = make(db, { storage });
  a.add('SOKI', NOW, 40);
  await a.flush();
  await a.flush();
  await a.flush(); // タイムアウトのあとの再送を何度もしても
  db.offline = false;
  const b = make(db, { storage });
  await b.flush();
  await b.flush();
  assert.equal(db.data[`playtime/SOKI/${DAY}/u1`], 40, '足し算ではなく絶対値なので二重にならない');
});

test('送っている途中で足した秒は、なくならない', async () => {
  const db = fakeDb();
  let release;
  db.delay = new Promise((r) => {
    release = r;
  });
  const s = make(db);
  s.add('KYUGO', NOW, 5);
  const p1 = s.flush();
  await new Promise((r) => setImmediate(r));
  s.add('KYUGO', NOW, 5);
  const p2 = s.flush();
  db.delay = null;
  release();
  await Promise.all([p1, p2]);
  assert.equal(db.data[`playtime/KYUGO/${DAY}/u1`], 10);
});

test('入ったことのない端末（getDb が null）は、サーバーに書かない・読まない', async () => {
  const s = createPlaytimeSync({ storage: memory(), getDb: async () => null, getUid: async () => 'u1' });
  s.add('KYUGO', NOW, 30);
  await s.flush();
  await s.refresh('KYUGO', NOW);
  assert.equal(s.remaining('KYUGO', NOW, 100), 1100);
});

test('refresh: 全端末の合計（reset の時刻は数えない）と上限を読み、remaining に使う。自分の未送信分も入る', async () => {
  const db = fakeDb();
  db.data[`playtime/KYUGO/${DAY}/u2`] = 600;
  db.data[`playtime/KYUGO/${DAY}/u1`] = 100;
  db.data['limits/KYUGO'] = 30;
  const s = make(db, { onReset() {} });
  await s.refresh('KYUGO', NOW);
  assert.equal(s.remaining('KYUGO', NOW, 9999), 1800 - 700, '端末の記録ではなくサーバーの合計');
  s.add('KYUGO', NOW, 150); // 自分の未送信（サーバーの 100 より多い）
  assert.equal(s.remaining('KYUGO', NOW, 9999), 1800 - 750);
  assert.equal(s.remaining('KENTA', NOW, 100), Infinity, '制限のない名前');
});

test('GM のリセットを見たら、その端末の分を0にして、残りが元に戻る（onReset も呼ぶ）', async () => {
  const db = fakeDb();
  const storage = memory();
  const calls = [];
  const s = make(db, { storage, onReset: (name, day) => calls.push([name, day]) });
  s.add('SOKI', NOW, 1200);
  await s.flush();
  await s.refresh('SOKI', NOW);
  assert.equal(s.remaining('SOKI', NOW, 1200), 0);
  // GM がリセット: 日のまとまりを { reset } にする
  delete db.data[`playtime/SOKI/${DAY}/u1`];
  db.data[`playtime/SOKI/${DAY}/reset`] = NOW + 1000;
  await s.refresh('SOKI', NOW);
  assert.deepEqual(calls, [['SOKI', DAY]]);
  assert.equal(s.remaining('SOKI', NOW, 1200), 1200);
  await s.flush();
  assert.equal(db.data[`playtime/SOKI/${DAY}/u1`], undefined, '0 のまま書き戻さない');
  // もう一度読んでも、同じリセットでは何度も0にしない
  s.add('SOKI', NOW, 60);
  await s.refresh('SOKI', NOW);
  assert.equal(calls.length, 1);
  assert.equal(s.remaining('SOKI', NOW, 1200), 1140);
  // 開き直した端末でも、見たリセットは覚えている
  const s2 = make(db, { storage, onReset: (n, d) => calls.push([n, d]) });
  await s2.refresh('SOKI', NOW);
  assert.equal(calls.length, 1);
});

test('storage が読めなくても（getItem が投げても）止まらない', async () => {
  const db = fakeDb();
  const bad = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  const s = make(db, { storage: bad });
  s.add('KYUGO', NOW, 20);
  await s.flush();
  assert.equal(db.data[`playtime/KYUGO/${DAY}/u1`], 20);
});

test('昨日までの記録は残さない', async () => {
  const db = fakeDb();
  const storage = memory();
  const s = make(db, { storage });
  s.add('KYUGO', NOW - 86400000, 50);
  s.add('KYUGO', NOW, 20);
  assert.ok(!storage.getItem('race.playMine').includes('50'));
});

test('safeStorage: 読んでも書いても投げない。storage が null でも動く', async () => {
  const { safeStorage } = await import('../src/net/playtimeSync.js');
  const bad = safeStorage({ getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
  assert.equal(bad.getItem('a'), null);
  assert.doesNotThrow(() => bad.setItem('a', '1'));
  const none = safeStorage(null);
  assert.equal(none.getItem('a'), null);
  const ok = safeStorage(memory());
  ok.setItem('a', '1');
  assert.equal(ok.getItem('a'), '1');
});
