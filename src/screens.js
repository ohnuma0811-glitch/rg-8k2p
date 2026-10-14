// メニューの画面（タイトル、名前、キャラ選び、お知らせ、結果）。どれも、選ばれたものを Promise で返す
import { typeLetter, isValidName } from './names.js?v=a742c76';
import { TITLE_ART, faceSvg } from './titleArt.js?v=a742c76';

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
// タイトルのロゴ（白い文字のロゴ風。2026-10-14 のユーザー依頼）: SUPER / Kyugo & Soki / KART
const LOGO = `
  <h1 class="title logo" aria-label="Super Kyugo &amp; Soki Kart">
    <span class="logo-super">SUPER</span>
    <span class="logo-main">Kyugo <span class="logo-amp">&amp;</span> Soki <span class="logo-kart">KART</span></span>
  </h1>`;

export async function title(root) {
  for (;;) {
    show(root, `
      ${LOGO}
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

const ROW_STEP = 0.35; // 結果の行を1行ずつ出す間かく（秒）
const POINT_STEP = 0.06; // ポイントを1つ数え上げる秒数（カウンターのように）
const POINT_PAUSE = 0.15; // 次の順位のポイントを数え始めるまでの間（秒）

// 結果と大会の順位の表（2026-10-14 のユーザー依頼）
// rows = [{ place: '1st', name, face: { color, character }, extra: タイム や '+10', from, to, me }]
// 行は下の順位から1行ずつ出し、全部出たら、1位から順にポイントを from から to までカウンターのように数え上げる
async function scoreTable(root, heading, rows, buttons) {
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
      .join('')}</table>
    <div class="choices">${buttons.map((b) => `<button type="button" data-pick="${b.id}">${b.label}</button>`).join('')}</div>`);
  const cells = [...root.querySelectorAll('.points')];
  const trs = [...root.querySelectorAll('table.results tr')];
  let stopped = false;
  (async () => {
    for (const n of revealOrder(rows.length)) {
      if (stopped) return;
      await wait(ROW_STEP);
      trs[n].classList.remove('row-wait');
      trs[n].classList.add('row-in');
    }
    for (let n = 0; n < rows.length && !stopped; n++) {
      await wait(POINT_PAUSE);
      const num = cells[n].querySelector('.num');
      for (let p = rows[n].from + 1; p <= rows[n].to && !stopped; p++) {
        num.textContent = String(p);
        await wait(POINT_STEP);
      }
      cells[n].classList.add('done'); // 数え終わったら、ぽんと大きくする
    }
  })();
  const pick = await waitPick(root);
  stopped = true;
  hide(root);
  return pick;
}

// そのレースの結果: rows = [{ place, name, time, points, face, me }]。title は「RACE 2/5」など
export function results(root, rows, raceLabel, buttons) {
  const heading = `<h1 class="results-title">RESULTS<small>${raceLabel}</small></h1>`;
  return scoreTable(root, heading, rows.map((r) => ({ ...r, extra: r.time, from: 0, to: r.points })), buttons);
}

// 大会の順位（合計ポイント）: rows = [{ place, name, total, gained, face, me }]。
// final なら「FINAL STANDINGS」と優勝の名前を出す
export function standings(root, rows, raceLabel, final, buttons) {
  const heading = final
    ? `<h1 class="results-title">FINAL STANDINGS</h1><p class="winner">🏆 WINNER: ${rows[0].name}</p>`
    : `<h1 class="results-title">STANDINGS<small>${raceLabel}</small></h1>`;
  return scoreTable(
    root,
    heading,
    rows.map((r) => ({ ...r, extra: `+${r.gained}`, from: r.total - r.gained, to: r.total })),
    buttons,
  );
}

// 結果の行を出す順（下の順位から）
export function revealOrder(n) {
  return Array.from({ length: n }, (_, i) => n - 1 - i);
}

function wait(sec) {
  return new Promise((r) => setTimeout(r, sec * 1000));
}
