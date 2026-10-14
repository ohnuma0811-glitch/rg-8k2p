// 起動。タイトル → 名前 → キャラ選び → SOLO のレース（自分＋CPU 4台、3周）→ 結果
import * as THREE from '../vendor/three.module.min.js?v=3c71db3';
import { startLoop } from './loop.js?v=3c71db3';
import { COURSE1 } from './data/tracks.js?v=3c71db3';
import { buildTrack } from './game/track.js?v=3c71db3';
import { createKart, stepKart, startDash } from './game/kart.js?v=3c71db3';
import { kartParams } from './game/stats.js?v=3c71db3';
import { createCpu, cpuControl, cpuParams, rubberFactor } from './game/cpu.js?v=3c71db3';
import { pushApart } from './game/collide.js?v=3c71db3';
import {
  LAPS, COURSE_INTRO, gridSlot, createRace, raceTick, countdownText, pressDash, takeDash, updateProgress, progress, ranking, ordinal, timeText, racePoints,
} from './game/race.js?v=3c71db3';
import { Controls, attachControls, computeButtonLayout, hasTouch } from './input.js?v=3c71db3';
import { createRenderer, createWorld, resizeRenderer, updateChaseCamera, updateFrontCamera, updateFinishCamera, updateStartCamera, START_FLY_TIME } from './render/scene.js?v=3c71db3';
import { createMinimap } from './render/minimap.js?v=3c71db3';
import { createKartModel, syncKartModel, createNameTag } from './render/models.js?v=3c71db3';
import { faceSvg } from './titleArt.js?v=3c71db3';
import { createEffects } from './render/effects.js?v=3c71db3';
import { nextQuality, pixelRatio } from './render/quality.js?v=3c71db3';
import { blendPose, poseOf } from './render/interp.js?v=3c71db3';
import { speedText } from './hud.js?v=3c71db3';
import { addRecent } from './names.js?v=3c71db3';
import { remainingSec, addPlay, remainingText } from './playtime.js?v=3c71db3';
import { load, save } from './storage.js?v=3c71db3';
import * as screens from './screens.js?v=3c71db3';

// 版番号（公開のときに scripts/deploy.sh がコミットの番号に置き換える。古い版が動いていないか確かめる用）
const VERSION = '3c71db3';
// プレイヤーが選べるキャラ（M3 で8人にする）
const PLAYER_CHARS = [
  { id: 'kyugo', name: 'Kyugo', color: '#c11f0a', icon: '🔥', body: 0xc11f0a },
  { id: 'soki', name: 'Soki', color: '#1c3c88', icon: '⭐', body: 0x1c3c88 },
];
// CPU 4台の見た目（M3 で動物たちにする）
const CPU_LOOKS = [
  { name: 'CPU1', body: 0x2a6fdb, character: 'soki', shirt: 0x2a6fdb },
  { name: 'CPU2', body: 0x2fa36b, character: 'kyugo', shirt: 0x2fa36b },
  { name: 'CPU3', body: 0xf0b429, character: 'soki', shirt: 0xf0b429 },
  { name: 'CPU4', body: 0x8e44ad, character: 'kyugo', shirt: 0x8e44ad },
];
const CPU_COUNT = 4;
const PLAYER_SLOT = 4; // プレイヤーは一番うしろからスタート
const PLAY_SAVE_EVERY = 5; // 遊んだ時間を記録する間かく（秒）
const END_WAIT = 7; // ゴールしてから結果を出すまで（秒。カメラが前に回って、顔が見えてから）
const TAG_RANGE = 120; // 自分の車からこの距離（m）までの車に、名前の札を出す
const FINISH_TEXT = 2.5; // ゴールしてから「FINISH!」を出しておく秒数（そのあとは顔が見えるように消す）

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const hud = $('hud');
const rotate = $('rotate');
const speedLines = $('speed-lines');
const speedo = $('speedo');
const speedNum = speedo.querySelector('.num');
const wrongWayEl = $('wrongway');
const menu = $('menu');
const raceHud = $('race-hud');
const lapEl = $('lap');
const timeEl = $('race-time');
const rankEl = $('rank');
const countEl = $('countdown');
const leftEl = $('time-left');
const pauseBtn = $('btn-pause');
const lapBox = $('lap-box');
const sideEl = $('side');
const top3El = $('top3');
const probe = $('safe-probe');
const BUTTONS = ['left', 'right', 'brake', 'drift', 'item'];
const els = Object.fromEntries(BUTTONS.map((n) => [n, $(`btn-${n}`)]));
const dev = new Set(location.hash.slice(1).split('&'));

