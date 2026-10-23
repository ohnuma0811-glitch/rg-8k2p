// ゲームのファイルを端末に取っておく。電波があるときは、いつも新しいファイルを使って取っておき、
// 電波がないときだけ、取っておいたファイルを使う（古い版が残り続けないように）
// ほかのサイト（Google Fonts など）と、GET 以外はさわらない
const VERSION = 'cdf967c'; // 公開のとき scripts/deploy.sh がコミットの番号に置き換える
// 入れ物は1つ（版ごとに分けると、古い sw が取っておいた新しい版のファイルを、新しい sw が入れ物ごと消していた）。
// 名前は ks- で始めない（同じ GitHub の 09 のゲームの sw が、ks- で始まる入れ物を消すため）。M5 のレビュー
const CACHE = 'kart';

self.addEventListener('install', () => self.skipWaiting());
// 新しい版になったら、入れ物の中の、ほかの版（?v= がちがう）のファイルを消す。前の作り方の入れ物（ks-kart-）も消す
// 版の付いていないファイル（index.html・アイコン・声）は、電波があればいつも新しくなるので消さない
self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ks-kart-')).map((k) => caches.delete(k))))
      .then(() => caches.open(CACHE))
      .then((c) =>
        c.keys().then((reqs) =>
          Promise.all(
            reqs.filter((r) => {
              const v = new URL(r.url).searchParams.get('v');
              return v !== null && v !== VERSION;
            }).map((r) => c.delete(r)),
          ),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(location.origin)) return;
  e.respondWith(
    fetch(req)
      .then(async (res) => {
        // サーバーがエラー（503 など）を返したときは取っておかず、取っておいたものがあればそれを使う
        if (!res.ok) return (await caches.match(req)) || res;
        const copy = res.clone();
        // 取っておくのが終わるまで、ブラウザに sw を止めさせない
        e.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)));
        return res;
      })
      .catch(() => caches.match(req)),
  );
});
