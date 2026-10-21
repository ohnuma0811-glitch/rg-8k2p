// メニューの画面（タイトル、名前、キャラ選び、お知らせ、結果）。どれも、選ばれたものを Promise で返す
import { typeLetter, isValidName } from './names.js?v=0e78471';
import { TITLE_ART, faceSvg } from './titleArt.js?v=0e78471';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

// 前の画面に戻る（名前入力とキャラ選びの左上の ◀ BACK、パソコンでは Esc。2026-10-15 のユーザー依頼）
export const BACK = 'back';
const SCREENS = ['title', 'name', 'character', 'level'];
// TIME TRIAL（2026-10-18 のユーザー依頼）: 名前のあとにコース選び、キャラ選びでレースへ
const TT_SCREENS = ['title', 'name', 'course', 'character'];
export function prevScreen(screen, mode = 'solo') {
  const list = mode === 'timetrial' ? TT_SCREENS : SCREENS;
  return list[Math.max(0, list.indexOf(screen) - 1)];
}
const BACK_BUTTON = '<button type="button" class="back-btn" data-pick="back" data-back="1">◀ BACK</button>';

function show(root, html) {
  root.innerHTML = `<div class="panel">${html}</div>`;
  root.classList.add('show');
}

function hide(root) {
  root.classList.remove('show');
  root.innerHTML = '';
}

// ボタン（data-pick）が押されるのを待つ
function waitPick(root) {
  return new Promise((resolve) => {
    root.onclick = (e) => {
      const b = e.target.closest('[data-pick]');
      if (b) resolve(b.dataset.pick);
    };
  });
}

// タイトルで選べる遊び方（2026-10-14 のユーザー依頼）。ready でないものは「準備中」と出す
export const MODES = [
  { id: 'solo', label: 'SOLO RACE', icon: '🏁', sub: '1 player + 4 CPU', ready: true },
  { id: 'timetrial', label: 'TIME TRIAL', icon: '⏱️', sub: 'Practice alone · 3 laps', ready: true },
  { id: 'versus', label: 'VS RACE', icon: '👥', sub: '2〜8 players', ready: false, code: true },
  { id: 'battle', label: 'BATTLE', icon: '🎈', sub: '3 hits and you are out', ready: false, code: true },
];
// code: GAME CODE が要る遊び方（ボタンに「🔒 GAME CODE」と書く）

// タイトル: 遊び方を選ぶ（2×2 に並べる）。選んだ遊び方の id を返す
// タイトルのロゴ（白い文字のロゴ風。2026-10-14 のユーザー依頼）: SUPER / Kyugo & Soki / KART
const LOGO = `
  <h1 class="title logo" aria-label="Super Kyugo &amp; Soki Kart">
    <span class="logo-super">SUPER</span>
    <span class="logo-main">Kyugo <span class="logo-amp">&amp;</span> Soki <span class="logo-kart">KART</span></span>
  </h1>`;

// タイトル: 遊び方を選ぶ（2×2 に並べる）。選んだ遊び方の id を返す
// 左上の 🔊/🔇 で音の ON/OFF（sound = { isOn, setOn }）
export async function title(root, sound) {
  show(root, `
      <button type="button" class="sound-btn" aria-label="Sound">${sound.isOn() ? '🔊' : '🔇'}</button>
      ${LOGO}
      <div class="choices modes">${MODES.map((m) => `<button type="button" data-pick="${m.id}"><span class="icon">${m.icon}</span>${m.label}<small>${m.sub}</small>${m.code ? '<span class="need-code">🔒 GAME CODE</span>' : ''}</button>`).join('')}</div>
      <p class="note"></p>`);
  root.insertAdjacentHTML('afterbegin', TITLE_ART); // 文字のうしろに、Kyugo と Soki の絵
  const note = root.querySelector('.note');
  // 音のボタン（data-pick を付けないので、遊び方の選択には混ざらない）
  const soundBtn = root.querySelector('.sound-btn');
  soundBtn.addEventListener('click', () => {
    sound.setOn(!sound.isOn());
    soundBtn.textContent = sound.isOn() ? '🔊' : '🔇';
  });
  let clear = null;
  for (;;) {
    const pick = await waitPick(root);
    const mode = MODES.find((m) => m.id === pick);
    if (mode.ready) {
      clearTimeout(clear);
      hide(root);
      return mode.id;
    }
    // まだ作っていない遊び方: お知らせを少しだけ出す。その間もほかのボタンは押せる
    note.textContent = `${mode.label} is coming soon!`;
    clearTimeout(clear);
    clear = setTimeout(() => {
      note.textContent = '';
    }, 1500);
  }
}

