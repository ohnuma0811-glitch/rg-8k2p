// 起動。タイトル → 名前 → キャラ選び → SOLO のレース（自分＋CPU 4台、3周）→ 結果
import * as THREE from '../vendor/three.module.min.js';
import { startLoop } from './loop.js';
import { COURSE1 } from './data/tracks.js';
import { buildTrack } from './game/track.js';
import { createKart, stepKart, startDash } from './game/kart.js';
import { kartParams } from './game/stats.js';
import { createCpu, cpuControl, cpuParams, rubberFactor } from './game/cpu.js';
import { pushApart, newBumps } from './game/collide.js';
import {
  LAPS, COURSE_INTRO, RESULTS_DELAY, gridSlot, createRace, raceTick, countdownText, pressDash, takeDash, updateProgress, progress, ranking, ordinal, timeText, racePoints,
} from './game/race.js';
import { Controls, attachControls, computeButtonLayout, hasTouch } from './input.js';
import { createRenderer, createWorld, resizeRenderer, updateChaseCamera, updateFrontCamera, updateFinishCamera, updateStartCamera, START_FLY_TIME } from './render/scene.js';
import { createMinimap } from './render/minimap.js';
import { grandstandSpot } from './render/trackMesh.js';
import { createKartModel, syncKartModel, createNameTag } from './render/models.js';
import { faceSvg } from './titleArt.js';
import { createEffects } from './render/effects.js';
import { nextQuality, pixelRatio } from './render/quality.js';
import { blendPose, poseOf } from './render/interp.js';
import { speedText } from './hud.js';
import { addRecent, cleanRecent } from './names.js';
import { remainingSec, addPlay, remainingText } from './playtime.js';
import { load, save } from './storage.js';
import * as screens from './screens.js';
import { createAudio } from './audio/audio.js';
import { createSfx } from './audio/sfx.js';
import { createVoices } from './audio/voice.js';
import { soundState, soundEvents, finishMusic, jumpAhead, afterPause } from './audio/events.js';
import { createCrowd } from './audio/crowd.js';
import { crowdMix } from './audio/mix.js';
import { createMusic, FINAL_LAP_RATE } from './audio/music.js';
import { CUP_RACES, createCup, addRace, standings, isOver } from './game/cup.js';

