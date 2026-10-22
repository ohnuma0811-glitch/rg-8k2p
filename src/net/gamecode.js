// GAME CODE（設計書 docs/superpowers/specs/2026-10-22-gamecode-design.md の 3・4章）
// コードはサーバーの /secret にだけあり、遊ぶ人は読めない。入れた数字を /attempts に書き（1回ずつ数える）、
// そのあと /access を書こうとして、書ければ正しい（ルールがくらべる）。db は { get(path), set(path, value) }
export const MAX_TRIES = 5;

// 今の様子: off（コードが出ていない）/ in（入れる）/ locked（5回まちがえた）/ need（コードを入れる。left は残りの回数）
export async function codeState(db, uid) {
  const status = await db.get('status');
  if (!status?.active) return { kind: 'off', left: 0, codeId: status?.codeId ?? null };
  const access = await db.get(`access/${uid}`);
  if (access?.codeId === status.codeId) return { kind: 'in', left: 0, codeId: status.codeId };
  const att = await db.get(`attempts/${uid}`);
  const used = att?.codeId === status.codeId ? att.count : 0;
  if (used >= MAX_TRIES) return { kind: 'locked', left: 0, codeId: status.codeId };
  return { kind: 'need', left: MAX_TRIES - used, codeId: status.codeId };
}

// 4けたを試す。in（入れた）/ wrong（まちがい。left は残り）/ locked / off / offline
export async function tryCode(db, uid, guess, { device, now }) {
  try {
    const st = await codeState(db, uid);
    if (st.kind !== 'need') return { kind: st.kind, left: st.left };
    const count = MAX_TRIES - st.left + 1;
    await db.set(`attempts/${uid}`, { codeId: st.codeId, count, guess, device, at: now });
    try {
      await db.set(`access/${uid}`, { codeId: st.codeId, name: '', at: now });
      return { kind: 'in', left: 0 };
    } catch (e) {
      if (!e.denied) throw e;
      const left = MAX_TRIES - count;
      return { kind: left > 0 ? 'wrong' : 'locked', left };
    }
  } catch (e) {
    if (e.offline) return { kind: 'offline', left: 0 };
    if (e.denied) return { kind: 'off', left: 0 }; // コードが変わった・止まった直後
    throw e;
  }
}

// 入った端末の名前（GM の Players に出る）
export function setName(db, uid, name, now) {
  return db.set(`access/${uid}/name`, name).then(() => db.set(`access/${uid}/at`, now).catch(() => {}));
}

export function deviceKind(ua = '') {
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  return 'PC';
}
