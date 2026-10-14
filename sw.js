// ゲームのファイルを端末に取っておく。電波があるときは、いつも新しいファイルを使って取っておき、
// 電波がないときだけ、取っておいたファイルを使う（古い版が残り続けないように）
// ほかのサイト（Google Fonts など）と、GET 以外はさわらない
const CACHE = 'ks-kart-3e06cdf'; // 公開のとき scripts/deploy.sh がコミットの番号に置き換える

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil && e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(location.origin)) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req)),
  );
});
