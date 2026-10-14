// 起動。M1 は「1人でコースを走る」だけ
import { startLoop } from './loop.js?v=4cb225e';
import { COURSE1 } from './data/tracks.js?v=4cb225e';
import { buildTrack } from './game/track.js?v=4cb225e';
import { createKart, stepKart } from './game/kart.js?v=4cb225e';
import { kartParams } from './game/stats.js?v=4cb225e';
import { Controls, attachControls, computeButtonLayout, hasTouch } from './input.js?v=4cb225e';
import { createRenderer, createWorld, resizeRenderer, updateChaseCamera, updateFrontCamera } from './render/scene.js?v=4cb225e';
import { createKartModel, syncKartModel } from './render/models.js?v=4cb225e';
import { createEffects } from './render/effects.js?v=4cb225e';
import { nextQuality, pixelRatio } from './render/quality.js?v=4cb225e';
import { blendPose, poseOf } from './render/interp.js?v=4cb225e';

// 版番号（公開のときに scripts/deploy.sh がコミットの番号に置き換える。古い版が動いていないか確かめる用）
const VERSION = '4cb225e';
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
// 1つ前の計算での車の位置（描くときに、今の計算とのあいだをつなぐ）
let prevPose = poseOf(kart);
startLoop({
  update(dt) {
    controls.tick();
    prevPose = poseOf(kart);
    stepKart(kart, controls, track, params, dt);
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
    // 前の計算と今の計算のあいだに車を置く（コースに戻したときのような大きな移動はつながない）
    const cur = poseOf(kart);
    const jumped = Math.hypot(cur.x - prevPose.x, cur.z - prevPose.z) > 10;
    const view = { ...kart, ...(jumped ? cur : blendPose(prevPose, cur, alpha)) };
    syncKartModel(model, view);
    effects.update(view, dt);
    if (dev.has('front')) updateFrontCamera(camera, view);
    else updateChaseCamera(camera, view, params.topSpeed, dt);
    // 画面の端を流れる線は、加速中だけ
    speedLines.style.opacity = kart.boost > 0 ? 1 : 0;
    renderer.render(scene, camera);
    hud.textContent = `${fps}fps  ${Math.round(Math.abs(kart.speed) * 3.6)}km/h  ${kart.surface}  ${controls.mode}  v:${VERSION}`;
  },
});
