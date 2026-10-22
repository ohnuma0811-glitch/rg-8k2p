// Firebase を読み込んでつなぐ（対戦か GM 画面を開いたときだけ。SOLO では読み込まない）
// 読み書きは storeOf(f) の形にまとめる（src/net/gamecode.js などは、この形だけを使う）
import { FIREBASE } from '../config.js';

const VER = '10.14.1';
const BASE = `https://www.gstatic.com/firebasejs/${VER}`;
export const NET_TIMEOUT = 8000; // これより返事がなければ、つながらないとみなす（ミリ秒）

export function firebaseReady(cfg = FIREBASE) {
  return Boolean(cfg.apiKey && cfg.databaseURL && cfg.projectId);
}

export function withTimeout(promise, ms = NET_TIMEOUT) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('timeout'), { offline: true })), ms))]);
}

export function normalizeError(e) {
  if (e && (e.code === 'PERMISSION_DENIED' || /PERMISSION_DENIED/i.test(e.message ?? ''))) e.denied = true;
  if (e && /offline/i.test(e.message ?? '')) e.offline = true; // 'Client is offline.' など
  return e;
}

let ready = null;
export function connect() {
  ready ??= (async () => {
    const [app, auth, db] = await Promise.all([import(`${BASE}/firebase-app.js`), import(`${BASE}/firebase-auth.js`), import(`${BASE}/firebase-database.js`)]);
    const a = app.initializeApp(FIREBASE);
    return { auth: auth.getAuth(a), db: db.getDatabase(a), mods: { auth, db } };
  })();
  ready.catch(() => {
    ready = null; // 読み込めなかったら、次にまた試す
  });
  return ready;
}

export async function signInAnon() {
  const f = await withTimeout(connect());
  if (!f.auth.currentUser) await withTimeout(f.mods.auth.signInAnonymously(f.auth));
  return f.auth.currentUser.uid;
}

// GM の Google ログイン。iPhone・iPad でも、ボタンを押したときのポップアップ（リダイレクトは、第三者ストレージの分離で戻ってこないことがある）
export async function signInGoogle() {
  const f = await connect();
  const provider = new f.mods.auth.GoogleAuthProvider();
  const r = await f.mods.auth.signInWithPopup(f.auth, provider);
  return r.user.uid;
}

// 前の画面の名残。Google でログインしていれば、その uid を返すだけ
export async function gmRedirectResult() {
  const f = await connect();
  return (f.auth.currentUser && !f.auth.currentUser.isAnonymous ? f.auth.currentUser.uid : null);
}

export async function signOut() {
  const f = await connect();
  await f.mods.auth.signOut(f.auth);
}

// 読み書きの形。どれも NET_TIMEOUT で時間切れ（offline）、ルールで断られたら denied
export function storeOf(f) {
  const { ref, get, set, update, remove, runTransaction, onValue } = f.mods.db;
  const r = (path) => (path ? ref(f.db, path) : ref(f.db)); // '' はいちばん上
  const wrap = (p) => withTimeout(p).catch((e) => {
    throw normalizeError(e);
  });
  return {
    get: (path) => wrap(get(r(path)).then((s) => (s.exists() ? s.val() : null))),
    set: (path, value) => wrap(set(r(path), value)),
    update: (path, values) => wrap(update(r(path), values)),
    remove: (path) => wrap(remove(r(path))),
    transaction: (path, fn) => wrap(runTransaction(r(path), fn).then((res) => res.committed)),
    onValue: (path, cb) => onValue(r(path), (s) => cb(s.exists() ? s.val() : null)),
  };
}
