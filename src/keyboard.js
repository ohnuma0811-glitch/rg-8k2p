// 画面のキーボード（2026-10-23: Android タブレットで、チャットの入力欄がキーボードに隠れた）。
// Android の Chrome は、キーボードが出ても画面の大きさを変えず、下にかぶせる。かぶった高さだけ #menu の下をあける
const MIN_PX = 40; // これより小さいずれは、キーボードではない（アドレスバーなど）

export function keyboardInset(vv, innerHeight) {
  if (!vv) return 0;
  const px = Math.round(innerHeight - vv.height - vv.offsetTop);
  return px >= MIN_PX ? px : 0;
}

// キーボードの高さを CSS の --kb に入れ続ける
export function watchKeyboard(win = window) {
  const vv = win.visualViewport;
  if (!vv) return;
  const update = () => win.document.documentElement.style.setProperty('--kb', `${keyboardInset(vv, win.innerHeight)}px`);
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  update();
}
