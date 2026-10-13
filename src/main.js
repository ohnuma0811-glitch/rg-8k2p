// 起動。M1 は「1人でコースを走る」だけ
import { startLoop } from './loop.js';
import { COURSE1 } from './data/tracks.js';
import { buildTrack } from './game/track.js';
import { createKart, stepKart } from './game/kart.js';
import { kartParams } from './game/stats.js';
import { Controls, attachControls, computeButtonLayout, startTilt } from './input.js';
import { createRenderer, createWorld, resizeRenderer, updateChaseCamera } from './render/scene.js';
import { createKartModel, syncKartModel } from './render/models.js';
import { createEffects } from './render/effects.js';
import { nextQuality, pixelRatio } from './render/quality.js';
import { chooseControls } from './screens/controls.js';
import { load, save } from './settings.js';

// 版番号（公開のときに scripts/deploy.sh がコミットの番号に置き換える。古い版が動いていないか確かめる用）
const VERSION = 'dev';
const canvas = document.getElementById('game');
const hud = document.getElementById('hud');
const rotate = document.getElementById('rotate');
const speedLines = document.getElementById('speed-lines');
const toast = document.getElementById('toast');
const probe = document.getElementById('safe-probe');
const BUTTONS = ['left', 'right', 'brake', 'drift', 'item'];
const els = Object.fromEntries(BUTTONS.map((n) => [n, document.getElementById(`btn-${n}`)]));

const track = buildTrack(COURSE1);
const kart = createKart(track, track.startIndex);
const params = kartParams({ accel: 3, top: 3, handling: 3 });
const renderer = createRenderer(canvas);
const { scene, camera } = createWorld(track);
const model = createKartModel();
scene.add(model);
const effects = createEffects(scene);
const controls = new Controls();
let quality = 1;
let layout;

function safeArea() {
  const cs = getComputedStyle(probe);
  return {
    left: parseFloat(cs.paddingLeft) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
  };
}

function placeButtons() {
  for (const n of BUTTONS) {
    const b = layout[n];
    const el = els[n];
    const hidden = controls.mode === 'keyboard' || (controls.mode === 'tilt' && (n === 'left' || n === 'right'));
    el.classList.toggle('hidden', hidden);
    Object.assign(el.style, { left: `${b.x - b.r}px`, top: `${b.y - b.r}px`, width: `${b.r * 2}px`, height: `${b.r * 2}px` });
  }
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
attachControls(controls, document.getElementById('touch-layer'), () => layout);

const mode = await chooseControls(document.getElementById('menu'), load('controls', 'buttons'));
if (mode !== 'keyboard') save('controls', mode);
controls.setMode(mode);
// 傾きセンサーの値が来ない端末では、ボタン操作に戻して知らせる
function useButtons() {
  controls.setMode('buttons');
  save('controls', 'buttons');
  resize();
  toast.textContent = 'Tilt is not working. Using BUTTONS.';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}
if (mode === 'tilt') startTilt(controls, { onNoSensor: useButtons });
resize();

let frames = 0;
let fpsTime = 0;
let fps = 60;
let last = performance.now();
startLoop({
  update(dt) {
    controls.tick();
    stepKart(kart, controls, track, params, dt);
  },
  render() {
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
    syncKartModel(model, kart);
    effects.update(kart, dt);
    updateChaseCamera(camera, kart, params.topSpeed, dt);
    speedLines.classList.toggle('show', kart.boost > 0);
    renderer.render(scene, camera);
    hud.textContent = `${fps}fps  ${Math.round(Math.abs(kart.speed) * 3.6)}km/h  ${kart.surface}  ${controls.mode}  v:${VERSION}`;
  },
});
