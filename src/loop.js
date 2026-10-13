// 60Hz 固定タイムステップ。描画が遅れてもゲームの速さは変えない
export const STEP = 1 / 60;

export function advance(acc, dt, step, maxSteps = 5) {
  acc += Math.min(Math.max(dt, 0), step * maxSteps);
  const steps = Math.floor(acc / step + 1e-9);
  acc = Math.max(0, acc - steps * step);
  return { steps, acc };
}

export function startLoop({ update, render, step = STEP }) {
  let last = null;
  let acc = 0;
  let running = true;
  function frame(t) {
    if (!running) return;
    const now = t / 1000;
    const dt = last === null ? 0 : now - last;
    last = now;
    const r = advance(acc, dt, step);
    acc = r.acc;
    for (let i = 0; i < r.steps; i++) update(step);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { stop() { running = false; } };
}
