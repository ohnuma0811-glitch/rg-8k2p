// 操作の選択（ボタン / 傾き）。パソコンでは出さずに 'keyboard'
import { canTilt, requestTiltPermission } from '../input.js';

export async function chooseControls(root, previous) {
  if (!canTilt()) return 'keyboard';
  return new Promise((resolve) => {
    root.innerHTML = `
      <div class="panel">
        <h1>How do you steer?</h1>
        <div class="choices">
          <button type="button" data-mode="buttons"><span class="icon">◀ ▶</span>BUTTONS</button>
          <button type="button" data-mode="tilt"><span class="icon">📱↻</span>TILT</button>
        </div>
        <p class="note"></p>
      </div>`;
    root.classList.add('show');
    const note = root.querySelector('.note');
    for (const b of root.querySelectorAll('button')) {
      if (b.dataset.mode === previous) b.classList.add('selected');
      b.addEventListener('click', async () => {
        let mode = b.dataset.mode;
        // iPhone は、ボタンを押したときにしか傾きの許可を求められない
        if (mode === 'tilt' && !(await requestTiltPermission())) {
          note.textContent = 'Tilt is not allowed. Using BUTTONS.';
          mode = 'buttons';
          await new Promise((r) => setTimeout(r, 1500));
        }
        root.classList.remove('show');
        root.innerHTML = '';
        resolve(mode);
      });
    }
  });
}
