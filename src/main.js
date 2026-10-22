// 起動。タイトル → 名前 → キャラ選び → SOLO のレース（自分＋CPU 4台、3周）→ 結果
import * as THREE from '../vendor/three.module.min.js';
import { startLoop } from './loop.js';
import { COURSES } from './data/tracks.js';
import { buildTrack, span, locate, stageAt, bannerStageAt } from './game/track.js';
import { createKart, stepKart, startDash, PHYS } from './game/kart.js';
import { cowContact, cowPose, bumpWarning, busPose, busContact, busNear, boarPose, boarContact, boarWarning, createNuts, stepNuts, nutContact, dropFallen, NUT_FALL, MONKEY_HEIGHT, dinoPose, dinoPlace, dinoContact, mudContact, pierContact, slowContact, snowmanPose, snowmanContact, mogulContact, treeContact, oneWayContact, DINO_BLACK } from './game/hazards.js';
import { kartParams } from './game/stats.js';
import { createCpu, cpuControl, cpuParams, rubberFactor, cpuItem } from './game/cpu.js';
import { pushApart, newBumps } from './game/collide.js';
import {
  LAPS, raceLaps, raceDistance, COURSE_INTRO, RESULTS_DELAY, gridSlot, createRace, raceTick, countdownText, pressDash, takeDash, updateProgress, progress, ranking, ordinal, timeText, racePoints,
} from './game/race.js';
import { Controls, attachControls, computeButtonLayout, hasTouch } from './input.js';
import { tunnelLight, tunnelLook, touchOnly } from './render/snow/tunnel.js';
import { applyStageVisibility, attachStage } from './render/world/stages.js';
import { skyFor } from './render/world/sky.js';
import { updateSpace, spaceLook } from './render/world/space.js';
import { updateSea } from './render/world/sea.js';
import { updateWarp, warpLook, suckPose } from './render/world/warp.js';
import { showcaseCamera } from './render/showcase.js';
import { createRenderer, createWorld, setCourse, setDarkness, setSky, resetSky, resizeRenderer, updateChaseCamera, updateFrontCamera, updateFinishCamera, updateStartCamera, START_FLY_TIME } from './render/scene.js';
import { createMinimap } from './render/minimap.js';
import { releaseTrack, tracksToRelease } from './render/release.js';
import { grandstandSpot } from './render/trackMesh.js';
import { createKartModel, syncKartModel, createNameTag, createCowModel, createCowLegs, setCowLegs, createTurtleModel, createBusModel, createBoarModel, createMonkeyModel, createNutModel, createNutShadow, createDinoModel, createSnowmanModel, createShinkansenModel, createTramModel, createTaxiModel, mergeStatic } from './render/models.js';
import { shinkansenCars, autoViewOf, viewStage, stageWindow, autoProgress, padRush, nightStage, groundShown, rushFovStep } from './game/world.js';
import { GLOBAL_SCENERY } from './data/global.js';
import { faceSvg } from './titleArt.js';
import { createEffects } from './render/effects.js';
import { nextQuality, pixelRatio } from './render/quality.js';
import { blendPose, poseOf } from './render/interp.js';
import { speedText, slotItem, ITEM_ICONS } from './hud.js';
import { initItems, createItemWorld, itemFrame, starGuard, starRestore } from './game/items.js';
import { createItemView } from './render/items.js';
import { addRecent, cleanRecent } from './names.js';
import { remainingSec, addPlay, remainingText } from './playtime.js';
import { load, save } from './storage.js';
import * as screens from './screens.js';
import { SharedTimes, dateText } from './sharedTimes.js';
import { TIMES_URL } from './config.js';
import { createAudio } from './audio/audio.js';
import { createSfx } from './audio/sfx.js';
import { createVoices } from './audio/voice.js';
import { soundState, soundEvents, finishMusic, jumpAhead, afterPause } from './audio/events.js';
import { createCrowd } from './audio/crowd.js';
import { crowdMix } from './audio/mix.js';
import { createMusic, FINAL_LAP_RATE, raceSongs } from './audio/music.js';
import { createCup, addRace, standings, isOver, courseOf, gridOrder } from './game/cup.js';

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
const spaceFlash = $('space-flash');
let flashLevel = 0; // 宇宙・ワープの終わりの白い光（着いたあと、だんだん消す）
let rushK = 0; // 京都へ向かう加速板の広い角度の度合い（0〜1）
const speedo = $('speedo');
const speedNum = speedo.querySelector('.num');
const wrongWayEl = $('wrongway');
const bumpWarnEl = $('bump-warn');
const menu = $('menu');
const raceHud = $('race-hud');
const lapEl = $('lap');
const timeEl = $('race-time');
const rankEl = $('rank');
const countEl = $('countdown');
const itemIconEl = document.querySelector('#item-slot .icon');
const zapGlow = $('zap-glow');
const itemFlash = $('item-flash');
const leftEl = $('time-left');
const pauseBtn = $('btn-pause');
const lapBox = $('lap-box');
const sideEl = $('side');
const top3El = $('top3');
const probe = $('safe-probe');
const BUTTONS = ['left', 'right', 'brake', 'drift', 'item'];
const els = Object.fromEntries(BUTTONS.map((n) => [n, $(`btn-${n}`)]));
const dev = new Set(location.hash.slice(1).split('&'));