// 版番号（公開のときに scripts/deploy.sh がコミットの番号に置き換える。古い版が動いていないか確かめる用）
const VERSION = 'dev';
// プレイヤーが選べるキャラ（M3 で8人にする）
const PLAYER_CHARS = [
  // voice: ジャンプ台で飛ぶときの声（male: 男衆「イヤッホー！」、female: 女衆「おう！」）
  { id: 'kyugo', name: 'Kyugo', color: '#c11f0a', icon: '🔥', body: 0xc11f0a, voice: 'male' },
  { id: 'soki', name: 'Soki', color: '#1c3c88', icon: '⭐', body: 0x1c3c88, voice: 'male' },
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
const TOP3_HOLD = 0.25; // 上位3人の並びは、新しい並びがこの秒数続いたら変える
const TAG_RANGE = 120; // 自分の車からこの距離（m）までの車に、名前の札を出す
const FINISH_TEXT = 2.5; // ゴールしてから「FINISH!」を出しておく秒数（そのあとは顔が見えるように消す）

const $ = (id) => document.getElementById(id);
// 画面を暗くする・明るくする（to: 1 で真っ黒、0 で元どおり）。FADE_SEC 秒かけて変え、終わったら次へ
const FADE_SEC = 0.8;
function fade(to) {
  const el = $('fade');
  el.style.transition = `opacity ${FADE_SEC}s`;
  el.style.opacity = String(to);
  return new Promise((r) => setTimeout(r, FADE_SEC * 1000));
}
// 画面の文字は、変わったときだけ書きかえる（毎フレーム書くと、ブラウザが毎回並べ直して重い）
function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}
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
const standSpot = grandstandSpot(track); // 観客席の真ん中（歓声の大きさと左右）
const renderer = createRenderer(canvas);
const { scene, camera } = createWorld(track);
const effects = createEffects(scene);
const minimap = createMinimap($('minimap'), track);
const controls = new Controls();
const audio = createAudio();
const sfx = createSfx(audio);
const voices = createVoices(audio);
const crowd = createCrowd(audio);
const music = createMusic(audio);
// 最初のタップ・クリック・キーで音を有効にする（iPhone・Android は、さわるまで音を出せない）
// 有効になった最初の1回だけ、曲を作り始めて、タイトルの曲を流す
for (const type of ['pointerdown', 'touchend', 'keydown']) {
  window.addEventListener(
    type,
    () => {
      const first = !audio.ctx;
      audio.unlock();
      if (!first || !audio.ctx) return;
      // 曲を作るのに少し時間がかかるので、タイトルの曲から順に作っておく
      voices.load();
      music.prepare('title').then(() => music.prepare(COURSE1.music)).then(() => music.prepare('victory')).then(() => music.prepare('consolation')).then(() => music.prepare('results'));
      if (!game) music.play('title');
    },
    { passive: true },
  );
}
// 画面が見えなくなったら音を止める
document.addEventListener('visibilitychange', () => (document.hidden ? audio.pause() : audio.resume()));
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
  minimap.resize();
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
  game.leftBase = remainingSec(playStore(), game.name, Date.now());
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
    voice: me.voice, // ジャンプ台で飛ぶときの声
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
    bumps: 0, // 自分がぶつかった回数（効果音用）
    wallQuiet: Infinity, // 壁から離れている秒数（壁の音を最初だけ鳴らす）
    sound: null, // 前のフレームの音の様子
    me: PLAYER_SLOT,
    prev: karts.map(poseOf),
    contacts: new Set(),
    playSec: 0,
    // 残り時間（秒）。保存してある記録を読むのは、レースの最初と記録したときだけ（毎フレーム読むと重い）
    leftBase: remainingSec(playStore(), name, Date.now()),
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
  sfx.stopAll();
  crowd.stop();
  game.models.forEach((m) => {
    scene.remove(m);
    // 形（geometry）は車ごとに作っているので消す。材質（material）は使い回しているので消さない
    m.traverse((o) => {
      if (o.geometry && !o.isSprite) o.geometry.dispose();
    });
  });
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
  const before = g.contacts;
  g.contacts = pushApart(karts, before);
  g.bumps += newBumps(before, g.contacts, me);
  karts.forEach((kart, k) => updateProgress(race, k, track, kart.seg));
  if (!race.entries[me].finished) {
    g.playSec += dt;
    g.sinceSave += dt;
    if (g.sinceSave >= PLAY_SAVE_EVERY) {
      g.sinceSave = 0;
      commitPlay();
    }
  } else if (g.endAt === null) {
    g.endAt = race.t + RESULTS_DELAY;
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

// 大会の1レース。'next'（次へ）、'title'（タイトルへ）、'newcup'（新しい大会）を返す
async function runRace(name, charId, cup) {
  const label = `RACE ${cup.done + 1}/${CUP_RACES}`;
  // レースの画面に移ったら、曲（タイトル・結果）をだんだん小さくして止める。GO! でコースの曲が始まる
  music.stop(1.5);
  // スタートの前に、コースを回って映しながら、レースの番号とコースの名前を出す（タイトルと同じカメラ）
  await screens.courseIntro(menu, COURSE1.name, label, COURSE_INTRO);
  game = createGame(name, charId);
  buildTop3(game);
  sfx.engine.start();
  crowd.start();
  camera.userData = {}; // カメラの動きを最初から（前のレースの位置を引きずらない）
  raceHud.classList.add('show');
  speedo.classList.remove('hidden'); // 上位3人の場所を決めるのに、速度計の大きさが要る
  countEl.classList.remove('go');
  placeButtons();
  const why = await new Promise((resolve) => {
    game.onEnd = resolve;
  });
  commitPlay();
  if (why === 'title') {
    raceHud.classList.remove('show');
    removeGame();
    placeButtons();
    return 'title';
  }
  // ゴールのあと結果の画面へは、画面をだんだん暗く・曲をだんだん小さくしてから切りかえる（急に切りかわらないように）
  music.stop(FADE_SEC);
  await fade(1);
  raceHud.classList.remove('show');
  const g = game;
  const rows = resultRows(g);
  addRace(cup, ranking(g.race, track));
  removeGame();
  placeButtons();
  // そのレースの結果 → 大会の順位（合計ポイント）
  music.play('results');
  const shown = screens.results(menu, rows, label, [
    { id: 'next', label: 'NEXT ▶' },
    { id: 'title', label: '⌂ TITLE' },
  ]);
  fade(0); // 結果の画面を出してから、だんだん明るく
  const first = await shown;
  if (first === 'title') return 'title';
  const over = isOver(cup);
  const table = standings(cup).map((k, n) => ({
    place: ordinal(n + 1),
    name: g.names[k],
    total: cup.totals[k],
    gained: cup.gained[k],
    face: g.faces[k],
    me: k === g.me,
  }));
  // 遊べる時間が終わっていたら、次のレースには進めない（OK のあと「See you tomorrow!」）
  const timeUp = remainingSec(playStore(), name, Date.now()) <= 0;
  let buttons;
  if (timeUp) buttons = [{ id: 'title', label: 'OK' }];
  else if (over) buttons = [{ id: 'newcup', label: '↻ NEW CUP' }, { id: 'title', label: '⌂ TITLE' }];
  else buttons = [{ id: 'next', label: `▶ RACE ${cup.done + 1}/${CUP_RACES}` }, { id: 'title', label: '⌂ TITLE' }];
  return screens.standings(menu, table, label, over, buttons);
}

// 一時停止（SOLO だけ）: つづける / タイトルへ
pauseBtn.addEventListener('click', async () => {
  // ゴールして結果の画面へ移る途中（画面が暗くなっていく間）は、止めない（M5 のレビュー）
  if (!game || game.paused || !game.onEnd) return;
  game.paused = true;
  sfx.stopAll(); // 一時停止中は、エンジン音・ドリフトの音・歓声を止める
  crowd.stop();
  game.sound = afterPause(game.sound);
  // SOUND を押したら、一時停止のまま文字だけ変える
  let pick;
  for (;;) {
    pick = await screens.message(menu, 'Paused', '', [
      { id: 'go', label: '▶ CONTINUE' },
      { id: 'sound', label: audio.isOn() ? '🔊 SOUND: ON' : '🔇 SOUND: OFF' },
      { id: 'title', label: '⌂ TITLE' },
    ]);
    if (pick !== 'sound') break;
    audio.setOn(!audio.isOn());
  }
  if (!game) return;
  game.paused = false;
  sfx.engine.start();
  crowd.start();
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
    music.play('title'); // タイトル・名前・キャラ選びの間ずっと（同じ曲が流れていれば何もしない）
    // タイトル → 名前 → キャラ選び。BACK で1つ前の画面へ戻る
    let screen = 'title';
    let name = null;
    let charId = null;
    while (!charId) {
      if (screen === 'title') {
        await screens.title(menu, audio);
        screen = 'name';
      } else if (screen === 'name') {
        const recent = cleanRecent(load('recent', []));
        name = await screens.askName(menu, recent);
        if (name === screens.BACK) {
          screen = screens.prevScreen('name');
          continue;
        }
        save('recent', addRecent(recent, name));
        if (remainingSec(playStore(), name, Date.now()) <= 0) {
          await seeYouTomorrow(name);
          screen = 'title';
          continue;
        }
        screen = 'character';
      } else {
        const pick = await screens.chooseCharacter(menu, PLAYER_CHARS, remainingText(remainingSec(playStore(), name, Date.now())));
        if (pick === screens.BACK) screen = screens.prevScreen('character');
        else charId = pick;
      }
    }
    // 大会（5レースの合計ポイントで優勝を決める）
    let cup = createCup(CPU_COUNT + 1);
    for (;;) {
      const pick = await runRace(name, charId, cup);
      if (remainingSec(playStore(), name, Date.now()) <= 0) {
        await seeYouTomorrow(name);
        break;
      }
      if (pick === 'title') break;
      if (pick === 'newcup') cup = createCup(CPU_COUNT + 1);
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
  setText(speedNum, speedText(kart.speed));
  speedo.classList.toggle('boost', kart.boost > 0);
  setText(lapEl, `LAP ${Math.min(LAPS, e.lap + 1)}/${LAPS}`);
  setText(timeEl, timeText(Math.max(0, e.finished ? e.time : race.t)));
  const order = ranking(race, track);
  setText(rankEl, ordinal(order.indexOf(g.me) + 1));
  setText(countEl, flying ? '' : e.finished ? (race.t - e.time < FINISH_TEXT ? 'FINISH!' : '') : countdownText(race));
  minimap.draw(views.map((v, k) => ({ x: v.x, z: v.z, color: g.faces[k].color, me: k === g.me })));
  showTop3(g, order.slice(0, 3), dt);
  setText(leftEl, remainingText(Math.max(0, g.leftBase - g.playSec)));
  // 音: 前のフレームとくらべて鳴らす。エンジン音は毎フレーム高さを近づける
  const now = soundState({ count: countEl.textContent, lap: e.lap, finished: e.finished, kart, bumps: g.bumps, wallQuiet: g.wallQuiet, jumpSoon: jumpAhead(track, kart) });
  g.wallQuiet = kart.onWall ? 0 : g.wallQuiet + dt; // 壁から離れている秒数
  for (const name of soundEvents(g.sound, now, LAPS)) {
    if (name === 'driftStart') sfx.drift(true, kart.speed / g.base.topSpeed);
    else if (name === 'driftEnd') sfx.drift(false);
    else if (name === 'jump') voices.play(g.voice); // 自分の車だけ、キャラの声で叫ぶ
    else if (name !== 'finish') sfx.play(name);
    if (name === 'finalLap' || name === 'finish') crowd.excite(3);
    if (name === 'go') music.play(COURSE1.music);
    if (name === 'finalLap') music.setRate(FINAL_LAP_RATE);
    if (name === 'finish') {
      // 順位で音を変える: 1〜3位は明るいファンファーレと勝利の曲、4位以下はちょっと悲しいファンファーレと別の曲
      const fm = finishMusic(order.indexOf(g.me) + 1);
      sfx.play(fm.sfx);
      music.play(fm.song, { delay: 1.5 }); // コースの曲を止め、ファンファーレのあとに流す
    }
  }
  g.sound = now;
  sfx.engine.update(kart.speed, g.base.topSpeed, kart.boost > 0);
  crowd.update(crowdMix(mine, standSpot));
  return { mine, kart };
}

// 上位3人（順位が変わったときだけ書きかえる）
// 顔と名前は、レースの最初に車ごとに1回だけ作る。並びが変わったら、作ってあるものを入れかえるだけ
// （並びは横に並んだ車どうしで1秒に2回ほど入れかわる。そのたびに顔の絵を作り直すと重く、レースがカクついた）
function buildTop3(g) {
  g.top3Items = g.names.map((name, k) => {
    const item = document.createElement('span');
    item.className = 'who';
    item.innerHTML = `<span class="face" style="background:${g.faces[k].color}">${faceSvg(g.faces[k].character)}</span>${name}`;
    return item;
  });
  top3El.innerHTML = [1, 2, 3].map((n) => `<li><span class="place">${ordinal(n)}</span></li>`).join('');
  g.top3Rows = [...top3El.children];
}

function showTop3(g, top, dt) {
  const key = top.join(',');
  if (key === g.top3Key) {
    g.top3Wait = 0;
    return;
  }
  // 横に並んだ車どうしで並びが行ったり来たりするので、新しい並びが少し続いたときだけ変える
  // （最初の1回はすぐに出す）
  if (g.top3Key !== '' && key === g.top3Next) g.top3Wait += dt;
  else g.top3Wait = 0;
  g.top3Next = key;
  if (g.top3Key !== '' && g.top3Wait < TOP3_HOLD) return;
  g.top3Key = key;
  g.top3Wait = 0;
  top.forEach((k, n) => {
    const row = g.top3Rows[n];
    if (row.lastChild !== g.top3Items[k]) row.replaceChildren(row.firstChild, g.top3Items[k]);
    row.classList.toggle('me', k === g.me);
  });
  // 置き場所は、最初に3人がそろったときだけ決める（行の高さは変わらない）
  if (!g.top3Placed) {
    g.top3Placed = true;
    placeSide();
  }
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
    // 一時停止中は、車・タイヤ・カメラを動かさず、止めたときの画面のまま描く（2026-10-15 の実機確認）
    if (game && game.paused) {
      // 何もしない
    } else if (game) {
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
    setText(hud, `${fps}fps  ${controls.mode}  v:${VERSION}`);
  },
});

// ホーム画面に追加したときに使う（https のときだけ。手元の http://localhost では使わない）
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

flow();
