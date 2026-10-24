// 待合室のチャット（設計書 docs/superpowers/specs/2026-10-22-lobby-design.md の 3・4章）
import { phrase } from '../chatPhrases.js?v=bb0e8ec';

export const CHAT_MAX = 100; // 自由な文の長さ
export const CHAT_SHOW = 50; // 画面に出す件数
export const CHAT_GAP = 1000; // 送る間かく（ミリ秒）
export const CHAT_GAP_PRESET = 2000; // 定型文は2秒に1回（2026-10-22 のユーザー依頼）

export function cleanText(s) {
  const t = String(s ?? '').trim();
  return t.length >= 1 && t.length <= CHAT_MAX ? t : '';
}

export function canSend(lastAt, now, kind = 'text') {
  return lastAt == null || now - lastAt >= (kind === 'preset' ? CHAT_GAP_PRESET : CHAT_GAP);
}

// 同じ定型文を2回続けては送れない（あいだに自由な文があればよい。2026-10-22 のユーザー依頼）
export function samePreset(lastPreset, body) {
  return body.preset != null && body.preset === lastPreset;
}

// メッセージと、最後に送った時刻を1回で書く（ルールが、1秒たっているかを chatLast でくらべる）
export function sendChat(db, codeId, me, body) {
  const key = db.newKey(`chat/${codeId}`);
  return db.update('', {
    [`chat/${codeId}/${key}`]: { uid: me.uid, name: me.name, char: me.char, ...body, at: db.SERVER_TIME },
    [`chatLast/${me.uid}`]: { at: db.SERVER_TIME, key, ...(body.preset != null ? { preset: body.preset } : {}) }, // 定型文の番号も（ルールが、前と同じかをくらべる） // メッセージ1件とだけ結びつく（1回の書き込みに何件も入れられない）
  });
}

export function lastMessages(obj, n = CHAT_SHOW) {
  return Object.entries(obj ?? {})
    .map(([id, m]) => ({ id, ...m }))
    .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1))
    .slice(-n);
}

export function displayText(m, lang) {
  return typeof m.text === 'string' ? m.text : phrase(m.preset, lang);
}

// 新しい文の音。最初の受け取りは覚えるだけ。そのあと、いちばん新しい文の id が変わって、自分以外の文なら鳴らす
export function nextChime(state, msgs, myUid) {
  const last = msgs[msgs.length - 1];
  const lastId = last ? last.id : null;
  const chime = state.loaded && !!last && lastId !== state.lastId && last.uid !== myUid;
  return { chime, state: { loaded: true, lastId } };
}
