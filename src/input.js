// タッチボタン・キーボードを、steer（-1〜1、右が正）/ brake / drift / item にまとめる
const KEYS = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  brake: ['ArrowDown'],
  drift: ['Digit0', 'Numpad0'],
  item: ['Enter', 'NumpadEnter'],
};
const HANDLED = new Set(Object.values(KEYS).flat());

// mode: 'buttons'（ボタンを出す）/ 'keyboard'（ボタンを出さない。パソコン）
export function computeButtonLayout(winW, winH, safe = { left: 0, right: 0, bottom: 0 }, mode = 'buttons') {
  // 半径は画面の短い辺の11%、44〜72px（約1.2〜2cm。子どもの指でも押しやすく）
  const r = Math.max(44, Math.min(72, Math.min(winW, winH) * 0.11));
  const margin = 16;
  const y = winH - safe.bottom - margin - r;
  const left = { x: safe.left + 8 + r, y, r };
  const right = { x: left.x + r * 2 + 16, y, r };
  const brakeR = r * 0.8;
  // ブレーキは ◀ ▶ の間の上
  const brake = { x: (left.x + right.x) / 2, y: y - r - 12 - brakeR, r: brakeR };
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
      if (hit(p, layout.brake, 1.3)) {
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

export class Controls {
  constructor() {
    this.mode = 'buttons';
    this.touch = resolveTouches([], { mode: 'keyboard' });
    this.points = [];
    this.keys = new Set();
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
    this.steer = (right ? 1 : 0) - (left ? 1 : 0);
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

// タッチできる端末か（できなければパソコンとして、キーボードで操作する）
export function hasTouch() {
  return navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
}
