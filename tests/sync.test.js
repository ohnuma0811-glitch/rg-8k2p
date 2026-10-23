import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEND_MS, INTERP_DELAY_MS, EXTRAP_MAX_MS, BUFFER_SIZE, packKart, unpackKart, entryOf, createBuffer, pushSample, sampleAt, dueToSend } from '../src/net/sync.js';

const kart = {
  x: 1.23456, y: 0.5, z: -7.891, heading: 0.12345, move: 0.2, speed: 33.333, seg: 42,
  drift: { active: true, dir: -1, stage: 2 }, hop: 0.1, hump: 0, tumble: 0, spin: 0, swallowed: false, boost: 0.5, airborne: true,
};

test('送るもの: 短いキーで、数は丸める。0 の飾りは書かない。時刻は2つ（at: 送った端末、t: サーバー）', () => {
  const msg = packKart(kart, { lap: 1, rel: 123.456, checkpoint: true }, 456.78, 1000.6, 'NOW');
  assert.deepEqual(msg, { x: 1.23, y: 0.5, z: -7.89, h: 0.123, m: 0.2, v: 33.33, i: 42, l: 1, c: 1, r: 123.5, p: 456.8, dd: -1, ds: 2, hp: 0.1, bo: 1, ai: 1, at: 1001, t: 'NOW' });
  const plain = packKart({ ...kart, drift: { active: false, dir: 0, stage: 0 }, hop: 0, boost: 0, airborne: false }, { lap: 0, rel: null, checkpoint: false }, -Infinity, 5, 'NOW');
  assert.deepEqual(plain, { x: 1.23, y: 0.5, z: -7.89, h: 0.123, m: 0.2, v: 33.33, i: 42, l: 0, c: 0, at: 5, t: 'NOW' });
});

test('1回の大きさは約150バイト（ふつうに走っているとき）', () => {
  const real = { x: -123.456, y: 12.345, z: -456.789, heading: -3.14159, move: -3.14159, speed: 33.333, seg: 1234, drift: { active: false }, hop: 0, hump: 0, tumble: 0, spin: 0, swallowed: false, boost: 0, airborne: false };
  const msg = packKart(real, { lap: 2, rel: 1234.56, checkpoint: true }, 5678.91, 1761200000000, 1761200000000);
  assert.ok(JSON.stringify(msg).length <= 150, `${JSON.stringify(msg).length} バイト`);
});

test('受け取ったものを、車の形にもどす（書いていない飾りは 0）', () => {
  const p = unpackKart(packKart(kart, { lap: 1, rel: 123.456, checkpoint: true }, 456.78, 1000, 'NOW'));
  assert.deepEqual(p, {
    x: 1.23, y: 0.5, z: -7.89, heading: 0.123, move: 0.2, speed: 33.33, seg: 42,
    drift: { active: true, dir: -1, stage: 2, counter: false, flicks: 0, time: 0 },
    hop: 0.1, hump: 0, tumble: 0, spin: 0, swallowed: false, boost: 1, airborne: true,
  });
  assert.deepEqual(entryOf({ l: 1, r: 123.5, c: 1 }), { lap: 1, rel: 123.5, checkpoint: true });
  assert.deepEqual(entryOf({ l: 0, c: 0 }), { lap: 0, rel: null, checkpoint: false });
});

const s = (at, x, extra = {}) => ({ x, y: 0, z: 0, h: 0, m: 0, v: 10, i: 1, l: 0, c: 0, at, ...extra });

test('補間: はさむ2つのあいだをつなぐ。前より前の時刻は最初のもの。データがなければ null', () => {
  assert.equal(INTERP_DELAY_MS, 200);
  const buf = createBuffer();
  assert.equal(sampleAt(buf, 1000), null);
  assert.equal(pushSample(buf, s(1000, 0)), true);
  assert.equal(pushSample(buf, s(1100, 1, { v: 20 })), true);
  const mid = sampleAt(buf, 1050);
  assert.equal(mid.x, 0.5);
  assert.equal(mid.speed, 15);
  assert.equal(sampleAt(buf, 900).x, 0);
});