const track = buildTrack(COURSE1);
const renderer = createRenderer(canvas);
const { scene, camera } = createWorld(track);
const effects = createEffects(scene);
const minimap = createMinimap($('minimap'), track);
const controls = new Controls();
// タッチできる端末はボタン、パソコンはキーボード
controls.setMode(hasTouch() ? 'buttons' : 'keyboard');
let quality = 1;
let layout;
let game = null; // 走っているレース（タイトルなどの画面では null）

function safeArea() {
  const cs = getComputedStyle(probe);
  return {
    left: parseFloat(cs.paddingLeft) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
  };
}

function placeButtons() {
  const racing = game !== null;
  for (const n of BUTTONS) {
    const b = layout[n];
    const el = els[n];
    el.classList.toggle('hidden', controls.mode === 'keyboard' || !racing);
    Object.assign(el.style, { left: `${b.x - b.r}px`, top: `${b.y - b.r}px`, width: `${b.r * 2}px`, height: `${b.r * 2}px` });
  }
  // 順位は ◀ ▶ ▼ の上（左下）
  rankEl.style.left = `${layout.left.x - layout.left.r}px`;
  rankEl.style.bottom = `${window.innerHeight - (layout.brake.y - layout.brake.r) + 8}px`;
  placeSide();
}

// コースマップは、右上の周回とタイムの下。ITEM ボタンにかかるときは、ボタンの左に寄せる。
// 上位3人は、左上の速度計の下
function placeSide() {
  if (!game) return;
  const sp = speedo.getBoundingClientRect();
  top3El.style.left = `${sp.left}px`;
  top3El.style.top = `${sp.bottom + 2}px`;
  const w = window.innerWidth;
  const safe = safeArea();
  const top = Math.max(lapBox.getBoundingClientRect().bottom, pauseBtn.getBoundingClientRect().bottom) + 6;
  sideEl.style.top = `${top}px`;
  sideEl.style.width = `${Math.round(Math.min(190, Math.max(120, w * 0.19)))}px`;
  let right = 10 + safe.right;
  const item = layout.item;
  if (controls.mode !== 'keyboard' && top + sideEl.offsetHeight > item.y - item.r - 6) right = w - (item.x - item.r) + 8;
  sideEl.style.right = `${right}px`;
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  rotate.classList.toggle('show', h > w);
  resizeRenderer(renderer, camera, w, h, pixelRatio(window.devicePixelRatio, quality));
  layout = computeButtonLayout(w, h, safeArea(), controls.mode);
  controls.relayout(layout);
  placeButtons();
}

window.addEventListener('resize', resize);
resize();
attachControls(controls, $('touch-layer'), () => layout);

// ---- 遊べる時間 ----
function playStore() {
  return load('playtime', {});
}

function commitPlay() {
  if (!game || game.playSec <= 0) return;
  save('playtime', addPlay(playStore(), game.name, Date.now(), game.playSec));
  game.playSec = 0;
}

