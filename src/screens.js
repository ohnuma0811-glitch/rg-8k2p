// メニューの画面（タイトル、名前、キャラ選び、お知らせ、結果）。どれも、選ばれたものを Promise で返す
import { typeLetter, isValidName } from './names.js?v=e00431b';
import { TITLE_ART } from './titleArt.js?v=e00431b';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

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
  { id: 'timetrial', label: 'TIME TRIAL', icon: '⏱️', sub: 'Practice alone · 3 laps', ready: false },
  { id: 'versus', label: 'VS RACE', icon: '👥', sub: '2〜8 players', ready: false },
  { id: 'battle', label: 'BATTLE', icon: '🎈', sub: '3 hits and you are out', ready: false },
];

// タイトル: 遊び方を選ぶ（2×2 に並べる）。選んだ遊び方の id を返す
export async function title(root, gameName) {
  for (;;) {
    show(root, `
      <h1 class="title">${gameName}</h1>
      <div class="choices modes">${MODES.map((m) => `<button type="button" data-pick="${m.id}"><span class="icon">${m.icon}</span>${m.label}<small>${m.sub}</small></button>`).join('')}</div>
      <p class="note"></p>`);
    root.insertAdjacentHTML('afterbegin', TITLE_ART); // 文字のうしろに、Kyugo と Soki の絵
    const pick = await waitPick(root);
    const mode = MODES.find((m) => m.id === pick);
    if (mode.ready) {
      hide(root);
      return mode.id;
    }
    root.querySelector('.note').textContent = `${mode.label} is coming soon!`;
    await new Promise((r) => setTimeout(r, 1500));
  }
}

// 名前入力: A〜Z のボタン（パソコンのキーボードと同じ並び）、消す、OK。最近の名前はボタンで選べる
export function askName(root, recent) {
  return new Promise((resolve) => {
    let name = '';
    const keys = ROWS.map((row) => `<div class="keyrow">${[...row].map((c) => `<button type="button" class="key" data-key="${c}">${c}</button>`).join('')}</div>`).join('');
    show(root, `
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
    };
    window.addEventListener('keydown', onKey);
    update();
  });
}

// キャラ選び（M2 は Kyugo と Soki。M3 で8人）。note は残り時間など
export async function chooseCharacter(root, chars, note) {
  show(root, `
    <h1>Choose your racer</h1>
    <div class="choices">${chars.map((c) => `<button type="button" data-pick="${c.id}" style="background:${c.color}"><span class="icon">${c.icon}</span>${c.name}</button>`).join('')}</div>
    <p class="note">${note}</p>`);
  const pick = await waitPick(root);
  hide(root);
  return pick;
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

// 結果: rows = [{ place: '1st', name, time: '1:12.34', me }]
export async function results(root, rows, buttons) {
  show(root, `
    <h1>Results</h1>
    <table class="results">${rows.map((r) => `<tr class="${r.me ? 'me' : ''}"><td>${r.place}</td><td>${r.name}</td><td>${r.time}</td></tr>`).join('')}</table>
    <div class="choices">${buttons.map((b) => `<button type="button" data-pick="${b.id}">${b.label}</button>`).join('')}</div>`);
  const pick = await waitPick(root);
  hide(root);
  return pick;
}
