// 待合室のチャット（設計書 docs/superpowers/specs/2026-10-22-lobby-design.md の 3・4章）
import { phrase } from '../chatPhrases.js';

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

// メッセージと、最後に送った時刻を1回で書く（ルールが、1秒たっているかを chatLast でくらべる）
export function sendChat(db, codeId, me, body) {
  const key = db.newKey(`chat/${codeId}`);
  return db.update('', {
    [`chat/${codeId}/${key}`]: { uid: me.uid, name: me.name, char: me.char, ...body, at: db.SERVER_TIME },
    [`chatLast/${me.uid}`]: db.SERVER_TIME,
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