// ---- レース ----
function createGame(name, charId) {
  const me = PLAYER_CHARS.find((c) => c.id === charId);
  const count = CPU_COUNT + 1;
  const race = createRace(count);
  const base = kartParams({ accel: 3, top: 3, handling: 3 });
  const karts = [];
  const models = [];
  const cpus = [];
  let cpuNo = 0;
  for (let k = 0; k < count; k++) {
    const slot = gridSlot(track, k);
    karts.push(createKart(track, slot.i, slot.lateral));
    const isMe = k === PLAYER_SLOT;
    const look = isMe ? { body: me.body, character: me.id } : CPU_LOOKS[cpuNo];
    cpus.push(isMe ? createCpu(7) : createCpu(cpuNo));
    models.push(createKartModel(look));
    if (!isMe) cpuNo++;
  }
  models.forEach((m) => scene.add(m));
  const names = karts.map((_, k) => (k === PLAYER_SLOT ? name : CPU_LOOKS[k < PLAYER_SLOT ? k : k - 1].name));
  // 頭の上の名前の札（自分の車には付けない。画面の真ん中をふさがないように）
  const tags = models.map((m, k) => {
    if (k === PLAYER_SLOT) return null;
    const look = CPU_LOOKS[k < PLAYER_SLOT ? k : k - 1];
    const tag = createNameTag(names[k], `#${look.body.toString(16).padStart(6, '0')}`);
    m.add(tag);
    return tag;
  });
  return {
    name,
    race,
    base,
    karts,
    models,
    cpus,
    names,
    tags,
    // マップの点と、上位3人のアイコン（体の色と、キャラのしるし）
    faces: karts.map((_, k) => {
      const look = k === PLAYER_SLOT ? { body: me.body, character: me.id } : CPU_LOOKS[k < PLAYER_SLOT ? k : k - 1];
      const ch = PLAYER_CHARS.find((c) => c.id === look.character);
      return { color: `#${look.body.toString(16).padStart(6, '0')}`, icon: ch.icon, character: ch.id };
    }),
    top3Key: '',
    me: PLAYER_SLOT,
    prev: karts.map(poseOf),
    contacts: new Set(),
    playSec: 0,
    sinceSave: 0,
    driftWas: false,
    endAt: null,
    flyT: 0, // スタートの前のカメラが動いた秒数
    paused: false,
    onEnd: null,
  };
}

function removeGame() {
  if (!game) return;
  game.models.forEach((m) => scene.remove(m));
  for (const tag of game.tags) {
    if (!tag) continue;
    tag.material.map.dispose();
    tag.material.dispose();
  }
  game = null;
}

function stepGame(dt) {
  const g = game;
  const { race, karts, me } = g;
  karts.forEach((kart, k) => {
    g.prev[k] = poseOf(kart);
  });
  // スタートの前に、カメラが車たちの上を通って回る。その間はカウントを始めない（DRIFT もスタートダッシュに数えない）
  if (g.flyT < START_FLY_TIME) {
    g.flyT += dt;
    g.driftWas = controls.drift;
    return;
  }
  const went = raceTick(race, dt);
  // スタートダッシュは DRIFT ボタン（押した瞬間だけ）
  if (controls.drift && !g.driftWas) pressDash(race, me);
  g.driftWas = controls.drift;
  if (race.phase === 'countdown') return;
  if (went) countEl.classList.add('go');
  if (takeDash(race, me)) startDash(karts[me], g.base, 3);
  // CPU のうち何台かは、GO と同時にスタートダッシュ
  if (went) karts.forEach((kart, k) => k !== me && g.cpus[k].dash && startDash(kart, g.base, 3));
  const L = track.length;
  const myProgress = progress(race, me, track);
  karts.forEach((kart, k) => {
    const done = race.entries[k].finished;
    if (k === me && !done) {
      stepKart(kart, controls, track, g.base, dt);
    } else {
      // CPU（ゴールしたプレイヤーの車も CPU が運転する）
      const rubber = k === me ? 1 : rubberFactor(progress(race, k, track), myProgress, L);
      stepKart(kart, cpuControl(g.cpus[k], kart, track, race.t), track, cpuParams(g.base, rubber), dt);
    }
  });
  g.contacts = pushApart(karts, g.contacts);
  karts.forEach((kart, k) => updateProgress(race, k, track, kart.seg));
  if (!race.entries[me].finished) {
    g.playSec += dt;
    g.sinceSave += dt;
    if (g.sinceSave >= PLAY_SAVE_EVERY) {
      g.sinceSave = 0;
      commitPlay();
    }
  } else if (g.endAt === null) {
    g.endAt = race.t + END_WAIT;
  }
  // 最後にゴールしても、カメラが前に回って顔が見えるまで待つ
  if (g.endAt !== null && race.t >= g.endAt && g.onEnd) {
    const end = g.onEnd;
    g.onEnd = null;
    end('finish');
  }
}