// レースの前: 「RACE 2/5」とコースの名前を大きく出す（うしろはコースを回って映す）。seconds 秒で消える
export async function courseIntro(root, courseName, raceLabel, seconds) {
  root.innerHTML = `<div class="course-intro"><small>${raceLabel}</small>${courseName}</div>`;
  root.classList.add('show', 'intro');
  await new Promise((r) => setTimeout(r, seconds * 1000));
  root.classList.remove('intro');
  hide(root);
}

// 名前入力: A〜Z のボタン（パソコンのキーボードと同じ並び）、消す、OK。最近の名前はボタンで選べる
export function askName(root, recent) {
  return new Promise((resolve) => {
    let name = '';
    const keys = ROWS.map((row) => `<div class="keyrow">${[...row].map((c) => `<button type="button" class="key" data-key="${c}">${c}</button>`).join('')}</div>`).join('');
    show(root, `
      ${BACK_BUTTON}
      <h1>What's your name?</h1>
      <div class="recent">${recent.map((n) => `<button type="button" class="chip" data-name="${n}">${n}</button>`).join('')}</div>
      <div class="name-box"><span class="name"></span><span class="caret">_</span></div>
      <div class="keys">${keys}
        <div class="keyrow"><button type="button" class="key wide" data-key="DEL">⌫</button><button type="button" class="key wide ok" data-key="OK" disabled>OK ▶</button></div>
      </div>`);
    const nameEl = root.querySelector('.name');
    const okEl = root.querySelector('.ok');
    const done = (n) => {
      root.onclick = null;
      window.removeEventListener('keydown', onKey);
      hide(root);
      resolve(n);
    };
    const update = () => {
      nameEl.textContent = name;
      okEl.disabled = !isValidName(name);
    };
    const press = (k) => {
      if (k === 'DEL') name = name.slice(0, -1);
      else if (k === 'OK') {
        if (isValidName(name)) done(name);
        return;
      } else name = typeLetter(name, k);
      update();
    };
    root.onclick = (e) => {
      if (e.target.closest('[data-back]')) return done(BACK);
      const chip = e.target.closest('[data-name]');
      if (chip) return done(chip.dataset.name);
      const key = e.target.closest('[data-key]');
      if (key) press(key.dataset.key);
    };
    // パソコンのキーボードでも打てる
    const onKey = (e) => {
      if (/^Key[A-Z]$/.test(e.code)) press(e.code.slice(3));
      else if (e.code === 'Backspace') press('DEL');
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') press('OK');
      else if (e.code === 'Escape') done(BACK);
    };
    window.addEventListener('keydown', onKey);
    update();
  });
}

// キャラのボタン: 名前の上に顔（2026-10-17 のユーザー依頼。炎と星はなし）
export function characterButton(c) {
  return `<button type="button" data-pick="${c.id}" style="background:${c.color}"><span class="racer-face">${faceSvg(c.id)}</span><span>${c.name}</span></button>`;
}

