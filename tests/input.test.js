import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeButtonLayout, resolveTouches, tiltSteer, Controls } from '../src/input.js';

const W = 1280;
const H = 800;
const L = computeButtonLayout(W, H);
const T = computeButtonLayout(W, H, undefined, 'tilt');
const K = computeButtonLayout(W, H, undefined, 'keyboard');
const at = (b) => ({ x: b.x, y: b.y });
const near = (a, b, eps = 0.02) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('ボタンは画面の中に収まり、重ならない', () => {
  for (const name of ['left', 'right', 'brake', 'drift', 'item']) {
    const b = L[name];
    assert.ok(b.x - b.r >= 0 && b.x + b.r <= W && b.y - b.r >= 0 && b.y + b.r <= H, name);
  }
  const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r;
  assert.ok(apart(L.left, L.brake) && apart(L.right, L.brake) && apart(L.drift, L.item));
});

test('セーフエリアの分だけボタンが内側に寄る', () => {
  const s = computeButtonLayout(W, H, { left: 40, right: 30, bottom: 20 });
  assert.equal(s.left.x, L.left.x + 40);
  assert.equal(s.drift.x, L.drift.x - 30);
  assert.equal(s.drift.y, L.drift.y - 20);
});

test('◀ ▶ ▼ ドリフト アイテムを押すと、それぞれが効く', () => {
  assert.ok(resolveTouches([at(L.left)], L).left);
  assert.ok(resolveTouches([at(L.right)], L).right);
  assert.ok(resolveTouches([at(L.brake)], L).brake);
  assert.ok(resolveTouches([at(L.drift)], L).drift);
  assert.ok(resolveTouches([at(L.item)], L).item);
});

test('◀ を押したまま指を ▶ へすべらせると、離さなくても右に切り替わる', () => {
  const c = new Controls();
  c.setTouches([at(L.left)], L);
  c.tick();
  assert.equal(c.steer, -1);
  c.setTouches([at(L.right)], L);
  c.tick();
  assert.equal(c.steer, 1);
});

test('ハンドルとドリフトとアイテムを同時に押せる（マルチタッチ）', () => {
  const s = resolveTouches([at(L.right), at(L.drift), at(L.item)], L);
  assert.ok(s.right && s.drift && s.item);
});

test('通知などでタッチが取り消されたら（touchcancel / clear）、押しっぱなしにならない', () => {
  const c = new Controls();
  c.setTouches([at(L.right), at(L.drift)], L);
  c.tick();
  c.clear();
  c.tick();
  assert.equal(c.steer, 0);
  assert.equal(c.drift, false);
});

test('傾き操作のときは ◀ ▶ の場所を押してもハンドルにならず、傾きで曲がる', () => {
  const c = new Controls();
  c.setMode('tilt');
  c.setTilt(0.4);
  c.setTouches([at(L.right)], T);
  c.tick();
  assert.equal(c.steer, 0.4);
  assert.ok(resolveTouches([at(T.brake)], T).brake);
});

test('キーボード: ← → でハンドル、↓ でブレーキ、0 でドリフト、Enter でアイテム', () => {
  const c = new Controls();
  c.setMode('keyboard');
  c.keyDown('ArrowRight');
  c.keyDown('ArrowDown');
  c.keyDown('Digit0');
  c.keyDown('Enter');
  c.tick();
  assert.equal(c.steer, 1);
  assert.ok(c.brake && c.drift && c.item && c.itemPressed);
  c.tick();
  assert.equal(c.itemPressed, false);
  assert.deepEqual(resolveTouches([at(L.drift)], K), { left: false, right: false, brake: false, drift: false, item: false });
});

test('アイテムボタンを更新の間に押して離しても、1回だけ使える', () => {
  const c = new Controls();
  c.setTouches([at(L.item)], L);
  c.setTouches([], L);
  c.tick();
  assert.ok(c.itemPressed);
  c.tick();
  assert.equal(c.itemPressed, false);
});

test('キーを押しっぱなし（くり返し）でもアイテムは1回', () => {
  const c = new Controls();
  c.keyDown('Enter');
  c.tick();
  c.keyDown('Enter', true);
  c.tick();
  assert.equal(c.itemPressed, false);
});

// 横向き（画面の回転90度）で、ハンドルのように時計回りに20度回したときの重力（Android の向き）
const g20 = { ax: 9.81 * Math.cos((20 * Math.PI) / 180), ay: 9.81 * Math.sin((20 * Math.PI) / 180) };

test('傾き: まっすぐ持てば0、時計回りに回すと右、反対は左', () => {
  near(tiltSteer(9.81, 0, 90), 0);
  near(tiltSteer(g20.ax, g20.ay, 90), (20 - 3) / 22);
  near(tiltSteer(g20.ax, -g20.ay, 90), -(20 - 3) / 22);
});

test('傾き: 反対の横向き（270度）でも、時計回りは右', () => {
  near(tiltSteer(-g20.ax, -g20.ay, 270), (20 - 3) / 22);
});

test('傾き: 3度より小さい傾きは0、25度より大きいとハンドルいっぱい', () => {
  const g2 = Math.sin((2 * Math.PI) / 180) * 9.81;
  assert.equal(tiltSteer(9.8, g2, 90), 0);
  assert.equal(tiltSteer(5, 9, 90), 1);
});

test('傾き: 向きが逆に出る端末（iPhone）は invert で同じ向きになる', () => {
  near(tiltSteer(-g20.ax, -g20.ay, 90, true), (20 - 3) / 22);
});
