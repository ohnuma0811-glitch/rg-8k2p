import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SharedTimes, mergeTimes, validTime, dateText, TIME_RANK } from '../src/sharedTimes.js';

const COURSE = 'Kyugo Mountain';
const entry = (id, time, name = 'KYUGO', character = 'kyugo', date = '18-Oct-26') => ({ id: `id-${id}-0000`, course: COURSE, name, character, time, date });

function memory() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}
function server() {
  const rows = [];
  const fetch = async (url, opt) => {
    if (opt.method === 'POST') {
      const e = JSON.parse(opt.body);
      if (!rows.some((r) => r.id === e.id)) rows.push(e);
      return { ok: true, json: async () => ({ ok: true }) };
    }
    const out = {};
    for (const r of rows) (out[r.course] ??= []).push(r);
    return { ok: true, json: async () => out };
  };
  return { rows, fetch };
}

test('日付は「18-Oct-26」の形（Super Kyugo＆Soki Brothers と同じ）', () => {
  assert.equal(dateText(new Date(2026, 9, 18)), '18-Oct-26');
  assert.equal(dateText(new Date(2027, 0, 5)), '05-Jan-27');
});

test('記録の決まり: コース・名前（大文字12文字まで）・キャラ・タイム（秒）・日付', () => {
  assert.ok(validTime(entry(1, 63.21)));
  assert.ok(!validTime({ ...entry(1, 63.21), name: 'kyugo' }));
  assert.ok(!validTime({ ...entry(1, 63.21), character: 'mario' }));
  assert.ok(!validTime({ ...entry(1, -3) }));
  assert.ok(!validTime({ ...entry(1, 63.21), date: '2026-10-18' }));
});

test('コースごとに、速い順の上位10人（同じタイムは先にあった方が上）', () => {
  const pending = [...Array(12)].map((_, k) => entry(k, 70 - k));
  const view = mergeTimes({}, pending);
  assert.equal(view[COURSE].length, TIME_RANK);
  assert.equal(view[COURSE][0].time, 59);
  const tie = mergeTimes({ [COURSE]: [entry('a', 60)] }, [entry('b', 60)]);
  assert.deepEqual(tie[COURSE].map((e) => e.id), ['id-a-0000', 'id-b-0000']);
});

test('ゴールしたら送る。みんなの記録を受け取ると、ほかの端末の記録も入る', async () => {
  const srv = server();
  srv.rows.push(entry('other', 61, 'SOKI', 'soki'));
  const a = new SharedTimes({ url: 'https://x', fetch: srv.fetch, storage: memory(), makeId: () => 'id-mine-0000' });
  await a.add({ course: COURSE, name: 'KYUGO', character: 'kyugo', time: 63.21, date: '18-Oct-26' });
  assert.equal(srv.rows.length, 2);
  const view = await a.refresh();
  assert.deepEqual(view[COURSE].map((e) => e.name), ['SOKI', 'KYUGO']);
});

test('電波がないときは、端末にためて、つながったら送る。前に受け取った記録を出す', async () => {
  const srv = server();
  let online = false;
  const fetch = (url, opt) => (online ? srv.fetch(url, opt) : Promise.reject(new Error('offline')));
  const storage = memory();
  const a = new SharedTimes({ url: 'https://x', fetch, storage, makeId: () => 'id-mine-0000' });
  await a.add({ course: COURSE, name: 'KYUGO', character: 'kyugo', time: 63.21, date: '18-Oct-26' });
  assert.equal(srv.rows.length, 0);
  assert.equal(a.view()[COURSE][0].time, 63.21); // 送れなくても、自分の記録は出る
  // 端末を開き直しても、ためた記録は残っている
  const b = new SharedTimes({ url: 'https://x', fetch, storage, makeId: () => 'x' });
  online = true;
  await b.refresh();
  assert.equal(srv.rows.length, 1);
});

test('送る所がないとき（手元の確かめ）は送らず、その端末だけの上位10人', async () => {
  let sent = 0;
  const a = new SharedTimes({ url: '', fetch: async () => { sent++; return { ok: true, json: async () => ({}) }; }, storage: memory(), makeId: (() => { let n = 0; return () => `id-${n++}-0000`; })() });
  for (let k = 0; k < 15; k++) await a.add({ course: COURSE, name: 'KYUGO', character: 'kyugo', time: 80 - k, date: '18-Oct-26' });
  assert.equal(sent, 0);
  assert.equal(a.view()[COURSE].length, TIME_RANK);
  assert.equal(a.pending.length, TIME_RANK); // たまり続けない
});

test('コース名を変えても前の記録は引き継ぐ（Global City → World Cities。2026-10-22 のユーザー依頼）', () => {
  const old = { ...entry('a', 300), course: 'Global City' };
  const now = { ...entry('b', 290), course: 'World Cities' };
  const view = mergeTimes({ 'Global City': [old] }, [now]);
  assert.equal(view['Global City'], undefined);
  assert.deepEqual(view['World Cities'].map((e) => e.time), [290, 300]);
});

test('8人のどのキャラの記録も受け付ける（2026-10-22。キャラ8人）', async () => {
  const { CHARS } = await import('../src/data/characters.js');
  for (const c of CHARS) assert.ok(validTime(entry(1, 63.21, 'KYUGO', c.id)), c.id);
});

test('サーバーが受け付けなかった（{ ok: false }）記録は消さずにためておき、ほかの記録は送る', async () => {
  const rows = [];
  const fetch = async (url, opt) => {
    if (opt.method === 'POST') {
      const e = JSON.parse(opt.body);
      if (e.character === 'tiger') return { ok: true, json: async () => ({ ok: false, error: 'invalid' }) }; // まだ8人分にしていないサーバー
      rows.push(e);
      return { ok: true, json: async () => ({ ok: true }) };
    }
    return { ok: true, json: async () => ({}) };
  };
  let n = 0;
  const a = new SharedTimes({ url: 'https://x', fetch, storage: memory(), makeId: () => `id-mine-000${n++}` });
  await a.add({ course: COURSE, name: 'KYUGO', character: 'tiger', time: 60, date: '18-Oct-26' });
  await a.add({ course: COURSE, name: 'KYUGO', character: 'kyugo', time: 63.21, date: '18-Oct-26' });
  assert.deepEqual(rows.map((e) => e.character), ['kyugo'], 'kyugo の記録は届く');
  assert.equal(a.pending.length, 1, 'tiger の記録は消さずにためる');
  assert.equal(a.view()[COURSE][0].time, 60, '自分の記録は出る');
});

test('apps-script/Code.gs の受け付けるキャラは、ゲームの8人と同じ', async () => {
  const fs = await import('node:fs');
  const { CHARS } = await import('../src/data/characters.js');
  const src = fs.readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
  const list = JSON.parse(src.match(/var CHARACTERS = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  assert.deepEqual(list, CHARS.map((c) => c.id));
});
