import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_TRIES, codeState, tryCode, setName, deviceKind } from '../src/net/gamecode.js';

// メモリのサーバー（database.rules.json と同じ決まりで断る）
function fakeDb({ code = '0811', codeId = 'c1', active = true } = {}) {
  const data = { secret: { code, codeId, active }, status: { codeId, active }, attempts: {}, access: {} };
  const denied = () => Object.assign(new Error('PERMISSION_DENIED'), { denied: true });
  const at = (path) => path.split('/').reduce((o, k) => (o == null ? undefined : o[k]), data);
  return {
    data,
    offline: false,
    async get(path) {
      if (this.offline) throw Object.assign(new Error('offline'), { offline: true });
      if (path.startsWith('secret')) throw denied();
      return structuredClone(at(path) ?? null);
    },
    async set(path, value) {
      if (this.offline) throw Object.assign(new Error('offline'), { offline: true });
      const [top, uid, key] = path.split('/');
      if (top === 'attempts') {
        const old = data.attempts[uid];
        const same = old && old.codeId === value.codeId;
        if (value.codeId !== data.secret.codeId || value.count !== (same ? old.count + 1 : 1) || value.count > MAX_TRIES) throw denied();
        data.attempts[uid] = value;
        return;
      }
      if (top === 'access') {
        const a = data.attempts[uid];
        const ok = data.secret.active && a && a.guess === data.secret.code && a.codeId === data.secret.codeId;
        if (key === 'name') {
          if (!ok || !data.access[uid]) throw denied();
          data.access[uid].name = value;
          return;
        }
        if (!ok || value.codeId !== data.secret.codeId) throw denied();
        data.access[uid] = value;
        return;
      }
      throw denied();
    },
  };
}
const opt = { device: 'PC', now: 1000 };

test('正しいコードを入れると入れる。一度入った端末は、もう聞かれない', async () => {
  const db = fakeDb();
  assert.deepEqual(await codeState(db, 'u1'), { kind: 'need', left: 5, codeId: 'c1' });
  assert.equal((await tryCode(db, 'u1', '0811', opt)).kind, 'in');
  assert.equal((await codeState(db, 'u1')).kind, 'in');
});

test('まちがえると残りの回数。5回まちがえると locked（そのコードの間は試せない）', async () => {
  const db = fakeDb();
  for (let n = 1; n <= 4; n++) assert.deepEqual(await tryCode(db, 'u1', '1111', opt), { kind: 'wrong', left: 5 - n });
  assert.deepEqual(await tryCode(db, 'u1', '2222', opt), { kind: 'locked', left: 0 });
  assert.equal((await codeState(db, 'u1')).kind, 'locked');
  assert.equal((await tryCode(db, 'u1', '0811', opt)).kind, 'locked', '正しくても試せない');
});

test('コードが変わったら、もう一度入れる（前のコードで入った端末も。まちがいの回数も数え直し）', async () => {
  const db = fakeDb();
  await tryCode(db, 'u1', '0811', opt);
  for (let n = 0; n < 5; n++) await tryCode(db, 'u2', '9999', opt);
  Object.assign(db.data.secret, { code: '4321', codeId: 'c2' });
  Object.assign(db.data.status, { codeId: 'c2' });
  assert.deepEqual(await codeState(db, 'u1'), { kind: 'need', left: 5, codeId: 'c2' });
  assert.deepEqual(await codeState(db, 'u2'), { kind: 'need', left: 5, codeId: 'c2' });
  assert.equal((await tryCode(db, 'u1', '4321', opt)).kind, 'in');
});

test('コードが出ていない（Stop）ときは off', async () => {
  const db = fakeDb({ active: false });
  assert.equal((await codeState(db, 'u1')).kind, 'off');
  assert.equal((await tryCode(db, 'u1', '0811', opt)).kind, 'off');
});

test('つながらないときは offline（固まらない）', async () => {
  const db = fakeDb();
  db.offline = true;
  assert.equal((await tryCode(db, 'u1', '0811', opt)).kind, 'offline');
});

test('入った端末は、あとから名前を書ける', async () => {
  const db = fakeDb();
  await tryCode(db, 'u1', '0811', opt);
  await setName(db, 'u1', 'KYUGO', 2000);
  assert.equal(db.data.access.u1.name, 'KYUGO');
});

test('端末の種類', () => {
  assert.equal(deviceKind('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)'), 'iPhone');
  assert.equal(deviceKind('Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X)'), 'iPad');
  assert.equal(deviceKind('Mozilla/5.0 (Linux; Android 12; SM-T220)'), 'Android');
  assert.equal(deviceKind('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'PC');
});
