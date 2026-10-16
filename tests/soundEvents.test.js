import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soundState, soundEvents } from '../src/audio/events.js';
import { newBumps } from '../src/game/collide.js';

const kart = (o = {}) => ({ drift: { active: false, stage: 0 }, boost: 0, airborne: false, onWall: false, ...o });
const st = (o = {}, k = {}) => soundState({ count: '', lap: 0, finished: false, bumps: 0, ...o, kart: kart(k) });

test('はじめの1回は何も鳴らさない', () => {
  assert.deepEqual(soundEvents(null, st(), 3), []);
});

test('カウント: 3・2・1 でポーン、GO! でプォーン', () => {
  assert.deepEqual(soundEvents(st({ count: '' }), st({ count: '3' }), 3), ['count']);
  assert.deepEqual(soundEvents(st({ count: '1' }), st({ count: 'GO!' }), 3), ['go']);
  assert.deepEqual(soundEvents(st({ count: 'GO!' }), st({ count: '' }), 3), []);
});

test('周回: 1周目の終わりは lap、最後の周に入るときは finalLap、ゴールは finish だけ', () => {
  assert.deepEqual(soundEvents(st({ lap: 0 }), st({ lap: 1 }), 3), ['lap']);
  assert.deepEqual(soundEvents(st({ lap: 1 }), st({ lap: 2 }), 3), ['finalLap']);
  assert.deepEqual(soundEvents(st({ lap: 2 }), st({ lap: 3, finished: true }), 3), ['finish']);
});

test('ドリフト: 始まり・火花の色が変わる・終わり。ミニターボで加速の音', () => {
  assert.deepEqual(soundEvents(st(), st({}, { drift: { active: true, stage: 0 } }), 3), ['driftStart']);
  assert.deepEqual(soundEvents(st({}, { drift: { active: true, stage: 0 } }), st({}, { drift: { active: true, stage: 1 } }), 3), ['spark']);
  assert.deepEqual(
    soundEvents(st({}, { drift: { active: true, stage: 2 } }), st({}, { boost: 1.2 }), 3),
    ['driftEnd', 'boost'],
  );
});

test('空中ではドリフトの音を鳴らさない。着地で音', () => {
  const air = st({}, { drift: { active: true, stage: 0 }, airborne: true });
  assert.equal(air.drift, false);
  assert.deepEqual(soundEvents(st({}, { airborne: true }), st(), 3), ['land']);
});

test('壁にぶつかった最初の1回と、車どうしで新しくぶつかったとき', () => {
  assert.deepEqual(soundEvents(st(), st({}, { onWall: true }), 3), ['wall']);
  assert.deepEqual(soundEvents(st({}, { onWall: true }), st({}, { onWall: true }), 3), []);
  assert.deepEqual(soundEvents(st({ bumps: 1 }), st({ bumps: 2 }), 3), ['bump']);
});

test('同じ様子のまま（一時停止中など）は、何も鳴らさない', () => {
  const s = st({ count: '', lap: 1 }, { drift: { active: true, stage: 2 }, boost: 1, onWall: true });
  assert.deepEqual(soundEvents(s, s, 3), []);
});

test('自分（k 番）が新しくぶつかった数を数える', () => {
  const prev = new Set(['0-4']);
  const now = new Set(['0-4', '3-4', '1-2']);
  assert.equal(newBumps(prev, now, 4), 1);
  assert.equal(newBumps(prev, now, 1), 1);
  assert.equal(newBumps(prev, now, 0), 0);
});

test('ゴールの音: 1〜3位は明るいファンファーレと勝利の曲、4位以下はちょっと悲しいファンファーレと別の曲（2026-10-15 のユーザー依頼）', async () => {
  const { finishMusic } = await import('../src/audio/events.js');
  for (const place of [1, 2, 3]) assert.deepEqual(finishMusic(place), { sfx: 'finish', song: 'victory' });
  for (const place of [4, 5, 8]) assert.deepEqual(finishMusic(place), { sfx: 'finishSad', song: 'consolation' });
  const { SONGS } = await import('../src/audio/songs.js');
  assert.ok(SONGS.consolation, '4位以下の曲');
});