// キャラ選び（M2 は Kyugo と Soki。M3 で8人）。note は残り時間など
export async function chooseCharacter(root, chars, note) {
  show(root, `
    ${BACK_BUTTON}
    <h1>Choose your racer</h1>
    <div class="choices">${chars.map(characterButton).join('')}</div>
    <p class="note">${note}</p>`);
  // パソコンでは Esc でも戻る
  let onKey;
  const esc = new Promise((resolve) => {
    onKey = (e) => {
      if (e.code === 'Escape') resolve(BACK);
    };
    window.addEventListener('keydown', onKey);
  });
  const pick = await Promise.race([waitPick(root), esc]);
  window.removeEventListener('keydown', onKey);
  root.onclick = null;
  hide(root);
  return pick;
}

// CPU の速さ（2026-10-17 のユーザー依頼）。Level 1 は Soki 用、Level 2 はふつう、Level 3 は大人用
export const LEVELS = [
  { id: 1, label: 'Level 1', sub: 'Easy' },
  { id: 2, label: 'Level 2', sub: 'Normal' },
  { id: 3, label: 'Level 3', sub: 'Hard' },
];
// レースの画面: CPU の速さを選ぶ。選んだ Level（1〜3）か BACK を返す。last は前に選んだ Level（ふちを光らせる）
// コース選び（TIME TRIAL）: 押したコースを選んで背景に出す。同じコースをもう一度押すか OK で決まる
export function courseStep(selected, pick) {
  if (pick === 'ok') return { selected, done: true };
  const k = Number(pick);
  return { selected: k, done: k === selected };
}

