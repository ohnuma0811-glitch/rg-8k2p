// タッチボタン・傾き・キーボードを、steer（-1〜1、右が正）/ brake / drift / item にまとめる
const KEYS = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  brake: ['ArrowDown'],
  drift: ['Digit0', 'Numpad0'],
  item: ['Enter', 'NumpadEnter'],
};
const HANDLED = new Set(Object.values(KEYS).flat());

// mode: 'buttons'（◀ ▶ を出す）/ 'tilt'（◀ ▶ を出さない）/ 'keyboard'（ボタンを出さない）
export function computeButtonLayout(winW, winH, safe = { left: 0, right: 0, bottom: 0 }, mode = 'buttons') {
  // 半径は画面の短い辺の11%、44〜72px（約1.2〜2cm。子どもの指でも押しやすく）
  const r = Math.max(44, Math.min(72, Math.min(winW, winH) * 0.11));
  const margin = 16;
  const y = winH - safe.bottom - margin - r;
  const left = { x: safe.left + 8 + r, y, r };
  const right = { x: left.x + r * 2 + 16, y, r };
  const brakeR = r * 0.8;
  // ブレーキは ◀ ▶ の間の上。傾きのときは ◀ の場所
  const brake = mode === 'tilt'
    ? { x: left.x, y, r: brakeR }
    : { x: (left.x + right.x) / 2, y: y - r - 12 - brakeR, r: brakeR };
  const driftR = r * 1.25;
  const drift = { x: winW - safe.right - margin - driftR, y: winH - safe.bottom - margin - driftR, r: driftR };
  const itemR = r * 0.85;
  const item = { x: drift.x, y: drift.y - driftR - 12 - itemR, r: itemR };
  return { mode, left, right, brake, drift, item, splitX: (left.x + right.x) / 2, winW, winH };
}

function hit(p, b, scale) {
  return Math.hypot(p.x - b.x, p.y - b.y) <= b.r * scale;
}

export function resolveTouches(points, layout) {
  const s = { left: false, right: false, brake: false, drift: false, item: false };
  if (layout.mode === 'keyboard') return s;
  for (const p of points) {
    if (p.x < layout.winW / 2) {
      if (layout.mode === 'tilt') {
        if (hit(p, layout.brake, 1.6)) s.brake = true;
      } else if (hit(p, layout.brake, 1.3)) {
        s.brake = true;
      } else if (p.y > layout.brake.y + layout.brake.r) {
        // ◀ ▶ の段は、指をすべらせても左右が切り替わるよう、真ん中で分ける
        if (p.x < layout.splitX) s.left = true;
        else s.right = true;
      }
    } else if (hit(p, layout.item, 1.3)) {
      s.item = true;
    } else if (p.y > layout.winH * 0.35) {
      s.drift = true;
    }
  }
  return s;
}

// 傾きセンサー（重力をふくむ加速度、端末の向きの x・y）から steer を求める
// screenAngle は画面の回転（0 / 90 / 180 / 270）。invert は符号が逆に出る端末（iPhone）用
// 画面の中での重力の向きから回した角度を求めるので、端末を後ろに寝かせて持っても同じだけ曲がる
// 子どもは大きく傾けるので、あそびを広く、ハンドルいっぱいになる角度を深くする
export const TILT_DEAD = 6; // これより小さい傾きは0（度）
export const TILT_FULL = 45; // この傾きでハンドルいっぱい（度）
export const TILT_FLAT = 2; // 画面の中の重力がこれより小さい（平らに置いている）ときは0（m/s²）
export function tiltSteer(ax, ay, screenAngle, invert = false) {
  const a = (screenAngle * Math.PI) / 180;
  // 画面の右向き・上向きの成分
  let sx = ax * Math.cos(a) - ay * Math.sin(a);
  let sy = ax * Math.sin(a) + ay * Math.cos(a);
  if (invert) {
    sx = -sx;
    sy = -sy;
  }
  if (Math.hypot(sx, sy) < TILT_FLAT) return 0;
  const deg = (Math.atan2(-sx, sy) * 180) / Math.PI;
  const mag = Math.abs(deg);
  if (mag < TILT_DEAD) return 0;
  return Math.sign(deg) * Math.min(1, (mag - TILT_DEAD) / (TILT_FULL - TILT_DEAD));
}