test('ドリフトのボタンで跳ねたとき「ピヨン」（hop）。跳ねている間はくり返さない（2026-10-15 のユーザー依頼）', () => {
  assert.deepEqual(soundEvents(st(), st({}, { hop: 0.2 }), 3), ['hop']);
  assert.deepEqual(soundEvents(st({}, { hop: 0.2 }), st({}, { hop: 0.1 }), 3), []);
  assert.deepEqual(soundEvents(st({}, { hop: 0.1 }), st({}, { hop: 0 }), 3), []);
});

test('ジャンプの着地の音は、地面に着く少し前（0.08秒前）に鳴らし始める（音が遅れて聞こえないように。2026-10-15 の実機確認）', async () => {
  const { LAND_LEAD } = await import('../src/audio/events.js');
  assert.equal(LAND_LEAD, 0.08);
  // 高さ 2m、下へ 10m/s → 着くまで 0.2秒: まだ鳴らさない
  const high = st({}, { airborne: true, y: 2, vy: -10 });
  assert.deepEqual(soundEvents(st({}, { airborne: true, y: 3, vy: -9 }), high, 3), []);
  // 高さ 0.6m、下へ 10m/s → 着くまで 0.06秒: 鳴らす
  const soon = st({}, { airborne: true, y: 0.6, vy: -10 });
  assert.deepEqual(soundEvents(high, soon, 3), ['land']);
  // 実際に着いたときは、もう一度は鳴らさない
  assert.deepEqual(soundEvents(soon, st({}, { airborne: false, y: 0, vy: 0 }), 3), []);
  // 上へ飛んでいる間は鳴らさない
  assert.deepEqual(soundEvents(st({}, { airborne: true, y: 0.2, vy: 5 }), st({}, { airborne: true, y: 0.3, vy: 4 }), 3), []);
  // 「もうすぐ」が分からないまま着いたときは、着いたときに鳴らす
  assert.deepEqual(soundEvents(st({}, { airborne: true, y: 0.5, vy: 0 }), st({}, { airborne: false, y: 0, vy: 0 }), 3), ['land']);
});

test('壁の音は、ぶつかった最初だけ。壁にこすりながら走って、ついたり離れたりしても鳴らし続けない（2026-10-15 の実機確認）', async () => {
  const { WALL_QUIET } = await import('../src/audio/events.js');
  assert.equal(WALL_QUIET, 0.5);
  // しばらく壁から離れていた（wallQuiet 1秒）→ ぶつかった: 鳴らす
  assert.deepEqual(soundEvents(st({ wallQuiet: 1 }), st({ wallQuiet: 0 }, { onWall: true }), 3), ['wall']);
  // こすっている途中で一瞬離れて、またついた（離れていたのは 0.1秒）: 鳴らさない
  assert.deepEqual(soundEvents(st({ wallQuiet: 0.1 }), st({ wallQuiet: 0 }, { onWall: true }), 3), []);
});

test('ジャンプ台から飛び出した瞬間に jump（「イヤッホー！」の声。2026-10-15 のユーザー依頼）。空中にいる間と、ドリフトの跳ねでは鳴らさない', () => {
  assert.deepEqual(soundEvents(st(), st({}, { airborne: true, launched: true, y: 0, vy: 5 }), 3), ['jump']);
  // 坂の頂上でふわっと浮いたとき（ジャンプ台ではない）は叫ばない（2026-10-16 のユーザー依頼「ジャンプ台の時だけ」）
  assert.deepEqual(soundEvents(st(), st({}, { airborne: true, launched: false, y: 3, vy: 1 }), 3), []);
  assert.deepEqual(soundEvents(st({}, { airborne: true, y: 1, vy: 4 }), st({}, { airborne: true, y: 1.3, vy: 3 }), 3), []);
  assert.deepEqual(soundEvents(st(), st({}, { hop: 0.1 }), 3), ['hop']);
});