// TIME TRIAL のみんなの記録（2026-10-18 のユーザー依頼）: コース選びの「いちばん速いタイム・名前・キャラ名」の1行
// chars: キャラの id → 名前、fmt: タイム（秒）→ 文字
export function recordLine(e, chars, fmt) {
  return e ? `${fmt(e.time)}  ${e.name} · ${chars[e.character] ?? e.character}` : 'No record yet';
}
// ゴールのあとの上位10位の行（日付・名前・キャラ名・タイム）。mineId は今の記録
export function ttRows(list, mineId, chars, fmt) {
  return list.map((e, n) => ({ place: ordinalOf(n + 1), date: e.date, name: e.name, character: chars[e.character] ?? e.character, time: fmt(e.time), me: e.id === mineId }));
}
function ordinalOf(n) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${s}`;
}

// 上位10位の表の項目名（2026-10-18 のユーザー依頼「順位・日付・プレイヤーネーム・操作キャラクター・タイムを英語で」）
export const TT_HEADINGS = ['RANK', 'DATE', 'PLAYER', 'CHARACTER', 'TIME'];

// ゴールのあと: 上位10位の表と、ボタン（AGAIN・COURSES・TITLE）。押したボタンの id を返す
export async function ttResults(root, { course, timeText, note, rows, buttons }) {
  show(root, `
    <h1 class="results-title">TIME TRIAL<small>${course}</small></h1>
    <p class="text">${timeText}${note ? `<br>${note}` : ''}</p>
    <table class="results tt-table"><tr class="tt-head">${TT_HEADINGS.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.length ? rows
      .map((r) => `<tr class="${r.me ? 'me' : ''}"><td class="place">${r.place}</td><td>${r.date}</td><td>${r.name}</td><td>${r.character}</td><td class="time">${r.time}</td></tr>`)
      .join('') : '<tr><td>No record yet</td></tr>'}</table>
    <div class="choices">${buttons.map((b) => `<button type="button" data-pick="${b.id}">${b.label}</button>`).join('')}</div>`);
  const pick = await waitPick(root);
  hide(root);
  return pick;
}

// courses: コースの一覧（name）。onSelect(k): 選んだコースを背景に出す・音を鳴らす。決まったコースの番号か BACK を返す
// records: () => { コース名: 速い順の記録 }、line(e): ボタンに出す記録の1行。refresh: みんなの記録を受け取り直す（終わったら出し直す）
export async function chooseCourse(root, courses, last = 0, { onSelect, records = () => ({}), line = () => '', refresh = null } = {}) {
  const recordHtml = (c) => `<small class="rec">${line((records()[c.name] ?? [])[0])}</small>`;
  show(root, `
    ${BACK_BUTTON}
    <h1>Time Trial</h1>
    <p class="text">Choose a course · tap again to start</p>
    <div class="choices levels courses">${courses.map((c, k) => `<button type="button" data-pick="${k}">${c.name}${recordHtml(c)}</button>`).join('')}</div>
    <div class="choices"><button type="button" class="ok-btn" data-pick="ok">OK ▶</button></div>`);
  root.classList.add('see-through'); // うしろのコースが見えるように
  const buttons = [...root.querySelectorAll('.courses [data-pick]')];
  // ボタンの大きさを、いちばん大きいボタンにそろえる（2026-10-18 のユーザー依頼）
  const evenSize = () => {
    buttons.forEach((b) => { b.style.width = ''; b.style.height = ''; });
    const w = Math.max(...buttons.map((b) => b.offsetWidth));
    const h = Math.max(...buttons.map((b) => b.offsetHeight));
    buttons.forEach((b) => { b.style.width = `${w}px`; b.style.height = `${h}px`; });
  };
  evenSize();
  // みんなの記録を受け取ったら、ボタンの記録を出し直す
  refresh?.then(() => {
    buttons.forEach((b, k) => {
      const rec = b.querySelector('.rec');
      if (rec) rec.outerHTML = recordHtml(courses[k]);
    });
    evenSize();
  });
  let selected = last;
  markPicked(buttons, String(selected));
  onSelect?.(selected, false);
  for (;;) {
    const pick = await waitPick(root);
    if (pick === BACK) break;
    const step = courseStep(selected, pick);
    if (step.done) {
      root.onclick = null;
      root.classList.remove('see-through');
      hide(root);
      return step.selected;
    }
    selected = step.selected;
    markPicked(buttons, String(selected));
    onSelect?.(selected, true);
  }
  root.onclick = null;
  root.classList.remove('see-through');
  hide(root);
  return BACK;
}

// Level を選んだら、そのボタンを光らせ（前の黄色いふちは消す）、PICK_GLOW_MS 待ってから進む（2026-10-18 のユーザー依頼）
export const PICK_GLOW_MS = 600;
export function markPicked(buttons, id) {
  for (const b of buttons) {
    b.classList.toggle('last', false);
    b.classList.toggle('picked', b.dataset.pick === id);
  }
}

// onSelect: 選んだときに鳴らす音など
export async function chooseLevel(root, last = 2, { onSelect } = {}) {
  show(root, `
    ${BACK_BUTTON}
    <h1>Race</h1>
    <p class="text">CPU speed</p>
    <div class="choices levels">${LEVELS.map((l) => `<button type="button" data-pick="${l.id}"${l.id === last ? ' class="last"' : ''}>${l.label}<small>${l.sub}</small></button>`).join('')}</div>`);
  let onKey;
  const esc = new Promise((resolve) => {
    onKey = (e) => {
      if (e.code === 'Escape') resolve(BACK);
    };
    window.addEventListener('keydown', onKey);
  });
  const pick = await Promise.race([waitPick(root), esc]);
  window.removeEventListener('keydown', onKey);
  root.onclick = null;
  if (pick !== BACK) {
    markPicked([...root.querySelectorAll('.levels [data-pick]')], pick);
    onSelect?.(Number(pick));
    await new Promise((r) => setTimeout(r, PICK_GLOW_MS));
  }
  hide(root);
  return pick === BACK ? BACK : Number(pick);
}

// お知らせ（ボタンをいくつか出して、押されたものを返す）
export async function message(root, heading, text, buttons) {
  show(root, `
    <h1>${heading}</h1>
    ${text ? `<p class="text">${text}</p>` : ''}
    <div class="choices">${buttons.map((b) => `<button type="button" data-pick="${b.id}">${b.label}</button>`).join('')}</div>`);
  const pick = await waitPick(root);
  hide(root);
  return pick;
}

const ROW_STEP = 0.35; // 結果の行を1行ずつ出す間かく（秒）
const POINT_STEP = 0.06; // ポイントを1つ数え上げる秒数（カウンターのように）
const POINT_PAUSE = 0.15; // 次の順位のポイントを数え始めるまでの間（秒）
export const AUTO_NEXT_SEC = 3; // 全部の表示が終わってから、次の画面へ移るまで（秒。ボタンはなし。2026-10-16 のユーザー依頼）

// 表を全部出し終わるまでの秒数（行を1行ずつ出す ＋ ポイントを数え上げる）
export function tableSeconds(rows) {
  return rows.length * ROW_STEP + rows.reduce((t, r) => t + POINT_PAUSE + (r.to - r.from) * POINT_STEP, 0);
}

// 結果と大会の順位の表（2026-10-14 のユーザー依頼）
// rows = [{ place: '1st', name, face: { color, character }, extra: タイム や '+10', from, to, me }]
// 行は下の順位から1行ずつ出し、全部出たら、1位から順にポイントを from から to までカウンターのように数え上げる。
// ボタンはなく、全部の表示が終わって AUTO_NEXT_SEC 秒たったら、次の画面へ（2026-10-16 のユーザー依頼）
async function scoreTable(root, heading, rows) {
  show(root, `
    ${heading}
    <table class="results">${rows
      .map(
        (r) => `<tr class="row-wait ${r.me ? 'me' : ''}">
          <td class="place">${r.place}</td>
          <td><span class="who"><span class="face" style="background:${r.face.color}">${faceSvg(r.face.character)}</span>${r.name}</span></td>
          <td class="time">${r.extra}</td>
          <td class="points"><span class="num">${r.from}</span><small>pt</small></td></tr>`,
      )
      .join('')}</table>`);
  const cells = [...root.querySelectorAll('.points')];
  const trs = [...root.querySelectorAll('table.results tr')];
  for (const n of revealOrder(rows.length)) {
    await wait(ROW_STEP);
    trs[n].classList.remove('row-wait');
    trs[n].classList.add('row-in');
  }
  for (let n = 0; n < rows.length; n++) {
    await wait(POINT_PAUSE);
    const num = cells[n].querySelector('.num');
    for (let p = rows[n].from + 1; p <= rows[n].to; p++) {
      num.textContent = String(p);
      await wait(POINT_STEP);
    }
    cells[n].classList.add('done'); // 数え終わったら、ぽんと大きくする
  }
  await wait(AUTO_NEXT_SEC);
  hide(root);
}

// そのレースの結果: rows = [{ place, name, time, points, face, me }]。title は「RACE 2/5」など
export function results(root, rows, raceLabel) {
  const heading = `<h1 class="results-title">RESULTS<small>${raceLabel}</small></h1>`;
  return scoreTable(root, heading, rows.map((r) => ({ ...r, extra: r.time, from: 0, to: r.points })));
}

// 大会の順位（合計ポイント）: rows = [{ place, name, total, gained, face, me }]。
// final なら「FINAL STANDINGS」と優勝の名前を出す
export function standings(root, rows, raceLabel, final) {
  const heading = final
    ? `<h1 class="results-title">FINAL STANDINGS</h1><p class="winner">🏆 WINNER: ${rows[0].name}</p>`
    : `<h1 class="results-title">STANDINGS<small>${raceLabel}</small></h1>`;
  return scoreTable(
    root,
    heading,
    rows.map((r) => ({ ...r, extra: `+${r.gained}`, from: r.total - r.gained, to: r.total })),
  );
}

// 結果の行を出す順（下の順位から）
export function revealOrder(n) {
  return Array.from({ length: n }, (_, i) => n - 1 - i);
}

function wait(sec) {
  return new Promise((r) => setTimeout(r, sec * 1000));
}

// 周回の所の文字（片道のコースはステージ。2026-10-20 のユーザー依頼「STAGE 2/5 HONG KONG」の形）
export function stageText(track, k) {
  return `STAGE ${k + 1}/${track.stages.length} ${track.stages[k].name}`;
}