export class Controls {
  constructor() {
    this.mode = 'buttons';
    this.touch = resolveTouches([], { mode: 'keyboard' });
    this.points = [];
    this.keys = new Set();
    this.tilt = 0;
    this.steer = 0;
    this.brake = false;
    this.drift = false;
    this.item = false;
    this.itemPressed = false;
    this.prevItem = false;
    // 更新の間に押して離されたアイテムボタンも拾うための記録
    this.itemLatch = false;
  }

  setMode(mode) {
    this.mode = mode;
    this.tilt = 0;
  }

  setTouches(points, layout) {
    const was = this.touch.item;
    this.points = points;
    this.touch = resolveTouches(points, layout);
    if (this.touch.item && !was) this.itemLatch = true;
  }

  // 画面サイズが変わったとき、押している指を新しい配置で判定し直す
  relayout(layout) {
    this.touch = resolveTouches(this.points, layout);
  }

  setTilt(value) {
    this.tilt = value;
  }

  keyDown(code, repeat = false) {
    if (KEYS.item.includes(code) && !repeat) this.itemLatch = true;
    this.keys.add(code);
  }

  keyUp(code) {
    this.keys.delete(code);
  }

  clear() {
    this.touch = resolveTouches([], { mode: 'keyboard' });
    this.points = [];
    this.keys.clear();
    this.itemLatch = false;
  }

  // 更新1回につき1度だけ呼ぶ
  tick() {
    const has = (name) => KEYS[name].some((k) => this.keys.has(k));
    const left = this.touch.left || has('left');
    const right = this.touch.right || has('right');
    const keyOrButton = (right ? 1 : 0) - (left ? 1 : 0);
    this.steer = keyOrButton !== 0 || this.mode !== 'tilt' ? keyOrButton : this.tilt;
    this.brake = this.touch.brake || has('brake');
    this.drift = this.touch.drift || has('drift');
    this.item = this.touch.item || has('item');
    this.itemPressed = (this.item && !this.prevItem) || this.itemLatch;
    this.itemLatch = false;
    this.prevItem = this.item;
  }
}

export function attachControls(controls, target, getLayout) {
  const onTouch = (e) => {
    e.preventDefault();
    const points = Array.from(e.touches, (t) => ({ x: t.clientX, y: t.clientY }));
    controls.setTouches(points, getLayout());
  };
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
    target.addEventListener(type, onTouch, { passive: false });
  }
  window.addEventListener('keydown', (e) => {
    if (HANDLED.has(e.code)) {
      e.preventDefault();
      controls.keyDown(e.code, e.repeat);
    }
  });
  window.addEventListener('keyup', (e) => controls.keyUp(e.code));
  window.addEventListener('blur', () => controls.clear());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) controls.clear();
  });
}

// 傾き操作ができる端末か（タッチと傾きセンサーがある）
export function canTilt() {
  return typeof window !== 'undefined'
    && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)
    && 'DeviceMotionEvent' in window;
}

// iPhone・iPad は許可が必要。ボタンを押したときに呼ぶ。許可されたら true
export async function requestTiltPermission() {
  const DME = window.DeviceMotionEvent;
  if (DME && typeof DME.requestPermission === 'function') {
    try {
      return (await DME.requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }
  return true;
}

function screenAngle() {
  const a = globalThis.screen?.orientation?.angle ?? window.orientation ?? 0;
  return ((a % 360) + 360) % 360;
}

// 画面の上向きの重力の成分（ふつうに持っていれば、上向きは正のはず）
function screenUp(ax, ay, screenAngle) {
  const a = (screenAngle * Math.PI) / 180;
  return ax * Math.sin(a) + ay * Math.cos(a);
}

// 傾きで曲がるようにする。timeoutMs たってもセンサーの値が来なければ onNoSensor を呼ぶ
// （http で開いたとき・センサーがない端末では値が来ないので、ボタン操作に戻すため）
// 重力の向きを反対の符号で出す端末（iPhone や一部の Android）があるので、
// 最初にふつうに持っているときの値で、その端末の符号を決める
export function startTilt(controls, { timeoutMs = 1000, onNoSensor = () => {} } = {}) {
  let got = false;
  let invert = null;
  window.addEventListener('devicemotion', (e) => {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x === null || g.y === null) return;
    got = true;
    const angle = screenAngle();
    if (invert === null) {
      const up = screenUp(g.x, g.y, angle);
      if (Math.abs(up) < TILT_FLAT) return;
      invert = up < 0;
    }
    controls.setTilt(tiltSteer(g.x, g.y, angle, invert));
  });
  setTimeout(() => {
    if (!got) onNoSensor();
  }, timeoutMs);
}
