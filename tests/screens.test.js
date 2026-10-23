import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODES } from '../src/screens.js';

test('タイトルで選べるのは4つ: SOLO RACE / TIME TRIAL / VS RACE / BATTLE（2026-10-14 のユーザー依頼）。VS RACE と BATTLE も選べる（M4-A。GAME CODE が要る）', () => {
  assert.deepEqual(MODES.map((m) => m.id), ['solo', 'timetrial', 'versus', 'battle']);
  assert.deepEqual(MODES.map((m) => m.label), ['SOLO RACE', 'TIME TRIAL', 'VS RACE', 'BATTLE']);
  assert.deepEqual(MODES.filter((m) => m.ready).map((m) => m.id), ['solo', 'timetrial', 'versus', 'battle']);
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
  const html = characterButton({ id: 'soki', name: 'Soki', body: 0x1c3c88, icon: '⭐' });
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

test('TIME TRIAL の上位10位の表の上に、英語の項目名', async () => {
  const { TT_HEADINGS } = await import('../src/screens.js');
  assert.deepEqual(TT_HEADINGS, ['RANK', 'DATE', 'PLAYER', 'CHARACTER', 'TIME']);
});

test('コース選びのボタンは5つ: 2列にならべ、最後の1つは真ん中（大きさはそろえる）', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(css, /#menu \.choices\.courses button:last-child:nth-child\(odd\)\s*\{[^}]*grid-column:\s*1\s*\/\s*-1[^}]*justify-self:\s*center/);
});

test('コース選び: ボタンの並びと OK ボタンの間をあける（Global City と OK が重なった。2026-10-21 のユーザー依頼）', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const m = css.match(/#menu \.choices\.courses \{[^}]*margin-bottom:\s*(\d+)px/);
  assert.ok(m && Number(m[1]) >= 28, '下のすき間');
  assert.match(css, /#menu \.choices\.courses button\.picked \{[^}]*box-shadow/);
});

test('キャラ選び: 8人のボタン。色はカートの色、能力は出さない。前に選んだキャラは光る（知らない id なら光らない）', async () => {
  const { characterButton } = await import('../src/screens.js');
  const { CHARS } = await import('../src/data/characters.js');
  const html = CHARS.map((c) => characterButton(c, 'tiger')).join('');
  assert.equal((html.match(/data-pick=/g) ?? []).length, 8);
  assert.ok(html.includes('background:#e67e22'), 'Big Tiger のオレンジ');
  assert.ok(!/SPEED|ACCEL|HANDL|●/.test(html), '能力は出さない');
  assert.equal((html.match(/class="last"/g) ?? []).length, 1);
  assert.ok(characterButton(CHARS[5], 'tiger').includes('class="last"'));
  assert.equal(CHARS.map((c) => characterButton(c, 'nobody')).join('').includes('class="last"'), false);
});

test('GAME CODE の文（英語）', async () => {
  const { codeMessage } = await import('../src/screens.js');
  assert.equal(codeMessage({ kind: 'wrong', left: 3 }), 'Wrong code. 3 tries left.');
  assert.equal(codeMessage({ kind: 'wrong', left: 1 }), 'Wrong code. 1 try left.');
  assert.equal(codeMessage({ kind: 'locked', left: 0 }), 'Too many tries. Ask the Game Master.');
  assert.equal(codeMessage({ kind: 'off', left: 0 }), 'No game code now. Ask the Game Master.');
  assert.equal(codeMessage({ kind: 'offline', left: 0 }), 'No connection');
  assert.equal(codeMessage({ kind: 'setup', left: 0 }), 'Not set up yet');
  assert.equal(codeMessage({ kind: 'need', left: 5 }), '');
});

test('VS RACE と BATTLE は選べる（GAME CODE が要る）', async () => {
  const { MODES } = await import('../src/screens.js');
  for (const id of ['versus', 'battle']) {
    const m = MODES.find((x) => x.id === id);
    assert.equal(m.ready, true);
    assert.equal(m.code, true);
  }
});

// GAME CODE の画面を、ごく簡単な偽の DOM で動かす
function fakeCodeRoot() {
  const note = { textContent: '' };
  const dots = [0, 1, 2, 3].map(() => ({ classList: { toggle() {} } }));
  const root = {
    innerHTML: '',
    onclick: null,
    classList: { add() {}, remove() {} },
    querySelectorAll: () => dots,
    querySelector: () => note,
  };
  const click = (data) => root.onclick?.({ target: { closest: () => ({ dataset: data }) } });
  return { root, note, click };
}

test('GAME CODE: 確かめている途中で BACK を押したら、あとで「入れた」と返ってきても、画面を消さず BACK のまま（I-1）', async () => {
  const listeners = new Set();
  globalThis.window = { addEventListener: (t, f) => listeners.add(f), removeEventListener: (t, f) => listeners.delete(f) };
  try {
    const { enterCode, BACK } = await import('../src/screens.js');
    const { root, click } = fakeCodeRoot();
    let release;
    const slow = new Promise((r) => {
      release = r;
    });
    let calls = 0;
    const p = enterCode(root, async () => {
      calls += 1;
      return slow;
    });
    for (const k of ['1', '2', '3', '4']) click({ key: k });
    click({ key: 'ok' });
    click({ back: '1' });
    assert.equal(await p, BACK);
    root.innerHTML = 'タイトル';
    release({ kind: 'in', left: 0 });
    await new Promise((r) => setImmediate(r));
    assert.equal(root.innerHTML, 'タイトル', '遅れて返ってきた結果で、いまの画面を消さない');
    click({ key: 'ok' });
    assert.equal(calls, 1, '終わったあとのボタンは効かない');
    assert.equal(listeners.size, 0);
  } finally {
    delete globalThis.window;
  }
});

test('対戦の結果: 順位・顔・名前・タイム（ゴールしていなければ —）とコースの名前。ポイントは出さない（M4-C1）', async () => {
  const { vsResultsHtml, VS_RESULTS_SEC } = await import('../src/screens.js');
  assert.equal(VS_RESULTS_SEC, 5);
  const html = vsResultsHtml([
    { place: '1st', name: 'KYUGO', time: '1:20.25', face: { color: '#c11f0a', character: 'kyugo' }, me: true },
    { place: '2nd', name: 'SOKI', time: '—', face: { color: '#1c3c88', character: 'soki' }, me: false },
  ], 'Kampar Town');
  assert.ok(html.includes('RESULTS') && html.includes('Kampar Town'));
  assert.ok(/1st[\s\S]*KYUGO[\s\S]*1:20\.25[\s\S]*2nd[\s\S]*SOKI[\s\S]*—/.test(html));
  assert.equal((html.match(/face-svg/g) ?? []).length, 2);
  assert.equal((html.match(/class="me"/g) ?? []).length, 1);
  assert.ok(!html.includes('class="points"'));
});

test('対戦の QUIT の画面を出している間は、自分の車はブレーキでその場に止まる（M4-C1）', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(/const MENU_BRAKE = \{ steer: 0, brake: false, drift: false, stop: true \};/.test(src), '止まる操作');
  assert.ok(src.includes('vs?.menuOpen ? MENU_BRAKE : controls'), 'QUIT の画面の間はブレーキ');
});