test('遅れて届いた・同じ時刻のデータは捨てる（巻き戻らない）', () => {
  const buf = createBuffer();
  pushSample(buf, s(1000, 0));
  pushSample(buf, s(1100, 1));
  assert.equal(pushSample(buf, s(1100, 5)), false, '同じ時刻');
  assert.equal(pushSample(buf, s(1050, 5)), false, '古い');
  assert.equal(pushSample(buf, null), false);
  assert.equal(pushSample(buf, { x: 1 }), false, '時刻がない');
  assert.equal(sampleAt(buf, 1100).x, 1);
});

test('新しいデータがまだなければ、進む向きに速さで先読み（250ms まで。そのあとは止める）', () => {
  assert.equal(EXTRAP_MAX_MS, 250);
  const buf = createBuffer();
  pushSample(buf, s(1000, 0));
  pushSample(buf, s(1100, 1, { m: Math.PI / 2 }));
  const p = sampleAt(buf, 1200);
  assert.ok(Math.abs(p.x - 1) < 1e-9);
  assert.ok(Math.abs(p.z - 1) < 1e-9, '進む向き（m）に 10m/s × 0.1秒');
  assert.ok(Math.abs(sampleAt(buf, 9999).z - 2.5) < 1e-9, '250ms で止まる');
});

test('向きは近い方へ回ってつなぐ（-π と π のさかいめ）', () => {
  const buf = createBuffer();
  pushSample(buf, s(0, 0, { h: 3.1, m: 3.1 }));
  pushSample(buf, s(100, 0, { h: -3.1, m: -3.1 }));
  const p = sampleAt(buf, 50);
  assert.ok(Math.abs(Math.abs(p.heading) - Math.PI) < 0.01, `${p.heading}`);
  assert.ok(Math.abs(Math.abs(p.move) - Math.PI) < 0.01);
});

test('大きく飛んだ（リスポーン・ワープ）2つはつながず、近い方を出す', () => {
  const buf = createBuffer();
  pushSample(buf, s(0, 0));
  pushSample(buf, s(100, 100));
  assert.equal(sampleAt(buf, 40).x, 0);
  assert.equal(sampleAt(buf, 60).x, 100);
});

test('とっておくのは最新の20件', () => {
  const buf = createBuffer();
  for (let i = 0; i < 30; i++) pushSample(buf, s(i * 100, i));
  assert.equal(BUFFER_SIZE, 20);
  assert.equal(buf.list.length, 20);
  assert.equal(buf.list[0].at, 1000);
});

test('送るのは 100ms ごと（1秒に10回）', () => {
  assert.equal(SEND_MS, 100);
  assert.equal(dueToSend(0, 99), false);
  assert.equal(dueToSend(0, 100), true);
});

test('firstValue: 最初の値で解決して購読をやめる。来なければ ms のあと null（対戦のスタート前のサーバー時計。M4-C1）', async () => {
  const { firstValue } = await import('../src/net/sync.js');
  let cb = null;
  let offs = 0;
  const p = firstValue((f) => { cb = f; return () => { offs++; }; }, 1000);
  cb(42);
  cb(43);
  assert.equal(await p, 42);
  assert.equal(offs, 1);
  // すぐ来る（購読の中で同期して呼ばれる）
  let o2 = 0;
  assert.equal(await firstValue((f) => { f(7); return () => { o2++; }; }, 1000), 7);
  assert.equal(o2, 1);
  // 来ない
  assert.equal(await firstValue(() => () => {}, 10), null);
});

test('waitRace と firstValue のいつもの timers は、setTimeout を this なしで呼ぶ（Illegal invocation にならない）', async () => {
  const { firstValue } = await import('../src/net/sync.js');
  const { waitRace } = await import('../src/net/race.js');
  const real = [globalThis.setTimeout, globalThis.clearTimeout];
  const strict = (fn) => function (...a) { if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation'); return fn(...a); };
  globalThis.setTimeout = strict(real[0]);
  globalThis.clearTimeout = strict(real[1]);
  try {
    assert.equal(await firstValue((cb) => { cb(5); return () => {}; }, 50), 5);
    const db = { watch: (p, cb) => { cb('v1'); return () => {}; }, get: async () => ({ id: 'v1' }) };
    const r = await waitRace(db, 'v1', 50);
    assert.equal(r?.id, 'v1');
  } finally {
    [globalThis.setTimeout, globalThis.clearTimeout] = real;
  }
});