// 結果の表。まだゴールしていない車は、のこりの距離から見こみのタイム（~ を付ける）
function resultRows(g) {
  const { race } = g;
  const avg = g.base.topSpeed * 0.8;
  return ranking(race, track).map((k, n) => {
    const e = race.entries[k];
    const est = e.finished ? e.time : race.t + (LAPS * track.length - progress(race, k, track)) / avg;
    return {
      place: ordinal(n + 1),
      name: g.names[k],
      time: (e.finished ? '' : '~') + timeText(est),
      points: racePoints(n + 1),
      face: g.faces[k],
      me: k === g.me,
    };
  });
}

async function runRace(name, charId) {
  // スタートの前に、コースを回って映しながら、コースの名前を出す（タイトルと同じカメラ）
  await screens.courseIntro(menu, COURSE1.name, COURSE_INTRO);
  game = createGame(name, charId);
  camera.userData = {}; // カメラの動きを最初から（前のレースの位置を引きずらない）
  raceHud.classList.add('show');
  speedo.classList.remove('hidden'); // 上位3人の場所を決めるのに、速度計の大きさが要る
  countEl.classList.remove('go');
  placeButtons();
  const why = await new Promise((resolve) => {
    game.onEnd = resolve;
  });
  commitPlay();
  raceHud.classList.remove('show');
  if (why === 'title') {
    removeGame();
    placeButtons();
    return 'title';
  }
  const rows = resultRows(game);
  removeGame();
  placeButtons();
  return screens.results(menu, rows, [
    { id: 'again', label: '↻ RACE AGAIN' },
    { id: 'title', label: '⌂ TITLE' },
  ]);
}

// 一時停止（SOLO だけ）: つづける / タイトルへ
pauseBtn.addEventListener('click', async () => {
  if (!game || game.paused) return;
  game.paused = true;
  const pick = await screens.message(menu, 'Paused', '', [
    { id: 'go', label: '▶ CONTINUE' },
    { id: 'title', label: '⌂ TITLE' },
  ]);
  if (!game) return;
  game.paused = false;
  if (pick === 'title' && game.onEnd) {
    const end = game.onEnd;
    game.onEnd = null;
    end('title');
  }
});

async function seeYouTomorrow(name) {
  await screens.message(menu, 'See you tomorrow!', `${name}, you played enough today.`, [{ id: 'ok', label: 'OK' }]);
}

async function flow() {
  for (;;) {
    await screens.title(menu);
    const recent = load('recent', []);
    const name = await screens.askName(menu, recent);
    save('recent', addRecent(recent, name));
    if (remainingSec(playStore(), name, Date.now()) <= 0) {
      await seeYouTomorrow(name);
      continue;
    }
    const charId = await screens.chooseCharacter(menu, PLAYER_CHARS, remainingText(remainingSec(playStore(), name, Date.now())));
    for (;;) {
      const pick = await runRace(name, charId);
      if (remainingSec(playStore(), name, Date.now()) <= 0) {
        await seeYouTomorrow(name);
        break;
      }
      if (pick !== 'again') break;
    }
  }
}

// ---- 描く ----
let frames = 0;
let fpsTime = 0;
let fps = 60;
let last = performance.now();
let orbit = 0;
const overHead = new THREE.Vector3();

// タイトルなどの画面のうしろでは、コースの上をゆっくり回って見せる
function orbitCamera(dt) {
  orbit += dt * 0.08;
  camera.fov = 60;
  camera.updateProjectionMatrix();
  camera.position.set(Math.sin(orbit) * 420, 160, Math.cos(orbit) * 420);
  camera.lookAt(0, 0, 0);
}

