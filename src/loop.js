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
    // 描くときに、前の計算から何割進んだか（0〜1）と、前に描いてからの秒数を渡す
    // （カメラも、車と同じ画面の書きかえの時刻で動かす。別の時計で測ると、車が小刻みにぶれて見えた。2026-10-19）
    render(acc / step, dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { stop() { running = false; } };
}
