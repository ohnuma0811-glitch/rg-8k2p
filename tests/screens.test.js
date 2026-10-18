import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODES } from '../src/screens.js';

test('タイトルで選べるのは4つ: SOLO RACE / TIME TRIAL / VS RACE / BATTLE（2026-10-14 のユーザー依頼）。いま遊べるのは SOLO RACE と TIME TRIAL（2026-10-18）', () => {
  assert.deepEqual(MODES.map((m) => m.id), ['solo', 'timetrial', 'versus', 'battle']);
  assert.deepEqual(MODES.map((m) => m.label), ['SOLO RACE', 'TIME TRIAL', 'VS RACE', 'BATTLE']);
  assert.deepEqual(MODES.filter((m) => m.ready).map((m) => m.id), ['solo', 'timetrial']);
  for (const m of MODES) assert.ok(m.icon && m.sub, m.id);
});

test('結果は、下の順位から1行ずつ出す（5位 → 1位。2026-10-14 のユーザー依頼）', async () => {
  const { revealOrder } = await import('../src/screens.js');
  assert.deepEqual(revealOrder(5), [4, 3, 2, 1, 0]);
  assert.deepEqual(revealOrder(1), [0]);
});

test('VS RACE と BATTLE には「GAME CODE が必要」と書く（2026-10-14 のユーザー依頼）', () => {
  assert.deepEqual(MODES.filter((m) => m.code).map((m) => m.id), ['versus', 'battle']);
});

test('BACK で1つ前の画面へ: キャラ選び → 名前 → タイトル（2026-10-15 のユーザー依頼）', async () => {
  const { prevScreen, BACK } = await import('../src/screens.js');
  assert.equal(prevScreen('character'), 'name');
  assert.equal(prevScreen('name'), 'title');
  assert.equal(prevScreen('title'), 'title', 'タイトルより前はない');
  assert.equal(typeof BACK, 'string');
});

test('結果・大会の順位の表は、ボタンなし。全部の表示（行が出る・ポイントを数える）が終わって3秒後に次へ（2026-10-16 のユーザー依頼）', async () => {
  const { tableSeconds, AUTO_NEXT_SEC } = await import('../src/screens.js');
  assert.equal(AUTO_NEXT_SEC, 3);
  // 行2つ（0.35秒ずつ）＋ 1位: 0.15秒待って 10pt を数える（0.06秒ずつ）＋ 2位: 0.15秒待って 5pt
  const rows = [{ from: 0, to: 10 }, { from: 0, to: 5 }];
  assert.ok(Math.abs(tableSeconds(rows) - (2 * 0.35 + 0.15 + 10 * 0.06 + 0.15 + 5 * 0.06)) < 1e-9);
  // 前の合計から数える（大会の順位）
  assert.ok(Math.abs(tableSeconds([{ from: 20, to: 23 }]) - (0.35 + 0.15 + 3 * 0.06)) < 1e-9);
});

test('SOLO では、キャラ選びのあとに CPU の速さ（Level 1〜3）を選ぶ画面。BACK でキャラ選びへ（2026-10-17 のユーザー依頼）', async () => {
  const { prevScreen, LEVELS } = await import('../src/screens.js');
  assert.equal(prevScreen('level'), 'character');
  assert.deepEqual(LEVELS.map((l) => l.id), [1, 2, 3]);
  assert.deepEqual(LEVELS.map((l) => l.label), ['Level 1', 'Level 2', 'Level 3']);
});

test('キャラ選びのボタンは、名前の上に Kyugo と Soki の顔（炎と星はなし。2026-10-17 のユーザー依頼）', async () => {
  const { characterButton } = await import('../src/screens.js');
  const html = characterButton({ id: 'soki', name: 'Soki', color: '#1c3c88', icon: '⭐' });
  assert.ok(html.includes('face-svg'), '顔の絵');
  assert.ok(!html.includes('⭐'), '星はなし');
  assert.ok(html.indexOf('face-svg') < html.indexOf('Soki</'), '顔が名前の上');
});

test('Level を選ぶと、そのボタンが光り（ほかは消える）、少し待ってから進む（2026-10-18 のユーザー依頼）', async () => {
  const { markPicked, PICK_GLOW_MS } = await import('../src/screens.js');
  const btn = (id, cls) => ({ dataset: { pick: String(id) }, cls: new Set(cls), classList: { toggle(c, on) { on ? this.owner.cls.add(c) : this.owner.cls.delete(c); } } });
  const list = [btn(1, []), btn(2, ['last']), btn(3, [])];
  list.forEach((b) => { b.classList.owner = b; });
  markPicked(list, '3');
  assert.deepEqual(list.map((b) => [...b.cls].sort().join(',')), ['', '', 'picked']);
  assert.ok(PICK_GLOW_MS >= 300 && PICK_GLOW_MS <= 900);
});

test('TIME TRIAL: 名前 → コース選び → キャラ選び。BACK で1つ前へ（2026-10-18 のユーザー依頼）', async () => {
  const { prevScreen } = await import('../src/screens.js');
  assert.equal(prevScreen('course', 'timetrial'), 'name');
  assert.equal(prevScreen('character', 'timetrial'), 'course');
  assert.equal(prevScreen('name', 'timetrial'), 'title');
  assert.equal(prevScreen('character'), 'name'); // SOLO はいままで
  assert.equal(prevScreen('level'), 'character');
});

test('コース選び: 押したコースを選ぶ（背景に出す）。同じコースをもう一度押すか OK で決まる', async () => {
  const { courseStep } = await import('../src/screens.js');
  assert.deepEqual(courseStep(0, '2'), { selected: 2, done: false });
  assert.deepEqual(courseStep(2, '2'), { selected: 2, done: true });
  assert.deepEqual(courseStep(1, 'ok'), { selected: 1, done: true });
});

test('TIME TRIAL のみんなの記録: コース選びには、いちばん速いタイム・名前・キャラ名。ゴールのあとは上位10位（日付・名前・キャラ名・タイム）', async () => {
  const { recordLine, ttRows } = await import('../src/screens.js');
  const fmt = (s) => `${s.toFixed(2)}s`;
  const chars = { kyugo: 'Kyugo', soki: 'Soki' };
  assert.equal(recordLine({ time: 63.21, name: 'KENTA', character: 'soki' }, chars, fmt), '63.21s  KENTA · Soki');
  assert.equal(recordLine(undefined, chars, fmt), 'No record yet');
  const list = [
    { id: 'a', date: '17-Oct-26', name: 'SOKI', character: 'soki', time: 60 },
    { id: 'b', date: '18-Oct-26', name: 'KYUGO', character: 'kyugo', time: 61.5 },
  ];
  assert.deepEqual(ttRows(list, 'b', chars, fmt), [
    { place: '1st', date: '17-Oct-26', name: 'SOKI', character: 'Soki', time: '60.00s', me: false },
    { place: '2nd', date: '18-Oct-26', name: 'KYUGO', character: 'Kyugo', time: '61.50s', me: true },
  ]);
});