// コースの形は一度作ったら使い回す（レースのたびに作り直すと重い）
const builtTracks = new Map();
function trackOf(def) {
  if (!builtTracks.has(def)) builtTracks.set(def, buildTrack(def));
  return builtTracks.get(def);
}
const renderer = createRenderer(canvas);
const { scene, camera } = createWorld();
const effects = createEffects(scene);
let course = COURSES[0];
let track = trackOf(course);
let standSpot = null; // 観客席の真ん中（歓声の大きさと左右）。観客席のないコースでは null
let minimap = null;
// 走るコースを決める（形・マップ・歓声）
// lite: コース選びの背景だけ（Global City は軽い形。全部はレースのときに作る）
function useCourse(def, { lite = false } = {}) {
  course = def;
  track = trackOf(def);
  // 新しく形を作るときは、ほかのコースの形を手放す（タイトルのコースと、このコースだけ残す。タブレットのメモリが足りなくなった。2026-10-22）
  if (!track.mesh && !(lite && track.showcaseMesh)) for (const t of tracksToRelease(builtTracks, [def, COURSES[0]])) releaseTrack(t);
  setCourse(scene, track, { lite });
  minimap = createMinimap($('minimap'), track);
  minimap.resize();
  standSpot = def.theme === 'circuit' || def.grandstand ? grandstandSpot(track) : null; // Kyugo Mountain も観客席の前で歓声（2026-10-18 のユーザー依頼）
}
useCourse(COURSES[0]);
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
      voices.load();
      crowd.load(); // スタジアムの歓声のファイル
      // 曲を作るのに少し時間がかかる。はじめはタイトルの曲だけ作る（全部の曲を続けて作ると、タブレットでメニューが重くなった。2026-10-22）
      // コースの曲とゴール・結果の曲は、レースの前に作る（prepareRaceSongs）
      music.prepare('title');
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
const TOUCH_DEVICE = touchOnly(window.matchMedia?.bind(window), navigator.userAgent, navigator.maxTouchPoints || 0); // 指で操作する端末（タブレット・スマホ）
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
  resizeRenderer(renderer, camera, w, h, pixelRatio(window.devicePixelRatio, quality, TOUCH_DEVICE ? 0.75 : 1)); // タブレット・スマホは重いときに少し粗く
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
// solo: TIME TRIAL（CPU なし。自分の車だけ）
function createGame(name, charId, level = 2, cup = null, { solo = false } = {}) {
  const me = PLAYER_CHARS.find((c) => c.id === charId);
  const count = solo ? 1 : CPU_COUNT + 1;
  const mySlot = solo ? 0 : PLAYER_SLOT;
  const race = createRace(count);
  const base = kartParams({ accel: 3, top: 3, handling: 3 });
  const karts = [];
  const models = [];
  const cpus = [];
  const seed = Math.floor(Math.random() * 100000); // レースごとの数（CPU がバンプで減速を忘れる所が、レースごとに変わる）
  let cpuNo = 0;
  // スタートの並び: 2レース目からは、前のレースで勝った車ほど後ろ（2026-10-17 のユーザー依頼）
  const order = cup ? gridOrder(cup) : [...Array(count).keys()];
  for (let k = 0; k < count; k++) {
    const slot = gridSlot(track, order.indexOf(k));
    karts.push(createKart(track, slot.i, slot.lateral));
    const isMe = k === mySlot;
    const look = isMe ? { body: me.body, character: me.id } : CPU_LOOKS[cpuNo];
    cpus.push(isMe ? createCpu(7, seed) : createCpu(cpuNo, seed));
    models.push(mergeStatic(createKartModel(look))); // 動かない部品は1つの形に（タブレットで描く回数を減らす）
    if (!isMe) cpuNo++;
  }
  karts.forEach(initItems);
  models.forEach((m) => scene.add(m));
  // 浮いているときの、車の下の地面の影（2026-10-17 のユーザー依頼「丘からジャンプしているとき」）
  const shadows = models.map(() => {
    const sh = createNutShadow();
    sh.scale.setScalar(1.3);
    sh.visible = false;
    scene.add(sh);
    return sh;
  });
  const names = karts.map((_, k) => (k === mySlot ? name : CPU_LOOKS[k < mySlot ? k : k - 1].name));
  // 頭の上の名前の札（自分の車には付けない。画面の真ん中をふさがないように）
  const tags = models.map((m, k) => {
    if (k === mySlot) return null;
    const look = CPU_LOOKS[k < mySlot ? k : k - 1];
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
    level, // CPU の速さ（1〜3）
    models,
    shadows,
    cpus,
    names,
    tags,
    blastsHeard: 0, // 聞こえた爆発の数（自分か、近くの車が吹き飛んだ）
    items: solo ? null : createItemWorld(track), // アイテム（TIME TRIAL にはない）
    itemView: solo ? null : createItemView(scene),
    slotShown: undefined, // 枠に出している絵（変わったときだけ書きかえる）
    // マップの点と、上位3人のアイコン（体の色と、キャラのしるし）
    faces: karts.map((_, k) => {
      const look = k === mySlot ? { body: me.body, character: me.id } : CPU_LOOKS[k < mySlot ? k : k - 1];
      const ch = PLAYER_CHARS.find((c) => c.id === look.character);
      return { color: `#${look.body.toString(16).padStart(6, '0')}`, icon: ch.icon, character: ch.id };
    }),
    top3Key: '',
    bumps: 0, // 自分がぶつかった回数（効果音用）
    nuts: createNuts(track), // サルが投げた木の実（Soki Forest）
    monkeyThrows: 0, // 自分の車の近くのサルが投げた数（効果音用）
    snowmanHops: 0, // 自分の車の近くの雪だるまが跳ねて着いた数（効果音用。Kyugo Mountain）
    tunnel: { dark: 0, black: 0 }, // トンネルの暗さ（Kyugo Mountain）
    wallQuiet: Infinity, // 壁から離れている秒数（壁の音を最初だけ鳴らす）
    sound: null, // 前のフレームの音の様子
    me: mySlot,
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

// 牛の形（コースの形と一緒に取っておく。コースが変わると一緒に入れかわる）を、時刻 time の場所に置く
function placeCows(time) {
  if (!track.cows.length) return;
  if (!track.cowModels) {
    // 牛は体と頭を1つの形に、足は全部の牛の分を1つに（描く回数を減らす。2026-10-22 のユーザー依頼「UTAR のあたりが重い」）
    track.cowModels = track.cows.map((cow, k) => mergeStatic(cow.kind === 'turtle' ? createTurtleModel(k) : createCowModel(k, { legs: false })));
    track.cowModels.forEach((m, k) => { track.mesh.add(m); attachStage(track.mesh, track, m, track.cows[k].s); }); // 海の亀は海のステージの近くだけ
    const cows = track.cows.map((cow, k) => k).filter((k) => track.cows[k].kind !== 'turtle');
    if (cows.length) {
      track.cowLegs = createCowLegs(cows);
      track.cowLegs.userData.cows = cows;
      track.mesh.add(track.cowLegs);
    }
  }
  track.cows.forEach((cow, k) => {
    const p = cowPose(track, cow, time);
    const m = track.cowModels[k];
    m.position.set(p.x, cow.kind === 'turtle' ? p.y : 0, p.z); // 亀は海の底の道の高さ
    m.rotation.y = -p.heading;
    m.userData.walk(time);
  });
  if (track.cowLegs) track.cowLegs.userData.cows.forEach((k, n) => setCowLegs(track.cowLegs, n, track.cowModels[k], time));
}

// イノシシの形（Soki Forest。牛と同じく、コースの形と一緒に取っておく）を、時刻 time の場所に置く。高さは道の高さ
function placeBoars(time) {
  if (!track.boars.length) return;
  if (!track.boarModels) {
    track.boarModels = track.boars.map((b, k) => mergeStatic(createBoarModel(k, b.size)));
    track.boarModels.forEach((m) => track.mesh.add(m));
  }
  track.boars.forEach((boar, k) => {
    const p = boarPose(track, boar, time);
    const m = track.boarModels[k];
    m.position.set(p.x, track.samples[Math.round(boar.s) % track.length].y ?? 0, p.z);
    m.rotation.y = -p.heading;
    m.userData.walk(time, p.state);
  });
}

// 雪だるま（Kyugo Mountain）: 跳ねながら左右に。顔は来る車の方へ。近くで着地したら「ぴょん」（g.snowmanHops を数える）
function placeSnowmen(g, time) {
  if (!track.snowmen.length) return;
  if (!track.snowmanModels) {
    track.snowmanModels = track.snowmen.map(() => mergeStatic(createSnowmanModel()));
    track.snowmanModels.forEach((m) => track.mesh.add(m));
  }
  const me = g.karts[g.me];
  track.snowmen.forEach((sm, k) => {
    const p = snowmanPose(track, sm, time);
    const m = track.snowmanModels[k];
    const was = m.userData.hop ?? 0;
    m.userData.hop = p.hop;
    m.position.set(p.x, p.y + p.hop, p.z);
    m.rotation.y = -(p.heading + Math.PI);
    if (p.hop < 0.05 && was >= 0.05 && Math.hypot(p.x - me.x, p.z - me.z) < 25) g.snowmanHops++;
  });
}

// 恐竜の顔（Soki Forest）: ジャンプ②の川の中から、時刻で上がってくる
function placeDino(time) {
  if (!track.dino) return;
  if (!track.dinoModel) {
    track.dinoModel = mergeStatic(createDinoModel());
    track.mesh.add(track.dinoModel);
  }
  const pose = dinoPose(track, time);
  const c = dinoPlace(track, time); // 川の真ん中（ジャンプ②の地面のない所。食べられる判定と同じ場所）
  const m = track.dinoModel;
  m.visible = pose.rise > 0;
  m.position.set(c.x, c.y, c.z); // いちばん上で、上あごがジャンプの通り道（高さ 5〜10m）にかかる
  m.rotation.y = -(c.h + Math.PI); // 前（+x）を、走ってくる車の方へ
  // 誰かを食べたら、口を「パクッ」と閉じて、もぐるまで閉じたまま
  const since = time - (track.dinoChomp ?? -Infinity);
  const shut = since >= 0 && since < 4 ? Math.min(1, since / 0.15) : 0;
  m.userData.upper.rotation.z = 0.8 * (1 - shut) + 0.05 * shut;
}

// 自分の車が恐竜のまわり（ジャンプ②の DINO_HEAR m 手前から、少し先まで。本線の上）にいるか
// （2026-10-16 のユーザー依頼「スタート直後に叫び声がする。恐竜周辺にいる時だけ」。前は、まっすぐの距離で見ていてスタートでも鳴った）
const DINO_HEAR = 160;
function nearDino(kart) {
  if (!track.dino) return false;
  const p = track.samples[kart.seg];
  if (!p || p.path !== 0) return false;
  return span(track, p.s, track.dino.s) < DINO_HEAR || span(track, track.dino.s, p.s) < 30;
}
// 恐竜の声の大きさ: 近いほど大きく、DINO_HEAR m 手前で 0.3（2026-10-16 のユーザー依頼「遠くにいるときは少し小さく」）
function dinoVolume(kart) {
  const p = track.samples[kart.seg];
  if (!track.dino || !p) return 1;
  const d = Math.min(span(track, p.s, track.dino.s), span(track, track.dino.s, p.s));
  return Math.max(0.3, Math.min(1, 1 - (0.7 * (d - 20)) / (DINO_HEAR - 20)));
}
// 恐竜が川から上がってきていて、自分の車が恐竜のまわりにいる（咆哮を鳴らす）
function dinoNear(kart, time) {
  return !!track.dino && dinoPose(track, time).state === 'rise' && nearDino(kart);
}

// 恐竜に食べられている間、画面をまっくらに（自分の車だけ）
// 食べられたとき: いきなりまっくらにせず、画面の上と下から恐竜のあご（緑に白い歯）が「ガブッ」と閉じて、
// 「GULP!」の文字が出てから暗くなる（2026-10-16 のユーザー依頼「食べられたことがわかるエフェクト」。血のりはやめた）
const dinoBlack = document.createElement('div');
dinoBlack.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:50;overflow:hidden;display:none';
const dinoDark = document.createElement('div');
dinoDark.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0';
const jawDiv = (top) => {
  const el = document.createElement('div');
  // ぎざぎざの歯（白）と、あご（緑）。上あごは下のふちに、下あごは上のふちに歯
  const teeth = [];
  for (let k = 0; k <= 12; k++) teeth.push(`${(k / 12) * 100}% ${top ? (k % 2 ? 100 : 82) : k % 2 ? 0 : 18}%`);
  el.style.cssText = `position:absolute;left:0;right:0;height:56%;${top ? 'top:0' : 'bottom:0'};background:#fff;clip-path:polygon(${top ? `0 0,100% 0,${teeth.reverse().join(',')}` : `${teeth.join(',')},100% 100%,0 100%`})`;
  const skin = document.createElement('div');
  skin.style.cssText = `position:absolute;left:0;right:0;${top ? 'top:0' : 'bottom:0'};height:80%;background:#f08a24;border-${top ? 'bottom' : 'top'}:6px solid #c4601a`;
  el.appendChild(skin);
  return el;
};
const jawTop = jawDiv(true);
const jawBottom = jawDiv(false);
const gulp = document.createElement('div');
gulp.textContent = 'GULP!';
gulp.style.cssText = 'position:absolute;left:0;right:0;top:50%;text-align:center;font:900 min(18vw,140px)/1 sans-serif;color:#ffd84a;text-shadow:4px 0 #6b2a00,-4px 0 #6b2a00,0 4px #6b2a00,0 -4px #6b2a00,3px 3px #6b2a00,-3px 3px #6b2a00,3px -3px #6b2a00,-3px -3px #6b2a00;transform:translateY(-50%)';
dinoBlack.append(dinoDark, jawTop, jawBottom, gulp);
document.body.appendChild(dinoBlack);
const DINO_CHOMP = 0.45; // あごが閉じるまで（秒）
const DINO_AFTER = 1.0; // 走り直してからも暗いままの秒数
const DINO_FADE_IN = 0.5; // そのあと明るくなる秒数
// 食べられてからの秒数 e（まだなら null）で、あご・文字・暗さを決める
function showChomp(e) {
  dinoBlack.style.display = e === null ? 'none' : 'block';
  if (e === null) return;
  const close = Math.min(1, e / DINO_CHOMP);
  const ease = 1 - (1 - close) ** 3;
  jawTop.style.transform = `translateY(${(-100 * (1 - ease)).toFixed(1)}%)`;
  jawBottom.style.transform = `translateY(${(100 * (1 - ease)).toFixed(1)}%)`;
  // 閉じたあと、だんだん暗く。走り直したあとも DINO_AFTER 秒は暗いまま（カメラが戻るのが見えないように。2026-10-16 のユーザー依頼）、そのあとだんだん明るく
  const back = e - DINO_BLACK; // 走り直してからの秒数（マイナスはまだ）
  dinoDark.style.opacity = String(Math.max(0, Math.min(1, (e - DINO_CHOMP - 0.4) / 0.5, 1 - (back - DINO_AFTER) / 0.5)));
  jawTop.style.opacity = jawBottom.style.opacity = String(Math.max(0, Math.min(1, 1 - (e - DINO_CHOMP - 0.6) / 0.4)));
  const pop = e < DINO_CHOMP ? 0 : Math.min(1, (e - DINO_CHOMP) / 0.15);
  gulp.style.opacity = String(Math.max(0, Math.min(pop, 1 - (e - 1.6) / 0.4)));
  gulp.style.transform = `translateY(-50%) scale(${(0.4 + 0.8 * pop).toFixed(2)})`;
}
// サルと木の実と影（Soki Forest）。サルは木の上に置いたまま、木の実は投げた所から落ちる所へ放物線で
function placeMonkeys(time, nuts) {
  if (!track.monkeys.length) return;
  if (!track.monkeyModels) {
    track.monkeyModels = track.monkeys.map((m) => {
      const model = mergeStatic(createMonkeyModel());
      model.position.set(m.x, m.y + MONKEY_HEIGHT, m.z);
      // 道の方を向く
      const q = track.samples[m.i];
      model.rotation.y = Math.atan2(-(q.z - m.z), q.x - m.x);
      track.mesh.add(model);
      return model;
    });
    track.nutModels = [];
  }
  track.monkeyModels.forEach((model, k) => {
    const last = nuts.list.filter((n) => n.monkey === k).reduce((a, n) => Math.max(a, n.t0), -Infinity);
    model.userData.throwAt(time, time - last);
  });
  while (track.nutModels.length < nuts.list.length) {
    const nut = createNutModel();
    const shadow = createNutShadow();
    track.mesh.add(nut, shadow);
    track.nutModels.push({ nut, shadow });
  }
  track.nutModels.forEach(({ nut, shadow }, k) => {
    const n = nuts.list[k];
    nut.visible = shadow.visible = !!n;
    if (!n) return;
    const u = Math.min(1, Math.max(0, (time - n.t0) / NUT_FALL));
    nut.position.set(n.from.x + (n.x - n.from.x) * u, n.from.y + (n.y + 0.4 - n.from.y) * u + 6 * u * (1 - u), n.from.z + (n.z - n.from.z) * u);
    shadow.position.set(n.x, n.y + 0.06, n.z);
    shadow.scale.setScalar(0.4 + 0.6 * u);
    shadow.material.opacity = 0.15 + 0.4 * u;
  });
}

// スクールバスの形（牛と同じく、コースの形と一緒に取っておく）を、時刻 time の場所に置く（2026-10-16 のユーザー依頼）
function placeBuses(time) {
  if (!track.buses.length) return;
  if (!track.busModels) {
    track.busModels = track.buses.map((bus) => (bus.kind === 'tram' ? createTramModel() : bus.kind === 'taxi' ? createTaxiModel() : mergeStatic(createBusModel())));
    track.busModels.forEach((m, k) => { track.mesh.add(m); attachStage(track.mesh, track, m, track.buses[k].from ?? track.buses[k].s0); }); // NY のタクシーは NY の近くだけ
  }
  track.buses.forEach((bus, k) => {
    const p = busPose(track, bus, time);
    const m = track.busModels[k];
    m.position.set(p.x, p.y ?? 0, p.z); // 道の高さ
    m.rotation.set(0, -p.heading, p.pitch, 'YZX'); // 坂にそって傾ける
  });
}

// 新幹線（Global City。2026-10-20）: 東京は道の北がわの線路（見るだけ）。速さは万能タイプの最高速の SHINKANSEN_FACTOR 倍
function trainsOf(t) {
  if (t.def.theme !== 'world') return [];
  const ref = (r) => (typeof r === 'string' ? t.marks[r] : null);
  // 自分が線路の始まりの near m 手前に来たら走り出す（t0）。lead: 走り出すときの先頭の位置（東京は全部の両が線路の上、富士山は始まりの手前から出てくる）
  return [GLOBAL_SCENERY.tokyo.shinkansenLine, GLOBAL_SCENERY.fuji?.shinkansen].filter(Boolean).map((tr) => ({ from: ref(tr.from), to: ref(tr.to), off: tr.off, y: tr.y, t0: null, lead: tr.lead ?? -100, near: tr.near ?? 300, wait: !!tr.wait, portal: !!tr.portal, speed: tr.speed, cars: tr.cars ?? 16 }));
}
function placeTrains(time, topSpeed) {
  if (!track.trains) track.trains = trainsOf(track);
  if (!track.trains.length) return;
  if (!track.trainModels) {
    track.trainModels = track.trains.map((tr) => createShinkansenModel(tr.cars));
    track.trainModels.forEach((m) => track.mesh.add(m));
  }
  // 1両ずつ線路にそって置く（カーブで真っすぐのまま突き出ていた。2026-10-21 のユーザー依頼）
  const mine = progress(game.race, game.me, track);
  track.trains.forEach((tr, k) => {
    if (tr.t0 === null && mine > tr.from - tr.near) tr.t0 = time; // 自分が線路の始まりに近づいたら走り出す
    const cars = track.trainModels[k].userData.cars;
    shinkansenCars(track, tr, Math.max(0, time), topSpeed, cars.length).forEach((p, j) => {
      cars[j].visible = p.visible;
      cars[j].position.set(p.x, p.y + 1.6, p.z);
      cars[j].rotation.y = -p.heading;
    });
  });
}

// トンネルの暗さを画面に（dark 0 で、もとの明るさ）
// タブレット・スマホ（指で操作する端末）は明るめ（2026-10-19）
const TUNNEL_LOOK = tunnelLook(TOUCH_DEVICE);
function showTunnel({ dark, black }, kart = null, open = 0) {
  setDarkness(scene, dark, TUNNEL_LOOK, kart, open, track);
  const v = $('vignette');
  v.style.opacity = String(Math.max(black, TUNNEL_LOOK.vignette * dark)); // まわりの暗さ
  v.classList.toggle('black', black > 0);
}

function removeGame() {
  if (!game) return;
  stageBanner.classList.remove('show');
  resetSky(scene); // Global City の空を、ふつうの空に戻す
  if (track) track.trains = null; // 新幹線は、次のレースでまた自分が近づいてから走り出す
  if (scene.userData.ground) scene.userData.ground.visible = true;
  flashLevel = 0;
  spaceFlash.style.opacity = '0';
  if (track?.mesh) for (const c of track.mesh.children) c.visible = true; // 宇宙・ワープの途中でやめても、コースを見せる
  showTunnel({ dark: 0, black: 0 }); // トンネルの中でやめても、明るさを戻す
  game.itemView?.dispose();
  itemIconEl.innerHTML = '';
  zapGlow.style.opacity = '0';
  itemFlash.style.opacity = '0';
  sfx.stopAll();
  crowd.stop();
  game.shadows.forEach((sh) => scene.remove(sh));
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
  // CPU（ゴールしたプレイヤーの車も）のパラメーター。アイテムのキノコも、その車自身のものを使う
  const cpuParamsOf = (k) => cpuParams(g.base, k === me ? 1 : rubberFactor(progress(race, k, track), myProgress, L), k === me ? 2 : g.level);
  karts.forEach((kart, k) => {
    const done = race.entries[k].finished;
    if (k === me && !done) {
      stepKart(kart, controls, track, g.base, dt);
    } else {
      // CPU（ゴールしたプレイヤーの車も CPU が運転する）
      const params = cpuParamsOf(k);
      stepKart(kart, cpuControl(g.cpus[k], kart, track, race.t, params.topSpeed), track, params, dt);
    }
  });
  const starSaved = starGuard(karts); // Star の車は障害物でスピンしない
  // 牛（Kampar Town）: どの車も、牛とぶつかったか見る
  if (track.cows.length) karts.forEach((kart) => cowContact(kart, track, race.t, PHYS));
  // スクールバス（Kampar Town）: 触れたらスピン
  if (track.buses.length) karts.forEach((kart) => busContact(kart, track, race.t, PHYS));
  // イノシシ（Soki Forest）: 牛と同じ
  if (track.boars.length) karts.forEach((kart) => boarContact(kart, track, race.t, PHYS));
  if (track.snowmen.length) karts.forEach((kart) => snowmanContact(kart, track, race.t, PHYS));
  if (track.moguls.length) karts.forEach((kart) => mogulContact(kart, track));
  if (track.trees.length) karts.forEach((kart) => treeContact(kart, track, race.t, PHYS));
  // 逆走を止める柵（ジャンプの着地側。2026-10-22 のユーザー依頼）
  if (track.oneWays.length) karts.forEach((kart) => oneWayContact(kart, track));
  // 橋の下の橋脚（Soki Forest）: ぶつかるとスピン
  if (track.bridgePiers?.length) karts.forEach((kart) => pierContact(kart, track, race.t, PHYS));
  // ぬかるみ（Soki Forest）: 入ると4秒ハンドルが逆。アイテムの入れ替わり（Banana・Lightning）も同じ kart.muddy なので、どのコースでも時間を減らす
  karts.forEach((kart) => mudContact(kart, track, dt));
  if (track.slows.length) karts.forEach((kart) => slowContact(kart, track, dt));
  // 恐竜（Soki Forest）: ジャンプ②を飛んでいて、恐竜が顔を出していたら食べられる
  // 悲鳴は自分が食べられたときだけ（2026-10-16 のユーザー依頼）
  if (track.dino) karts.forEach((kart) => {
    if (dinoContact(kart, track, race.t)) track.dinoChomp = race.t; // 3D の恐竜の口を閉じる
  });
  // サル（Soki Forest）: 投げて、落ちた木の実の当たりを全部の車で見てから消す
  if (track.monkeys.length) {
    track.nuts = g.nuts; // CPU が影をよけるため
    const thrown = stepNuts(g.nuts, track, karts, race.t);
    const mine = karts[g.me];
    g.monkeyThrows += thrown.filter((k) => Math.hypot(track.monkeys[k].x - mine.x, track.monkeys[k].z - mine.z) < 60).length;
    karts.forEach((kart) => nutContact(kart, g.nuts, race.t, PHYS, { keep: true }));
    dropFallen(g.nuts, race.t);
  }
  starRestore(karts, starSaved); // 木の実のあとで元にもどす（Star の車は木の実でもスピンしない）
  // アイテム（M3-A）: ITEM ボタン → 箱・ルーレット・バナナ・甲羅・Star の当たり
  if (g.items) {
    karts.forEach((kart, k) => {
      kart.finished = race.entries[k].finished; // 赤の甲羅は、相手がゴールしたら消える
    });
    const f = { me, press: controls.itemPressed, cpuPress: (k) => !race.entries[k].finished && cpuItem(g.cpus[k], karts[k], karts, track, race.t), t: race.t, ranks: ranking(race, track), finished: race.entries.map((e) => e.finished), params: g.base, paramsOf: (k) => (k === me && !race.entries[k].finished ? g.base : cpuParamsOf(k)), rand: Math.random };
    const out = itemFrame(g.items, karts, f, dt);
    for (const h of out.hits) {
      if (h.type === 'blast' && (h.k === me || Math.hypot(karts[h.k].x - karts[me].x, karts[h.k].z - karts[me].z) < 60)) g.blastsHeard++;
    }
  }
  // バンプで転がり始めた車の所に、小さな爆発（白い煙と火花）
  karts.forEach((kart) => {
    if (kart.tumble > 0 && !kart.tumbleShown) effects.burst(kart.x, kart.y + 0.5, kart.z);
    kart.tumbleShown = kart.tumble > 0;
    // 甲羅に当たって吹き飛んだ: 当たった所に小さな爆発（オレンジの光と煙）
    if (kart.blast > 0 && !kart.blastShown) effects.burst(kart.x, kart.y + 0.8, kart.z);
    kart.blastShown = kart.blast > 0;
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
    const est = e.finished ? e.time : race.t + (raceDistance(track) - progress(race, k, track)) / avg;
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

// レースで流す曲（コースの曲と、ゴール・結果の曲）を、スタートの前の紹介の間に作っておく（まだのものだけ。順に）
function prepareRaceSongs(def) {
  raceSongs(def).reduce((p, name) => p.then(() => music.prepare(name)), Promise.resolve());
}

// 大会の1レース。'next'（次のレースへ）か 'title'（タイトルへ。最後のレースのあとも）を返す
async function runRace(name, charId, cup, level = 2) {
  // 確かめ用: URL の後ろに #course2 / #course3 / #course4 を付けると、1レース目からそのコース
  const devCourse = ['course5', 'course4', 'course3', 'course2'].find((c) => dev.has(c));
  useCourse(devCourse ? COURSES[Number(devCourse.slice(-1)) - 1] : courseOf(COURSES, cup));
  prepareRaceSongs(course);
  const label = `RACE ${cup.done + 1}/${cup.races}`;
  // レースの画面に移ったら、曲（タイトル・結果）をだんだん小さくして止める。GO! でコースの曲が始まる
  music.stop(1.5);
  // スタートの前に、コースを回って映しながら、レースの番号とコースの名前を出す（タイトルと同じカメラ）
  await screens.courseIntro(menu, course.name, label, COURSE_INTRO);
  game = createGame(name, charId, level, cup);
  track.dinoChomp = null; // 恐竜の口を閉じた時刻は、レースごとに消す
  buildTop3(game);
  sfx.engine.start();
  if (standSpot) crowd.start(); // 歓声は観客席のあるコースだけ
  camera.userData = {}; // カメラの動きを最初から（前のレースの位置を引きずらない）
  raceHud.classList.add('show');
  speedo.classList.remove('hidden'); // 上位3人の場所を決めるのに、速度計の大きさが要る
  countEl.classList.remove('go');
  placeButtons();
  const why = await new Promise((resolve) => {
    game.onEnd = resolve;
  });
  commitPlay();
  showChomp(null); // 恐竜でまっくらのまま、レースをやめたとき
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
  // 結果も大会の順位も、ボタンなしで、全部の表示が終わって3秒後に次へ（2026-10-16 のユーザー依頼）
  const shown = screens.results(menu, rows, label);
  fade(0); // 結果の画面を出してから、だんだん明るく
  await shown;
  const over = isOver(cup);
  const table = standings(cup).map((k, n) => ({
    place: ordinal(n + 1),
    name: g.names[k],
    total: cup.totals[k],
    gained: cup.gained[k],
    face: g.faces[k],
    me: k === g.me,
  }));
  await screens.standings(menu, table, label, over);
  // 最後のレースのあとはタイトルへ。遊べる時間が終わっていたら、呼んだ所で「See you tomorrow!」
  return over ? 'title' : 'next';
}

// TIME TRIAL の1レース（2026-10-18 のユーザー依頼）: CPU なしで3周。ゴールしたらタイムといちばん速いタイム。
// 'again'（同じコースをもう一度）・'courses'（コース選びへ）・'title' を返す
async function runTimeTrial(name, charId, def) {
  useCourse(def);
  prepareRaceSongs(course);
  music.stop(1.5);
  await screens.courseIntro(menu, course.name, 'TIME TRIAL', COURSE_INTRO);
  game = createGame(name, charId, 2, null, { solo: true });
  track.dinoChomp = null;
  buildTop3(game);
  sfx.engine.start();
  if (standSpot) crowd.start();
  camera.userData = {};
  raceHud.classList.add('show', 'solo-tt');
  speedo.classList.remove('hidden');
  countEl.classList.remove('go');
  placeButtons();
  const why = await new Promise((resolve) => {
    game.onEnd = resolve;
  });
  commitPlay();
  showChomp(null);
  raceHud.classList.remove('show', 'solo-tt');
  if (why === 'title') {
    removeGame();
    placeButtons();
    return 'title';
  }
  music.stop(FADE_SEC);
  await fade(1);
  const time = game.race.entries[game.me].time;
  removeGame();
  placeButtons();
  // みんなの記録に送って、受け取り直す（つながらなければ、その端末にためて、前に受け取った記録で出す）
  const mine = await sharedTimes.add({ course: course.name, name, character: charId, time, date: dateText(new Date()) });
  const view = await withTimeout(sharedTimes.refresh(), 4000) ?? sharedTimes.view();
  const list = view[course.name] ?? [];
  const place = list.findIndex((e) => e.id === mine.id);
  music.play(place === 0 ? 'victory' : 'results');
  const shown = screens.ttResults(menu, {
    course: course.name,
    timeText: `TIME ${timeText(time)}`,
    note: place === 0 ? '★ NEW RECORD! ★' : place > 0 ? `TOP 10! (${place + 1})` : '',
    rows: screens.ttRows(list, mine.id, CHAR_NAMES, timeText),
    buttons: [
      { id: 'again', label: '↻ AGAIN' },
      { id: 'courses', label: '◀ COURSES' },
      { id: 'title', label: '⌂ TITLE' },
    ],
  });
  fade(0);
  return shown;
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
  if (standSpot) crowd.start(); // 歓声は観客席のあるコースだけ
  if (pick === 'title' && game.onEnd) {
    const end = game.onEnd;
    game.onEnd = null;
    end('title');
  }
});

// TIME TRIAL のみんなの記録（2026-10-18 のユーザー依頼）。手元の確かめ（https でない）では送らない（Super Kyugo＆Soki Brothers と同じ）
let browserStorage = null;
try {
  browserStorage = window.localStorage;
} catch {
  // 使えない端末
}
const memoryStorage = { getItem: () => null, setItem: () => {} };
const sharedTimes = new SharedTimes({
  url: location.protocol === 'https:' ? TIMES_URL : '',
  fetch: (url, opt) => fetch(url, opt),
  storage: browserStorage ?? memoryStorage,
  makeId: () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
});
const CHAR_NAMES = Object.fromEntries(PLAYER_CHARS.map((c) => [c.id, c.name]));
// つながらないときに待ちすぎない
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);

async function seeYouTomorrow(name) {
  await screens.message(menu, 'See you tomorrow!', `${name}, you played enough today.`, [{ id: 'ok', label: 'OK' }]);
}

async function flow() {
  let resume = null; // TIME TRIAL の結果で「コース選び」を押したとき: { mode, name } でコース選びから
  for (;;) {
    music.play('title'); // タイトル・名前・キャラ選びの間ずっと（同じ曲が流れていれば何もしない）
    // タイトル → 名前 → キャラ選び（→ Level）。BACK で1つ前の画面へ戻る
    // TIME TRIAL（2026-10-18 のユーザー依頼）: タイトル → 名前 → コース選び → キャラ選び
    let mode = resume?.mode ?? 'solo';
    let screen = resume ? 'course' : 'title';
    let name = resume?.name ?? null;
    resume = null;
    if (screen === 'title') useCourse(COURSES[0]); // タイトルのカメラは1つ目のコースを映す
    let charId = null;
    let level = null; // CPU の速さ（1〜3。2026-10-17 のユーザー依頼）
    let courseNo = load('ttCourse', 0);
    let ready = false;
    while (!ready) {
      if (screen === 'title') {
        mode = await screens.title(menu, audio);
        screen = 'name';
      } else if (screen === 'name') {
        const recent = cleanRecent(load('recent', []));
        name = await screens.askName(menu, recent);
        if (name === screens.BACK) {
          screen = screens.prevScreen('name', mode);
          continue;
        }
        save('recent', addRecent(recent, name));
        if (remainingSec(playStore(), name, Date.now()) <= 0) {
          await seeYouTomorrow(name);
          screen = 'title';
          continue;
        }
        screen = mode === 'timetrial' ? 'course' : 'character';
      } else if (screen === 'course') {
        // コースを押すと、そのコースを背景に映す（タイトルと同じカメラ）。もう一度押すと決まる
        const pick = await screens.chooseCourse(menu, COURSES, courseNo, {
          onSelect: (k, sound) => {
            // 背景に映すのは、もう形を作ってあるコースだけ（作ると、タブレットで10秒ほど止まった。2026-10-22 のユーザー依頼）。ほかはタイトルのコース
            const built = builtTracks.get(COURSES[k]);
            useCourse(built?.mesh || built?.showcaseMesh ? COURSES[k] : COURSES[0], { lite: true });
            if (sound) sfx.play('select');
          },
          records: () => sharedTimes.view(),
          line: (e) => screens.recordLine(e, CHAR_NAMES, timeText),
          refresh: sharedTimes.refresh(),
        });
        if (pick === screens.BACK) {
          useCourse(COURSES[0]);
          screen = screens.prevScreen('course', mode);
          continue;
        }
        courseNo = pick;
        save('ttCourse', courseNo);
        screen = 'character';
      } else if (screen === 'character') {
        const pick = await screens.chooseCharacter(menu, PLAYER_CHARS, remainingText(remainingSec(playStore(), name, Date.now())));
        if (pick === screens.BACK) screen = screens.prevScreen('character', mode);
        else {
          charId = pick;
          if (mode === 'timetrial') ready = true;
          else screen = 'level';
        }
      } else {
        // レースの画面: CPU の速さを選ぶ（前に選んだ Level を覚えておく）
        const pick = await screens.chooseLevel(menu, load('level', 2), { onSelect: () => sfx.play('select') });
        if (pick === screens.BACK) screen = screens.prevScreen('level', mode);
        else {
          level = pick;
          save('level', level);
          ready = true;
        }
      }
    }
    if (mode === 'timetrial') {
      for (;;) {
        const pick = await runTimeTrial(name, charId, COURSES[courseNo]);
        if (remainingSec(playStore(), name, Date.now()) <= 0) {
          await seeYouTomorrow(name);
          break;
        }
        if (pick === 'courses') resume = { mode, name };
        if (pick !== 'again') break;
      }
      continue;
    }
    const cup = createCup(CPU_COUNT + 1, COURSES.length);
    for (;;) {
      const pick = await runRace(name, charId, cup, level);
      if (remainingSec(playStore(), name, Date.now()) <= 0) {
        await seeYouTomorrow(name);
        break;
      }
      if (pick === 'title') break;
    }
  }
}

// ステージの大きな表示（2秒出して、だんだん消す）
const stageBanner = $('stage-banner');
let stageBannerTimer = null;
function showStageBanner(k) {
  stageBanner.querySelector('.no').textContent = `STAGE ${k + 1}`;
  stageBanner.querySelector('.name').textContent = track.stages[k].name;
  stageBanner.classList.add('show');
  clearTimeout(stageBannerTimer);
  stageBannerTimer = setTimeout(() => stageBanner.classList.remove('show'), 2000);
}

// ---- 描く ----
let frames = 0;
let fpsTime = 0;
let fps = 60;
let orbit = 0;
const overHead = new THREE.Vector3();

// コースの一部だけを見せるコース（Global City はクアラルンプールだけ。2026-10-20 のユーザーの判断）
let showcasing = false;
function idleCamera(dt) {
  const c = scene.userData.course;
  if (c?.def.showcase) {
    orbit += dt * 0.08;
    showcaseCamera(camera, c, orbit / 0.08);
    if (!showcasing) {
      // ステージ 7 として見せると、まわりはクアラルンプール（6）だけ（6 だと、となりのニューヨークも見える）
      applyStageVisibility(scene.userData.courseMesh, 7, null);
      setSky(scene, skyFor(c, 6, { y: 0, auto: null }));
      showcasing = true;
    }
    return;
  }
  if (showcasing) {
    resetSky(scene);
    showcasing = false;
  }
  orbitCamera(dt);
}

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
  if (showcasing) {
    resetSky(scene); // コース選びのクアラルンプールの空を戻す（Global City は、このあとステージの空に）
    showcasing = false;
  }
  const views = g.karts.map((kart, k) => {
    const cur = poseOf(kart);
    const prev = g.prev[k];
    const jumped = Math.hypot(cur.x - prev.x, cur.z - prev.z) > 10;
    return { ...kart, ...(jumped ? cur : blendPose(prev, cur, alpha)) };
  });
  views.forEach((v, k) => syncKartModel(g.models[k], v));
  // 自動の区間（Global City の大ジャンプ・宇宙・ワープ）の間は、自分の車だけを映す（2026-10-20 のユーザーの判断）
  const meAuto = !!g.karts[g.me].auto;
  if (meAuto) g.models.forEach((m, k) => { if (k !== g.me) m.visible = false; });
  if (meAuto) views.forEach((v, k) => { if (k !== g.me) v.hidden = true; }); // アイテムの見た目も、消した車の分は出さない
  // 浮いている車の下の影（全部のコースで。2026-10-17 のユーザー依頼）: 地面に。高いほど小さく、うすく
  views.forEach((v, k) => {
    const sh = g.shadows[k];
    sh.visible = !!v.airborne && !v.swallowed && !(v.respawn > 0) && !(meAuto && k !== g.me);
    if (!sh.visible) return;
    const loc = locate(track, v.x, v.z, v.seg, 40, v.y);
    // 地面のない所（ジャンプ台の先）: 森は川の水面、ほかのコースは下の地面（高さ 0。Kenta Circuit は下を通る道）
    const ground = loc.ground ?? (track.def.theme === 'forest' ? -1.15 : 0);
    const h = Math.max(0, v.y - ground);
    sh.position.set(v.x, ground + 0.12, v.z);
    sh.scale.setScalar(0.7 * Math.max(0.6, 1.4 - h * 0.06)); // 2026-10-17 のユーザー依頼で 7割の大きさに
    sh.material.opacity = Math.max(0.12, 0.45 - h * 0.025);
  });
  placeCows(g.race.t);
  placeBuses(g.race.t);
  placeTrains(g.race.t, g.base.topSpeed);
  placeBoars(g.race.t);
  placeMonkeys(g.race.t, g.nuts);
  placeDino(g.race.t);
  placeSnowmen(g, g.race.t);
  // トンネル（Kyugo Mountain）: 入ると一度まっくら、中は暗く、車の前にライト、画面のまわりを暗く
  g.tunnel = tunnelLight(g.tunnel, !!track.samples[g.karts[g.me].seg]?.tunnel, dt);
  // 出口の 120m 手前から、霧を晴らす（外の景色が見える）
  const me = g.karts[g.me];
  const toExit = track.samples[me.seg]?.tunnel && track.marks.TO !== undefined ? span(track, track.samples[me.seg].s, track.marks.TO) : Infinity;
  // Global City: 今のステージとその前後の景色だけ見せる。空・霧・光はステージごと（トンネルの暗さは、その上から）
  if (track.def.theme === 'world') {
    const rel = progress(g.race, g.me, track);
    const cur = viewStage(track, me, stageAt(track, rel)); // 宇宙から下りてくる後半は香港
    // 前後のステージは、さかいめの近くだけ見せる（遠くの都市が見えた。2026-10-21 のユーザー依頼）
    const w = stageWindow(track, rel);
    const win = w.cur === cur ? w : { cur, next: false, prev: false };
    // 宇宙は高さ 150m より上だけ（打ち上がってすぐと、香港へ下りてくる所では、京都・香港の景色が見える）。ワープは3つ目の輪っかから
    const autoView = autoViewOf(me);
    applyStageVisibility(track.mesh, cur, autoView, win);
    // 夜のステージでは、カートのライトを点ける
    const night = nightStage(track, cur);
    for (const m of g.models) if (m.userData.lights) m.userData.lights.visible = night;
    // 宇宙・ワープの間は、コースの道や柵も見せない（宇宙から香港の道が見えた。2026-10-21 のユーザー依頼「宇宙とコースを完全に分離」）
    const away = autoView === 'space' || autoView === 'warp';
    const stageSet = new Set(track.mesh.userData.stageGroups ?? []);
    for (const c of track.mesh.children) if (!stageSet.has(c) && c.visible === away) c.visible = !away;
    // 終わりの白い光（宇宙は地球に突っこむところ、ワープは最後）。着いたら、だんだん消す
    const ap0 = autoProgress(track, me);
    const target = me.auto?.id === 'space' ? spaceLook(ap0).flash : me.auto?.id === 'warp' ? warpLook(ap0).flash : 0;
    flashLevel = Math.max(target, flashLevel - dt * 1.5);
    spaceFlash.style.opacity = String(flashLevel);
    const look = skyFor(track, cur, me);
    setSky(scene, look);
    // 宇宙・ワープの間は、平らな地面を消す（宇宙から灰色の地面が見えた）
    if (scene.userData.ground) scene.userData.ground.visible = groundShown(track, rel, look.mode); // 宇宙・ワープ・海の底の区間では見せない
  }
  showTunnel(g.tunnel, views[g.me], Math.max(0, Math.min(1, 1 - toExit / 120)));
  // スローの板の矢印を、うしろへ流す（Kyugo Mountain）
  for (const tx of track.slowTextures ?? []) tx.offset.y = (tx.offset.y + dt * 1.5) % 1;
  // 食べられた演出（血のりは出さない。2026-10-16 のユーザーの判断「子供向けには刺激が強い」）
  const meK = g.karts[g.me];
  if (meK.swallowed) g.chompE = DINO_BLACK - meK.respawn;
  else if (g.chompE != null) g.chompE += dt; // 走り直したあと（まだ暗い）
  if (g.chompE != null && g.chompE > DINO_BLACK + DINO_AFTER + DINO_FADE_IN) g.chompE = null;
  showChomp(g.chompE ?? null);
  // 遠すぎる車の名前は出さない（コースの反対側の札が、景色の上に浮かないように）
  g.tags.forEach((tag, k) => {
    if (tag) tag.visible = !meAuto && Math.hypot(views[k].x - views[g.me].x, views[k].z - views[g.me].z) < TAG_RANGE;
  });
  const mine = views[g.me];
  const kart = g.karts[g.me];
  effects.update(mine, dt);
  // アイテム: 箱・バナナ・甲羅の見た目と、上の真ん中の枠
  if (g.items) {
    g.itemView.update(g.items, views, g.race.t);
    // 稲妻: 落ちた瞬間の白い光。自分の左右が稲妻で入れ替わっている間は、画面の端が黄色く光る
    itemFlash.style.opacity = String(g.items.flash * 0.9);
    const meK2 = g.karts[g.me];
    zapGlow.style.opacity = meK2.shock > 0 && meK2.muddy > 0 ? '1' : '0';
    // ほかの車の入れ替わりの煙（近くの車だけ）
    views.forEach((v, k) => {
      if (k !== g.me && v.muddy > 0 && Math.hypot(v.x - mine.x, v.z - mine.z) < 80) effects.mud(v);
    });
    const show = slotItem(g.karts[g.me]);
    if (show !== g.slotShown) {
      g.slotShown = show;
      itemIconEl.innerHTML = show ? ITEM_ICONS[show] : '';
    }
  }
  const { race } = g;
  const e = race.entries[g.me];
  const flying = g.flyT < START_FLY_TIME;
  if (dev.has('front')) updateFrontCamera(camera, mine);
  else if (flying) updateStartCamera(camera, mine, g.flyT);
  else if (e.finished) updateFinishCamera(camera, mine, race.t - e.time, dt);
  else updateChaseCamera(camera, mine, g.base.topSpeed, dt);
  // Global City: 宇宙の景色はカメラについていく（いん石が流れ、地球が回る）
  const ap = autoProgress(track, g.karts[g.me]); // 宇宙・ワープの演出の進み
  for (const sg of track.mesh.userData.stageGroups ?? []) if (sg.userData.followCamera && sg.visible) (sg.userData.warp ? updateWarp : updateSpace)(sg, camera, race.t, ap);
  // ワープの最後: 正面の光の円の真ん中へ、自分の車が小さくなりながら吸いこまれる（2026-10-22 のユーザー依頼）
  const meModel = g.models[g.me];
  const suck = kart.auto?.id === 'warp' ? warpLook(ap).suck : 0;
  if (suck > 0) {
    camera.updateMatrixWorld();
    // 吸いこみはじめの、カメラから見た車の位置（とんでもなく遠いときは、いつもの位置から）
    if (!g.suckFrom) {
      g.suckFrom = camera.worldToLocal(meModel.position.clone());
      if (g.suckFrom.length() > 30) g.suckFrom.set(0, -2.6, -6.8);
    }
    const sp = suckPose(g.suckFrom, suck);
    meModel.position.copy(camera.localToWorld(new THREE.Vector3(sp.x, sp.y, sp.z)));
    meModel.scale.setScalar(sp.scale);
    if (suck >= 1) meModel.visible = false;
  } else if (g.suckFrom) {
    g.suckFrom = null;
    meModel.scale.setScalar(1);
  }
  for (const sg of track.mesh.userData.stageGroups ?? []) if (sg.userData.swimmers && sg.visible) updateSea(sg, race.t, camera);
  speedLines.style.opacity = kart.boost > 0 ? 1 : 0;
  // 京都へ向かう加速板では、光の線を濃く速く回し、画面のまわりを白く光らせ、広い角度で（あっという間に京都へ。2026-10-21 のユーザー依頼）
  const rush = padRush(track, kart);
  speedLines.classList.toggle('rush', rush);
  rushK = rushFovStep(rushK, rush, dt); // なめらかに広げたり戻したり
  if (rushK > 0.001) {
    camera.fov += 18 * rushK; // 走るときのカメラが毎フレームもとの角度にするので、その上から広げる
    camera.updateProjectionMatrix();
  }
  // 表示
  setText(speedNum, kart.autoError ? 'ERR' : speedText(kart.speed));
  speedo.classList.toggle('boost', kart.boost > 0);
  speedo.classList.toggle('error', !!kart.autoError); // ワープの最後の区間はスピードメーターが ERROR（Global City）
  // Global City: 周回のかわりにステージ（STAGE 4/7 HONG KONG）。ステージが変わったら、場所を大きく出す（2026-10-20 のユーザー依頼）
  const stageNow = track.stages.length ? bannerStageAt(track, progress(race, g.me, track)) : 0; // 表示は banner の所で切りかわる（NEW YORK はトンネルを抜けてすぐ）
  if (track.stages.length) {
    setText(lapEl, screens.stageText(track, stageNow));
    // 1/7 は GO! の 1秒後。そのあとはステージが変わったとき
    if (g.stageShown !== stageNow && !flying && race.t > 1 && !e.finished) {
      g.stageShown = stageNow;
      showStageBanner(stageNow);
    }
  } else setText(lapEl, `LAP ${Math.min(raceLaps(track), e.lap + 1)}/${raceLaps(track)}`);
  setText(timeEl, timeText(Math.max(0, e.finished ? e.time : race.t)));
  const order = ranking(race, track);
  setText(rankEl, ordinal(order.indexOf(g.me) + 1));
  setText(countEl, flying ? '' : e.finished ? (race.t - e.time < FINISH_TEXT ? 'FINISH!' : '') : countdownText(race));
  minimap.draw(views.map((v, k) => ({ x: v.x, z: v.z, color: g.faces[k].color, me: k === g.me })));
  showTop3(g, order.slice(0, 3), dt);
  setText(leftEl, remainingText(Math.max(0, g.leftBase - g.playSec)));
  // 音: 前のフレームとくらべて鳴らす。エンジン音は毎フレーム高さを近づける
  // バンプの警告（自分の車だけ。ゴールしたあとは出さない）
  g.bumpWarn = !e.finished && bumpWarning(track, kart);
  const now = soundState({ count: countEl.textContent, lap: track.stages.length ? stageNow : e.lap, finished: e.finished, kart, bumps: g.bumps, wallQuiet: g.wallQuiet, jumpSoon: jumpAhead(track, kart), bumpWarn: g.bumpWarn, busNear: !e.finished && busNear(track, kart, g.race.t), boarWarn: !e.finished && boarWarning(track, kart, g.race.t), monkeyThrows: g.monkeyThrows, dinoRoar: !e.finished && dinoNear(kart, g.race.t), snowmanHop: g.snowmanHops, thunder: g.items?.thunder ?? 0, blastsHeard: g.blastsHeard });
  g.wallQuiet = kart.onWall ? 0 : g.wallQuiet + dt; // 壁から離れている秒数
  for (const name of soundEvents(g.sound, now, track.stages.length || raceLaps(track))) {
    if (name === 'driftStart') sfx.drift(true, kart.speed / g.base.topSpeed);
    else if (name === 'driftEnd') sfx.drift(false);
    else if (name === 'jump') voices.play(g.voice); // 自分の車だけ、キャラの声で叫ぶ
    else if (name === 'bigJump') { sfx.play('bigJump'); voices.play(g.voice); } // お台場の大ジャンプ: 音とキャラの声
    else if (name === 'eaten') voices.has('scream') ? voices.play('scream') : sfx.play('eaten'); // 「ぎゃーーー」
    else if (name === 'dinoRoar') voices.play('roar', dinoVolume(kart)); // 恐竜の咆哮（遠いほど小さく）
    else if (name === 'startDash') voices.has('rocket') ? voices.play('rocket') : sfx.play('boost'); // スタートダッシュ（ユーザーが用意した音）
    else if (name === 'warp') voices.has('warp') ? voices.play('warp') : sfx.play('warp'); // ワープの音（ユーザーが用意した音）
    else if (name === 'ring') voices.has('ring') ? voices.play('ring') : sfx.play('boost'); // ワープの輪っかを通る音（ユーザーが用意した音。2026-10-22）
    else if (name === 'launch') voices.has('launch') ? voices.play('launch') : sfx.play('launch'); // 発射台の急な坂（ユーザーが用意した音）
    else if (name === 'busPass') voices.has('horn') ? voices.play('horn') : sfx.play('busPass'); // バスのクラクション（ユーザーが用意した音）
    else if (name === 'tramPass') voices.has('tram') ? voices.play('tram') : sfx.play('busPass'); // 香港の路面電車（ユーザーが用意した電車のクラクション）
    else if (name === 'explosion') voices.has('explosion') ? voices.play('explosion') : sfx.play('bump'); // 甲羅で吹き飛んだ（ユーザーが用意した音）
    else if (name === 'thunder') voices.has('thunder') ? voices.play('thunder') : sfx.play('bump'); // 稲妻（ユーザーが用意した音）
    else if (name === 'starOn') sfx.star(true);
    else if (name === 'starOff') sfx.star(false);
    else if (name !== 'finish') sfx.play(name);
    if (standSpot && (name === 'finalLap' || name === 'finish')) crowd.excite(3);
    if (name === 'go') music.play(course.music);
    if (name === 'finalLap') music.setRate(FINAL_LAP_RATE);
    if (name === 'finish') {
      // 順位で音を変える: 1〜3位は明るいファンファーレと勝利の曲、4位以下はちょっと悲しいファンファーレと別の曲
      const fm = finishMusic(order.indexOf(g.me) + 1);
      sfx.play(fm.sfx);
      music.play(fm.song, { delay: 1.5 }); // コースの曲を止め、ファンファーレのあとに流す
    }
  }
  g.sound = now;
  sfx.engine.update(kart.speed, g.base.topSpeed, kart.boost > 0); // トンネルの中も外と同じ音（2026-10-19 のユーザー依頼）
  if (standSpot) crowd.update(crowdMix(mine, standSpot));
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

// 確かめ用: URL の後ろに #perf を付けると、下の文字に、1回の書きかえの計算の時間（js）・描く指示の時間（draw）・描く回数・三角の数・画面の細かさを出す
// （タブレットでどこが重いか見るため。2026-10-22）。js + draw が書きかえの間（60fps なら 16.7ms）より短いのに fps が低ければ、絵を描く部品（GPU）が重い
const perfOn = dev.has('perf');
const perf = { js: 0, draw: 0, n: 0, text: '' };
startLoop({
  update(dt) {
    const t0 = perfOn ? performance.now() : 0;
    controls.tick();
    if (game && !game.paused) stepGame(dt);
    if (perfOn) perf.js += performance.now() - t0;
  },
  render(alpha, frameDt) {
    const tStart = perfOn ? performance.now() : 0;
    const dt = Math.min(0.1, frameDt);
    frames++;
    fpsTime += dt;
    if (fpsTime >= 2) {
      fps = Math.round(frames / fpsTime);
      frames = 0;
      fpsTime = 0;
      if (perfOn && perf.n) {
        const info = renderer.info.render;
        perf.text = `  js ${(perf.js / perf.n).toFixed(1)}ms draw ${(perf.draw / perf.n).toFixed(1)}ms calls ${info.calls} tri ${Math.round(info.triangles / 1000)}k pr ${renderer.getPixelRatio().toFixed(2)}`;
        perf.js = perf.draw = perf.n = 0;
      }
      const q = nextQuality(quality, fps);
      if (q !== quality) {
        quality = q;
        resize();
      }
    }
    for (const n of BUTTONS) els[n].classList.toggle('active', controls.touch[n]);
    let wrong = false;
    let warn = false;
    let mine = null;
    // 一時停止中は、車・タイヤ・カメラを動かさず、止めたときの画面のまま描く（2026-10-15 の実機確認）
    if (game && game.paused) {
      // 何もしない
    } else if (game) {
      const r = renderGame(alpha, dt);
      mine = r.mine;
      wrong = r.kart.wrongWay;
      warn = game.bumpWarn;
    } else {
      idleCamera(dt);
    }
    const tDraw = perfOn ? performance.now() : 0;
    renderer.render(scene, camera);
    if (perfOn) {
      perf.js += tDraw - tStart;
      perf.draw += performance.now() - tDraw;
      perf.n++;
    }
    // 逆走の警告: キャラの頭の上の画面の位置に出す
    wrongWayEl.classList.toggle('show', wrong);
    if (wrong) {
      overHead.set(mine.x, mine.y + 3.6, mine.z).project(camera);
      wrongWayEl.style.left = `${((overHead.x + 1) / 2) * window.innerWidth}px`;
      wrongWayEl.style.top = `${((1 - overHead.y) / 2) * window.innerHeight}px`;
    }
    // バンプの警告: 自分の頭の上（逆走の警告より上）に、赤い文字で（2026-10-15 のユーザー依頼）
    bumpWarnEl.classList.toggle('show', warn);
    if (warn) {
      overHead.set(mine.x, mine.y + 4.6, mine.z).project(camera);
      bumpWarnEl.style.left = `${((overHead.x + 1) / 2) * window.innerWidth}px`;
      bumpWarnEl.style.top = `${((1 - overHead.y) / 2) * window.innerHeight}px`;
    }
    speedo.classList.toggle('hidden', !game);
    setText(hud, `${fps}fps  ${controls.mode}  v:${VERSION}${perf.text}`);
  },
});

// ホーム画面に追加したときに使う（https のときだけ。手元の http://localhost では使わない）
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

flow();