test('飛び出す少し前（JUMP_LEAD 秒前）に jump。そのまま飛び出しても、もう一度は鳴らさない（2026-10-15 の実機確認「直前くらいに」）', async () => {
  const { JUMP_LEAD, jumpAhead } = await import('../src/audio/events.js');
  const { buildTrack } = await import('../src/game/track.js');
  const { COURSE1 } = await import('../src/data/tracks.js');
  assert.equal(JUMP_LEAD, 0.3);
  const course = buildTrack(COURSE1);
  const n = course.samples.length;
  // 地面がなくなる所の、dist m 手前で、コースの向きに speed m/s で走っている車
  const at = (dist, o = {}) => {
    const s = course.cross.sA + COURSE1.jump.gap.from - dist;
    const i = ((Math.round(s) % n) + n) % n;
    const p = course.samples[i];
    return { x: p.x, z: p.z, seg: i, move: p.h, speed: 40, airborne: false, ...o };
  };
  assert.equal(jumpAhead(course, at(40 * 0.2)), true); // 0.2秒後に飛び出す
  assert.equal(jumpAhead(course, at(40 * 0.6)), false); // まだ 0.6秒ある
  assert.equal(jumpAhead(course, at(40 * 0.2, { airborne: true })), false);
  assert.equal(jumpAhead(course, at(40 * 0.2, { speed: 0 })), false);
  // 逆走して、着地する側から地面のない所へ向かっている: 飛ばないので鳴らさない
  const back = (() => {
    const s = course.cross.sA + COURSE1.jump.gap.to + 40 * 0.2;
    const i = ((Math.round(s) % n) + n) % n;
    const p = course.samples[i];
    return { x: p.x, z: p.z, seg: i, move: p.h + Math.PI, speed: 40, airborne: false };
  })();
  assert.equal(jumpAhead(course, back), false);
  // 鳴らすのは「もうすぐ飛ぶ」に変わったときの1回だけ
  const soon = st({ jumpSoon: true });
  assert.deepEqual(soundEvents(st(), soon, 3), ['jump']);
  assert.deepEqual(soundEvents(soon, st({ jumpSoon: false }, { airborne: true, launched: true, y: 0, vy: 5 }), 3), []);
});

test('一時停止で音を止めたあとは、ドリフトの途中でも「止まっている」として扱う。つづけると、ドリフトの音がまた鳴る（M5 のレビュー）', async () => {
  const { afterPause } = await import('../src/audio/events.js');
  const drifting = st({}, { drift: { active: true, stage: 1 } });
  assert.deepEqual(soundEvents(drifting, drifting, 3), []); // そのままだと、つづけても鳴らない
  assert.deepEqual(soundEvents(afterPause(drifting), drifting, 3), ['driftStart']);
  assert.equal(afterPause(null), null);
});

test('バンプ: 乗り越えたら hump（コトン）、転がり始めたら tumble（バーン＋ピヨピヨ）', () => {
  assert.deepEqual(soundEvents(st(), st({}, { hump: 0.3 }), 3), ['hump']);
  assert.deepEqual(soundEvents(st(), st({}, { tumble: 3 }), 3), ['tumble']);
  assert.deepEqual(soundEvents(st({}, { tumble: 3 }), st({}, { tumble: 2.9 }), 3), []);
});

test('牛にぶつかったら moo', () => {
  assert.deepEqual(soundEvents(st({}, { cowHits: 0 }), st({}, { cowHits: 1 }), 3), ['moo']);
});

test('バンプの警告が出たら bumpWarn（ピッピッ）', () => {
  assert.deepEqual(soundEvents(st({ bumpWarn: false }), st({ bumpWarn: true }), 3), ['bumpWarn']);
  assert.deepEqual(soundEvents(st({ bumpWarn: true }), st({ bumpWarn: true }), 3), []);
});

test('スクールバスとすれちがうとき（近づいたとき）に busPass（ブウウーン）、ぶつかったら busHit（2026-10-16 のユーザー依頼）', () => {
  assert.deepEqual(soundEvents(st({ busNear: false }), st({ busNear: true }), 3), ['busPass']);
  assert.deepEqual(soundEvents(st({ busNear: true }), st({ busNear: true }), 3), [], '近くにいる間は1回だけ');
  assert.deepEqual(soundEvents(st({}, { busHits: 0 }), st({}, { busHits: 1 }), 3), ['busHit']);
});

test('イノシシが飛び出す前（予告）に boarWarn（ブヒッ）。ぶつかったら bump', () => {
  assert.deepEqual(soundEvents(st({ boarWarn: false }), st({ boarWarn: true }), 3), ['boarWarn']);
  assert.deepEqual(soundEvents(st({}, { boarHits: 0 }), st({}, { boarHits: 1 }), 3), ['bump']);
});

test('サルが投げたら monkey（キキッ）、木の実が当たったら nutHit（コツン）', () => {
  assert.deepEqual(soundEvents(st({ monkeyThrows: 0 }), st({ monkeyThrows: 1 }), 3), ['monkey']);
  assert.deepEqual(soundEvents(st({}, { nutHits: 0 }), st({}, { nutHits: 1 }), 3), ['nutHit']);
});
