// ゲームマスター（KENTA）の画面（URL の後ろに #gm。設計書 docs/superpowers/specs/2026-10-22-gamecode-design.md の 5章）
// 縦に並べる: Code（数字ボタンで4けた → Set、Stop）、Players、Locked（Unlock）、Play time（Reset）、Daily limit
import { connect, signInGoogle, gmRedirectResult, signOut, storeOf, firebaseReady } from './net/firebase.js';
import { dayKey, LIMITED_NAMES, DEFAULT_LIMIT_MIN } from './playtime.js';

export function newCodeId(now, rand = Math.random) {
  return `${now.toString(36)}${Math.floor(rand() * 1e8).toString(36)}`;
}
export function setCodeUpdates(code, codeId) {
  if (!/^[0-9]{4}$/.test(code)) throw new Error('4けたの数字');
  return { secret: { code, codeId, active: true }, status: { codeId, active: true } };
}
export function stopUpdates(codeId) {
  return { 'secret/active': false, status: { codeId, active: false } };
}
export function playersOf(access, codeId) {
  return Object.values(access ?? {}).filter((a) => a.codeId === codeId && a.name).sort((a, b) => b.at - a.at).map(({ name, at }) => ({ name, at }));
}
export function lockedOf(attempts, codeId) {
  return Object.entries(attempts ?? {}).filter(([, a]) => a.codeId === codeId && a.count >= 5).map(([uid, a]) => ({ uid, device: a.device, at: a.at }));
}
// その日の遊んだ秒: 端末ごとの数字（/playtime/{名前}/{日付}/{uid}）の合計。reset（リセットの時刻）は数えない
export function playedSec(node) {
  if (!node || typeof node !== 'object') return 0;
  return Object.entries(node).reduce((sum, [k, v]) => (k !== 'reset' && typeof v === 'number' ? sum + v : sum), 0);
}
// Reset: その日のまとまりを { reset: 今 } にする（各端末の数字は消え、端末は reset の時刻を見て自分の分を0にする）
export function resetValue(now) {
  return { reset: now };
}
export function clampLimit(min) {
  return Math.max(5, Math.min(120, min));
}

const time = (ms) => new Date(ms).toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export async function gmScreen(root) {
  root.classList.add('show', 'gm');
  root.innerHTML = '<div class="panel gm-panel"><h1>Game Master</h1><p class="note">...</p></div>';
  const panel = root.querySelector('.gm-panel');
  if (!firebaseReady()) {
    panel.innerHTML = '<h1>Game Master</h1><p class="note">Not set up yet</p>'; // Firebase の設定がまだ空（docs/firebase-setup.md）
    return;
  }
  let uid = await gmRedirectResult().catch(() => null);
  if (!uid) {
    panel.innerHTML = '<h1>Game Master</h1><div class="choices"><button type="button" class="gm-signin">Sign in with Google</button></div>';
    await new Promise((resolve) => panel.querySelector('.gm-signin').addEventListener('click', resolve, { once: true }));
    uid = await signInGoogle();
    if (!uid) return; // iPhone: Google の画面へ移る（戻ってきたら gmRedirectResult）
  }
  const db = storeOf(await connect());
  try {
    await db.get('secret');
  } catch {
    panel.innerHTML = `<h1>Not the Game Master</h1><p class="note">Your user ID:</p><p class="gm-uid">${esc(uid)}</p><div class="choices"><button type="button" class="gm-out">Sign out</button></div>`;
    panel.querySelector('.gm-out').onclick = () => signOut().then(() => location.reload());
    return;
  }
  let digits = '';
  const draw = async () => {
    const [secret, access, attempts, ...rest] = await Promise.all([
      db.get('secret'), db.get('access'), db.get('attempts'),
      ...LIMITED_NAMES.flatMap((n) => [db.get(`playtime/${n}/${dayKey(Date.now())}`), db.get(`limits/${n}`)]),
    ]);
    const codeId = secret?.codeId ?? null;
    const players = playersOf(access, codeId);
    const locked = lockedOf(attempts, codeId);
    panel.innerHTML = `
      <h1>Game Master</h1>
      <section><h2>Code</h2>
        <p class="gm-code">${secret ? `${esc(secret.code)} · ${secret.active ? 'ON' : 'OFF'}` : 'No code'}</p>
        <p class="gm-new">${digits.padEnd(4, '·')}</p>
        <div class="code-pad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'set'].map((k) => `<button type="button" data-key="${k}">${k === 'del' ? '⌫' : k === 'set' ? 'Set' : k}</button>`).join('')}</div>
        <div class="choices"><button type="button" data-act="stop">Stop</button></div></section>
      <section><h2>Players</h2>${players.map((p) => `<p>${esc(p.name)} · ${time(p.at)}</p>`).join('') || '<p class="note">No one yet</p>'}</section>
      <section><h2>Locked</h2>${locked.map((l) => `<p>${esc(l.device)} · ${time(l.at)} <button type="button" data-unlock="${esc(l.uid)}">Unlock</button></p>`).join('') || '<p class="note">None</p>'}</section>
      <section><h2>Play time (today)</h2>${LIMITED_NAMES.map((n, i) => `<p>${n}: ${Math.floor(playedSec(rest[i * 2]) / 60)}m ${Math.round(playedSec(rest[i * 2]) % 60)}s <button type="button" data-reset="${n}">Reset</button></p>`).join('')}</section>
      <section><h2>Daily limit</h2>${LIMITED_NAMES.map((n, i) => `<p>${n}: ${rest[i * 2 + 1] ?? DEFAULT_LIMIT_MIN} min <button type="button" data-limit="${n}" data-d="-5">−5</button> <button type="button" data-limit="${n}" data-d="5">+5</button></p>`).join('')}</section>`;
    panel.onclick = async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.key) {
        const k = b.dataset.key;
        if (k === 'del') digits = digits.slice(0, -1);
        else if (k === 'set') {
          if (digits.length !== 4) return;
          await db.update('', setCodeUpdates(digits, newCodeId(Date.now())));
          digits = '';
        } else if (digits.length < 4) digits += k;
      } else if (b.dataset.act === 'stop' && codeId) await db.update('', stopUpdates(codeId));
      else if (b.dataset.unlock) await db.remove(`attempts/${b.dataset.unlock}`);
      else if (b.dataset.reset) await db.set(`playtime/${b.dataset.reset}/${dayKey(Date.now())}`, resetValue(Date.now()));
      else if (b.dataset.limit) {
        const n = b.dataset.limit;
        const cur = (await db.get(`limits/${n}`)) ?? DEFAULT_LIMIT_MIN;
        await db.set(`limits/${n}`, clampLimit(cur + Number(b.dataset.d)));
      }
      draw();
    };
  };
  await draw();
}
