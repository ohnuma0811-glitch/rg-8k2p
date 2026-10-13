// 起動。M1 は「1人でコースを走る」だけ
import { startLoop } from './loop.js';
import { COURSE1 } from './data/tracks.js';
import { buildTrack } from './game/track.js';
import { createKart, stepKart } from './game/kart.js';
import { kartParams } from './game/stats.js';
import { Controls, attachControls, computeButtonLayout, hasTouch } from './input.js';
import { createRenderer, createWorld, resizeRenderer, updateChaseCamera, updateFrontCamera } from './render/scene.js';
import { createKartModel, syncKartModel } from './render/models.js';
import { createEffects } from './render/effects.js';
import { nextQuality, pixelRatio } from './render/quality.js';

// 版番号（公開のときに scripts/deploy.sh がコミットの番号に置き換える。古い版が動いていないか確かめる用）
const VERSION = 'dev';
const canvas = document.getElementById('game');
const hud = document.getElementById('hud');
const rotate = document.getElementById('rotate');
const speedLines = document.getElementById('speed-lines');
const probe = document.getElementById('safe-probe');
const BUTTONS = ['left', 'right', 'brake', 'drift', 'item'];
const els = Object.fromEntries(BUTTONS.map((n) => [n, document.getElementById(`btn-${n}`)]));

const track = buildTrack(COURSE1);
const kart = createKart(track, track.startIndex);
const params = kartParams({ accel: 3, top: 3, handling: 3 });
const renderer = createRenderer(canvas);
const { scene, camera } = createWorld(track);
// 確かめ用: URL の後ろに #front を付けると車を前から見る、#soki を付けると Soki で走る（例: #front&soki）
const dev = new Set(location.hash.slice(1).split('&'));
const model = createKartModel(dev.has('soki') ? { body: 0x1c3c88, character: 'soki' } : {});
scene.add(model);
const effects = createEffects(scene);
const controls = new Controls();
// タッチできる端末はボタン、パソコンはキーボード
controls.setMode(hasTouch() ? 'buttons' : 'keyboard');
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
    el.classList.toggle('hidden', controls.mode === 'keyboard');
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
    if (dev.has('front')) updateFrontCamera(camera, kart);
    else updateChaseCamera(camera, kart, params.topSpeed, dt);
    // 画面の端を流れる線: 加速中ははっきり、最高速の近くでは薄く
    speedLines.style.opacity = kart.boost > 0 ? 1 : Math.max(0, (kart.speed / params.topSpeed - 0.85) / 0.15) * 0.5;
    renderer.render(scene, camera);
    hud.textContent = `${fps}fps  ${Math.round(Math.abs(kart.speed) * 3.6)}km/h  ${kart.surface}  ${controls.mode}  v:${VERSION}`;
  },
});
