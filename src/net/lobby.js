// 待合室（設計書 docs/superpowers/specs/2026-10-22-lobby-design.md の 3章）。/lobby/{uid} = { name, char, codeId, ready, at }
// だれもいない待合室に最初に入る人が、チャットを消して部屋を lobby に戻す（全員が出たら消えるのと同じ見え方。2026-10-22 のユーザー依頼）

export async function enterLobby(db, me) {
  const lobby = await db.get('lobby');
  if (!lobby) {
    await db.remove(`chat/${me.codeId}`).catch(() => {});
    await db.set('room', { phase: 'lobby' }).catch(() => {});
  }
  await db.onDisconnectRemove(`lobby/${me.uid}`); // アプリを閉じた・電波が切れたら、サーバーが消す
  await db.set(`lobby/${me.uid}`, { name: me.name, char: me.char, codeId: me.codeId, ready: false, at: db.SERVER_TIME });
}

// 電波がもどったとき（スマホを裏にした・ほかのアプリで通話した など）。切れたときにサーバーが自分の行を消しているので、
// 行を書き直し、削除の予約もかけ直す。チャットと部屋はさわらない（2026-10-22 READY が黄色にならなかった不具合）
export async function rejoinLobby(db, me) {
  await db.onDisconnectRemove(`lobby/${me.uid}`);
  await db.set(`lobby/${me.uid}`, { name: me.name, char: me.char, codeId: me.codeId, ready: false, at: db.SERVER_TIME });
}

// 出る。アプリを閉じたときの自動の削除も取り消す（あとで電波がもどったとき、入り直した新しい行を消さないように）
export async function leaveLobby(db, uid) {
  const cancel = db.cancelOnDisconnect ? db.cancelOnDisconnect(`lobby/${uid}`).catch(() => {}) : null;
  await db.remove(`lobby/${uid}`);
  await cancel;
}

export function setReady(db, uid, ready) {
  return db.set(`lobby/${uid}/ready`, ready);
}

export function setChar(db, uid, char) {
  return db.set(`lobby/${uid}/char`, char);
}

export function playersOf(lobby) {
  return Object.entries(lobby ?? {})
    .map(([uid, p]) => ({ uid, ...p }))
    .sort((a, b) => a.at - b.at || (a.uid < b.uid ? -1 : 1));
}
