import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lobbyRows, messageRows, voteRows, racingText, canReady } from '../src/lobbyScreen.js';

test('待合室の一覧: 顔・名前・READY、自分の行は me。人数', () => {
  const html = lobbyRows([{ uid: 'u1', name: 'KYUGO', char: 'kyugo', ready: true }, { uid: 'u2', name: 'SOKI', char: 'cat', ready: false }], 'u2');
  assert.ok(html.includes('KYUGO') && html.includes('SOKI'));
  assert.ok(html.includes('2 players'));
  assert.equal((html.match(/class="row me/g) ?? []).length, 1);
  assert.ok(/KYUGO[\s\S]*✓/.test(html));
  assert.ok(html.includes('face-svg'));
});

test('チャットの行: 定型文は読む人の言語、自由な文はそのまま（文字はエスケープ）、自分の文は mine', () => {
  const msgs = [{ id: 'a', uid: 'u1', name: 'KYUGO', char: 'kyugo', preset: 8 }, { id: 'b', uid: 'u2', name: 'SOKI', char: 'cat', text: '<b>やあ</b>' }];
  const ja = messageRows(msgs, 'u2', 'ja');
  assert.ok(ja.includes('いいしょうぶだった！'));
  assert.ok(ja.includes('&lt;b&gt;やあ&lt;/b&gt;'));
  assert.equal((ja.match(/class="msg mine/g) ?? []).length, 1);
  assert.ok(messageRows(msgs, 'u2', 'en').includes('Good game!'));
});

test('投票の行: コースごとに、選んだ人の顔（今の投票の票だけ）', () => {
  const html = voteRows(['Kenta Circuit', 'Kampar Town'], { u1: { voteId: 'v', course: 1 }, u2: { voteId: 'old', course: 0 } }, 'v', [{ uid: 'u1', char: 'tiger' }, { uid: 'u2', char: 'cat' }]);
  assert.ok(html.includes('Kenta Circuit') && html.includes('Kampar Town'));
  assert.equal((html.match(/face-svg/g) ?? []).length, 1);
  assert.ok(/data-course="1"[\s\S]*face-svg/.test(html));
});

test('操作モードは保存しない（待合室の切りかえはこの回だけ。保存すると、タッチ端末でボタンが消えて戻せなくなる）', async () => {
  const { readFileSync } = await import('node:fs');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(!main.includes("'controlMode'"));
  assert.ok(main.includes("controls.setMode(hasTouch() ? 'buttons' : 'keyboard')"));
});

test('レース中に来た人への知らせ: 今のレースのコースと、走っている人の名前（英語だけ）', () => {
  assert.equal(racingText('Kampar Town', ['KYUGO', 'SOKI']), 'Racing now: Kampar Town — KYUGO, SOKI. Press READY after the race.');
  assert.equal(racingText('Kampar Town', []), 'Racing now: Kampar Town. Press READY after the race.');
});

test('READY を押せるのは、部屋が lobby のときだけ（投票中・決まった・レース中は押せない。レース中に来た人は、レースのあと）', () => {
  assert.equal(canReady(null), true);
  assert.equal(canReady({ phase: 'lobby' }), true);
  for (const phase of ['voting', 'decided', 'racing']) assert.equal(canReady({ phase }), false, phase);
});

test('QUIT でレースから先に戻った人の待合室は、部屋を lobby に戻さない（ほかの人はまだ走っている。2026-10-23 の確かめ）', async () => {
  const fs = await import('node:fs');
  const lobby = fs.readFileSync(new URL('../src/lobbyScreen.js', import.meta.url), 'utf8');
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(lobby.includes("if (after !== 'quit') await resetRoom(db, v.voteId)"), '待合室: QUIT のときは戻さない');
  assert.ok(main.includes("return why === 'quit' ? 'quit' : 'lobby';"), 'main: QUIT を待合室に伝える');
  assert.ok(/if \(why === 'quit'\) \{[\s\S]{0,300}return 'quit';/.test(main), 'runVsRace: QUIT で quit を返す');
});

test('待合室に歯車のボタンはなく、音・操作・言語のボタンはいつも出ている（2026-10-23 のユーザー依頼）', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../src/lobbyScreen.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('data-act="gear"'));
  assert.ok(!src.includes('lb-gear hidden'));
  assert.ok(src.includes('data-act="sound"') && src.includes('data-act="lang"'));
  assert.ok(!src.includes('data-act="controls"'), '操作の切りかえはない（SOLO と同じく自動。2026-10-23 のユーザー依頼）');
});
