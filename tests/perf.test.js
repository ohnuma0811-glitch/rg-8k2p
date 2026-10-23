import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PING_EVERY_MS, PING_PATH, median, perfScore, startPerf } from '../src/net/perf.js';

test('中央値', () => {
  assert.equal(median([300, 100, 200]), 200);
  assert.equal(median([100, 400, 200, 300]), 250);
});

test('点数: 描ける回数（30点）と電波（70点）。電波は安定を重く見る（遅くても安定 > 速いけどばらつく）', () => {
  assert.equal(perfScore(60, [100, 100, 100]), 93);
  assert.equal(perfScore(60, [200, 200, 200]), 86);
  assert.equal(perfScore(60, [50, 450, 50, 450, 50]), 74);
  assert.ok(perfScore(60, [200, 200, 200]) > perfScore(60, [50, 450, 50, 450, 50]));
  assert.equal(perfScore(30, []), 15, 'まだ測っていない');
  assert.equal(perfScore(90, [3000]), 30, '120fps でも 30点まで。電波は 0点より下にならない');
  assert.equal(perfScore(undefined, []), 0);
});

// 時計を進めながら読む作り物（1回の往復 = step ms）
function pingDb(step, writes, { failGet = () => false, failSet = () => false } = {}) {
  const clock = { t: 0 };
  return {
    clock,
    db: {
      get: async (path) => {
        assert.equal(path, PING_PATH);
        clock.t += step;
        if (failGet()) throw Object.assign(new Error('timeout'), { offline: true });
        return null;
      },
      set: async (path, v) => {
        if (failSet()) throw new Error('denied');
        writes.push([path, v]);
      },
    },
  };
}

test('測り方: すぐ1回、そのあと2秒ごと。点数が2点以上変わったときだけ書く。つながらない回は 1000ms', async () => {
  const writes = [];
  let fail = false;
  const { db, clock } = pingDb(100, writes, { failGet: () => fail });
  let every = null;
  let cleared = null;
  const perf = startPerf(db, 'u1', { fps: () => 60, clock: () => clock.t, timers: { setInterval: (fn, ms) => { every = ms; return 7; }, clearInterval: (id) => { cleared = id; } } });
  await perf.first;
  assert.equal(every, PING_EVERY_MS);
  assert.deepEqual(writes, [['lobby/u1/score', 93]]);
  await perf.tick();
  assert.equal(writes.length, 1, '同じ点数は書かない');
  fail = true;
  await perf.tick(); // [100, 100, 1000] → 中央値 100、ばらつき 300 → 51
  assert.deepEqual(writes[1], ['lobby/u1/score', 51]);
  perf.stop();
  assert.equal(cleared, 7);
});

test('書けなかったら（待合室の行がまだない など）、次にまた書く', async () => {
  const writes = [];
  let deny = true;
  const { db, clock } = pingDb(100, writes, { failSet: () => deny });
  const perf = startPerf(db, 'u1', { fps: () => 60, clock: () => clock.t, timers: { setInterval: () => 1, clearInterval: () => {} } });
  await perf.first;
  assert.equal(writes.length, 0);
  deny = false;
  await perf.tick();
  assert.deepEqual(writes, [['lobby/u1/score', 93]]);
});

test('startPerf のいつもの timers は、ブラウザの setInterval を this なしで呼ぶ（Illegal invocation にならない。2026-10-23 の確かめ）', async () => {
  const { startPerf } = await import('../src/net/perf.js');
  const real = globalThis.setInterval;
  const realClear = globalThis.clearInterval;
  let called = 0;
  // ブラウザと同じく、this が globalThis（か undefined）でないと失敗する setInterval
  globalThis.setInterval = function (f, ms) { if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation'); called++; return 1; };
  globalThis.clearInterval = function () { if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation'); };
  try {
    const db = { get: async () => 20, set: async () => {} };
    const p = startPerf(db, 'u1', { fps: () => 60 });
    await p.first;
    p.stop();
    assert.equal(called, 1);
  } finally {
    globalThis.setInterval = real;
    globalThis.clearInterval = realClear;
  }
});
