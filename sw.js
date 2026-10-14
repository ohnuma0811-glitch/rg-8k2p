// ゲームのファイルを端末に取っておく。電波があるときは、いつも新しいファイルを使って取っておき、
// 電波がないときだけ、取っておいたファイルを使う（古い版が残り続けないように）
// ほかのサイト（Google Fonts など）と、GET 以外はさわらない
const CACHE = 'ks-kart-32ad32c'; // 公開のとき scripts/deploy.sh がコミットの番号に置き換える

self.addEventListener('install', () => self.skipWaiting());
// 新しい版になったら、このゲームの古い版の入れ物を消す（同じ GitHub の、ほかのゲームの入れ物は消さない）
self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ks-kart-') && k !== CACHE).map((k) => caches.delete(k))))
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
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req)),
  );
});
