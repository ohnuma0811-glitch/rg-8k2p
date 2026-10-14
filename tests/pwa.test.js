import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url));

// PNG の幅と高さ（ファイルの頭の IHDR に書いてある）
function pngSize(buf) {
  assert.equal(buf.toString('ascii', 1, 4), 'PNG');
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

test('manifest: 名前、全画面・横向き、アイコン 192 と 512（丸く切り抜かれても大丈夫なものも）', () => {
  const m = JSON.parse(read('manifest.json'));
  assert.equal(m.name, 'Super Kyugo & Soki Kart');
  assert.equal(m.display, 'fullscreen');
  assert.equal(m.orientation, 'landscape');
  assert.equal(m.start_url, './');
  for (const icon of m.icons) {
    const [w, h] = pngSize(read(icon.src));
    assert.equal(`${w}x${h}`, icon.sizes, icon.src);
  }
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
});

test('iPhone 用のアイコンは 180×180', () => {
  assert.deepEqual(pngSize(read('icons/apple-touch-icon.png')), [180, 180]);
});

test('index.html が manifest と iPhone 用のアイコンを読む', () => {
  const html = read('index.html').toString();
  assert.match(html, /<link rel="manifest" href="manifest.json">/);
  assert.match(html, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon.png">/);
});

test('公開のとき、manifest・sw・アイコンも載せ、sw の版を付ける', () => {
  const sh = read('scripts/deploy.sh').toString();
  for (const f of ['manifest.json', 'sw.js', 'icons']) assert.ok(sh.includes(f), f);
  assert.match(sh, /ks-kart-dev/);
});

// sw.js を、ブラウザのかわりの物の中で動かす
function loadSw({ online, status = 200 }) {
  const handlers = {};
  const cache = new Map();
  const self = { addEventListener: (type, fn) => (handlers[type] = fn), skipWaiting() {}, clients: { claim() {} } };
  const caches = {
    open: async () => ({ put: async (req, res) => cache.set(req.url, res) }),
    match: async (req) => cache.get(req.url),
  };
  const fetch = async (req) => {
    if (!online) throw new Error('offline');
    return { ok: status >= 200 && status < 300, status, body: `new ${req.url}`, clone() { return this; } };
  };
  const location = { origin: 'https://example.com' };
  new Function('self', 'caches', 'fetch', 'location', read('sw.js').toString())(self, caches, fetch, location);
  const respond = async (url, method = 'GET') => {
    let p = null;
    handlers.fetch({ request: { url, method }, respondWith: (x) => (p = x) });
    return p && (await p);
  };
  return { respond, cache };
}

test('sw: 電波があれば、いつも新しいファイルを使い、取っておく', async () => {
  const sw = loadSw({ online: true });
  const res = await sw.respond('https://example.com/src/main.js?v=abc');
  assert.equal(res.body, 'new https://example.com/src/main.js?v=abc');
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(sw.cache.has('https://example.com/src/main.js?v=abc'));
});

test('sw: 電波がなければ、取っておいたファイルを使う。ほかのサイト（Google Fonts など）と GET 以外はさわらない', async () => {
  const sw = loadSw({ online: false });
  sw.cache.set('https://example.com/index.html', { body: 'old' });
  assert.equal((await sw.respond('https://example.com/index.html')).body, 'old');
  assert.equal(await sw.respond('https://fonts.googleapis.com/css2'), null);
  assert.equal(await sw.respond('https://example.com/x', 'POST'), null);
});

test('sw: サーバーがエラー（503 など）を返したら、取っておいたファイルを使い、エラーは取っておかない（2026-10-15 の公開で 503 が出た）', async () => {
  const sw = loadSw({ online: true, status: 503 });
  sw.cache.set('https://example.com/src/game/race.js?v=abc', { body: 'old', ok: true });
  assert.equal((await sw.respond('https://example.com/src/game/race.js?v=abc')).body, 'old');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(sw.cache.get('https://example.com/src/game/race.js?v=abc').body, 'old', 'エラーで上書きしない');
  // 取っておいたものがなければ、エラーをそのまま返す
  assert.equal((await sw.respond('https://example.com/new.js')).status, 503);
});

test('sw: 新しい版になったら、このゲームの古い版の取っておいたファイルを消す。ほかのゲーム（同じ GitHub の 09 のゲーム）のものは消さない', async () => {
  const handlers = {};
  const names = new Set(['ks-kart-old1', 'ks-kart-dev', 'ks-c90d32a', 'ks-kart-old2']);
  const self = { addEventListener: (type, fn) => (handlers[type] = fn), skipWaiting() {}, clients: { claim: async () => {} } };
  const caches = { keys: async () => [...names], delete: async (k) => names.delete(k) };
  new Function('self', 'caches', 'fetch', 'location', read('sw.js').toString())(self, caches, null, { origin: 'https://example.com' });
  let done = null;
  handlers.activate({ waitUntil: (p) => (done = p) });
  await done;
  assert.deepEqual([...names].sort(), ['ks-c90d32a', 'ks-kart-dev']);
});