function renderGame(alpha, dt) {
  const g = game;
  const views = g.karts.map((kart, k) => {
    const cur = poseOf(kart);
    const prev = g.prev[k];
    const jumped = Math.hypot(cur.x - prev.x, cur.z - prev.z) > 10;
    return { ...kart, ...(jumped ? cur : blendPose(prev, cur, alpha)) };
  });
  views.forEach((v, k) => syncKartModel(g.models[k], v));
  // 遠すぎる車の名前は出さない（コースの反対側の札が、景色の上に浮かないように）
  g.tags.forEach((tag, k) => {
    if (tag) tag.visible = Math.hypot(views[k].x - views[g.me].x, views[k].z - views[g.me].z) < TAG_RANGE;
  });
  const mine = views[g.me];
  const kart = g.karts[g.me];
  effects.update(mine, dt);
  const { race } = g;
  const e = race.entries[g.me];
  const flying = g.flyT < START_FLY_TIME;
  if (dev.has('front')) updateFrontCamera(camera, mine);
  else if (flying) updateStartCamera(camera, mine, g.flyT);
  else if (e.finished) updateFinishCamera(camera, mine, race.t - e.time, dt);
  else updateChaseCamera(camera, mine, g.base.topSpeed, dt);
  speedLines.style.opacity = kart.boost > 0 ? 1 : 0;
  // 表示
  speedNum.textContent = speedText(kart.speed);
  speedo.classList.toggle('boost', kart.boost > 0);
  lapEl.textContent = `LAP ${Math.min(LAPS, e.lap + 1)}/${LAPS}`;
  timeEl.textContent = timeText(Math.max(0, e.finished ? e.time : race.t));
  const order = ranking(race, track);
  rankEl.textContent = ordinal(order.indexOf(g.me) + 1);
  countEl.textContent = flying ? '' : e.finished ? (race.t - e.time < FINISH_TEXT ? 'FINISH!' : '') : countdownText(race);
  minimap.draw(views.map((v, k) => ({ x: v.x, z: v.z, color: g.faces[k].color, me: k === g.me })));
  showTop3(g, order.slice(0, 3));
  const left = remainingSec(playStore(), g.name, Date.now()) - g.playSec;
  leftEl.textContent = remainingText(Math.max(0, left));
  return { mine, kart };
}

// 上位3人（順位が変わったときだけ書きかえる）
function showTop3(g, top) {
  const key = top.join(',');
  if (key === g.top3Key) return;
  g.top3Key = key;
  top3El.innerHTML = top
    .map((k, n) => `<li class="${k === g.me ? 'me' : ''}"><span class="place">${ordinal(n + 1)}</span><span class="face" style="background:${g.faces[k].color}">${faceSvg(g.faces[k].character)}</span>${g.names[k]}</li>`)
    .join('');
  placeSide(); // 行の数が変わると高さが変わる
}

startLoop({
  update(dt) {
    controls.tick();
    if (game && !game.paused) stepGame(dt);
  },
  render(alpha) {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    frames++;
    fpsTime += dt;
    if (fpsTime >= 2) {
      fps = Math.round(frames / fpsTime);
      frames = 0;
      fpsTime = 0;
      const q = nextQuality(quality, fps);
      if (q !== quality) {
        quality = q;
        resize();
      }
    }
    for (const n of BUTTONS) els[n].classList.toggle('active', controls.touch[n]);
    let wrong = false;
    let mine = null;
    if (game) {
      const r = renderGame(alpha, dt);
      mine = r.mine;
      wrong = r.kart.wrongWay;
    } else {
      orbitCamera(dt);
    }
    renderer.render(scene, camera);
    // 逆走の警告: キャラの頭の上の画面の位置に出す
    wrongWayEl.classList.toggle('show', wrong);
    if (wrong) {
      overHead.set(mine.x, mine.y + 3.6, mine.z).project(camera);
      wrongWayEl.style.left = `${((overHead.x + 1) / 2) * window.innerWidth}px`;
      wrongWayEl.style.top = `${((1 - overHead.y) / 2) * window.innerHeight}px`;
    }
    speedo.classList.toggle('hidden', !game);
    hud.textContent = `${fps}fps  ${controls.mode}  v:${VERSION}`;
  },
});

flow();
