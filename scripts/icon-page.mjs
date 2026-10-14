// ホーム画面のアイコンの HTML を作る: 青い地に Kyugo と Soki の顔、下に「KART」の札
// 使い方: node scripts/icon-page.mjs > icon.html（scripts/make-icons.sh が使う）
import { faceSvg } from '../src/titleArt.js';

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
html, body { margin: 0; width: 100vw; height: 100vh; overflow: hidden; }
body { background: radial-gradient(circle at 50% 40%, #3a6fe0, #1c3c88 70%); display: grid; place-items: center; }
.box { width: 70vw; height: 70vw; display: grid; grid-template-rows: 1fr auto; place-items: center; }
.faces { display: flex; gap: 2vw; }
.face { width: 31vw; height: 31vw; border-radius: 50%; border: 1.6vw solid #fff; overflow: hidden; display: grid; }
.face.k { background: #c11f0a; } .face.s { background: #2a62c9; }
.face svg { width: 100%; height: 100%; }
.kart { margin-top: 3vw; padding: 1vw 5vw; border: 1.4vw solid #fff; border-radius: 4vw; background: #c11f0a; color: #fff;
  font: italic 900 13vw/1 system-ui, sans-serif; letter-spacing: 1vw; }
</style></head><body><div class="box">
<div class="faces"><div class="face k">${faceSvg('kyugo')}</div><div class="face s">${faceSvg('soki')}</div></div>
<div class="kart">KART</div></div></body></html>`;
process.stdout.write(html);
