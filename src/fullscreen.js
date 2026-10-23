// 全画面（2026-10-23: POCO X7 で、ホーム画面に入れたアイコンから立ち上がらなかった）。
// インストールしなくても、Chrome のアドレスバーと下のボタンを消して、画面いっぱいで遊べるように

// 出すのは、ブラウザが全画面にできて、まだアプリとして（ホーム画面から）開いていないとき。iPhone の Safari はできないので出ない
export function canFullscreen(win) {
  if (!win?.document?.fullscreenEnabled) return false;
  const app = ['fullscreen', 'standalone'].some((m) => win.matchMedia?.(`(display-mode: ${m})`).matches);
  return !app;
}

// 押すたびに、全画面にする・戻す。全画面にしたら横向きに固定する（できない端末もある）。断られても止まらない
export async function toggleFullscreen(win) {
  const doc = win.document;
  try {
    if (doc.fullscreenElement) {
      await doc.exitFullscreen();
      return;
    }
    await doc.documentElement.requestFullscreen({ navigationUI: 'hide' });
    await win.screen?.orientation?.lock?.('landscape');
  } catch {
    // 全画面や向きの固定ができなくても、そのまま遊べる
  }
}
