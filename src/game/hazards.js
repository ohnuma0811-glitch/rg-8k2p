// Kampar Town の仕掛け: バンプ（道のでっぱり）と牛（2026-10-15 のユーザー依頼）
import { SPEED_SHOW } from '../hud.js?v=522d1bc';
import { span, locate, ahead, behind } from './track.js?v=522d1bc';

export const BUMP_LIMIT_KMH = 150; // スピードメーターの数字。これを超えてバンプに乗ると転がる（牛のスピンも。2026-10-15 に100から変更）
export const TUMBLE_TIME = 2; // 転がって走れない秒数（2026-10-15 に3秒から1秒、2026-10-17 のユーザー依頼で1秒のばして2秒）
export const HUMP_TIME = 0.35; // 乗り越える動きの秒数
export const BUMP_STRIPE_M = 26; // バンプの手前のしま模様の長さ（m）
export const BUMP_WARN_EARLY = 2; // しまに入るこの秒数前（今の速さで）から、警告を出す（2026-10-15 のユーザー依頼）

// スピードメーターの数字（実際の速さの1.5倍。src/hud.js と同じ）
export function meterKmh(mps) {
  return Math.abs(mps) * 3.6 * SPEED_SHOW;
}

// from から to へ前に進んだとき、at を越えたか（at ちょうどに着いただけでは越えていない。1周の切れ目もまたげる）
export function crossed(track, from, to, at) {
  const moved = span(track, from, to);
  if (moved === 0 || moved > track.length / 2) return false;
  const reach = span(track, from, at);
  return reach > 0 && reach <= moved;
}

// 牛やバスにぶつかったら、ドリフトをやめる（ミニターボはしない。2026-10-16 のユーザー依頼）。
// ドリフトはボタンを押した瞬間に始まるので、押したままでもドリフトにはもどらない（src/game/kart.js）
function cancelDrift(kart) {
  kart.drift = { active: false, dir: 0, stage: 0, counter: false, flicks: 0, time: 0 };
}

export const COW_RADIUS = 1.6; // 牛の大きさ（半径 m）
const COW_PAD = 1.1; // 車の大きさ（src/game/collide.js の KART_RADIUS と同じ）

// 時刻 time の牛の場所。道の中を、ゆっくり左右に行ったり来たりする（端で少しゆっくり）
export function cowPose(track, cow, time) {
  const p = track.samples[Math.round(cow.s) % track.samples.length];
  const w = (2 * Math.PI) / cow.period;
  const a = w * time + cow.phase;
  const b = a + 0.35 * Math.sin(a);
  const lateral = (track.roadHalf - 2) * Math.sin(b);
  const dir = Math.cos(b) >= 0 ? 1 : -1; // 右へ動いているか左へか
  return {
    x: p.x - Math.sin(p.h) * lateral,
    z: p.z + Math.cos(p.h) * lateral,
    y: p.y ?? 0, // 道の高さ（海の底の亀）
    lateral,
    heading: p.h + (dir * Math.PI) / 2, // 動いている向き（道を横切る向き）
  };
}

// 押し出したあと、柵の外に出ないように戻す（牛・イノシシ・雪だるま・コブ）
export function pushInside(kart, track) {
  const loc = locate(track, kart.x, kart.z, kart.seg, 40, kart.y ?? null);
  const excess = Math.abs(loc.lateral) - loc.wall;
  if (excess > 0) {
    const side = Math.sign(loc.lateral);
    kart.x -= -Math.sin(loc.heading) * side * excess;
    kart.z -= Math.cos(loc.heading) * side * excess;
  }
}

// 車と牛の当たり。最初に当たったときだけ 'spin'（メーター100以上）か 'bounce'（それより遅い。壁と同じ）を返す
// phys は src/game/kart.js の PHYS（kart.js がこのファイルを読むので、ここからは読まない）
export function cowContact(kart, track, time, phys) {
  if (kart.auto) return null; // 自動の区間（Global City）の車は当たらない
  let hit = null;
  let touching = false;
  for (const cow of track.cows ?? []) {
    const c = cowPose(track, cow, time);
    const dx = kart.x - c.x;
    const dz = kart.z - c.z;
    const d = Math.hypot(dx, dz);
    const min = COW_RADIUS + COW_PAD;
    if (d >= min || d === 0 || kart.airborne || kart.tumble > 0) continue;
    touching = true;
    kart.x = c.x + (dx / d) * min;
    kart.z = c.z + (dz / d) * min;
    if (kart.onCow) continue;
    if (cow.kind === 'turtle') kart.turtleHits = (kart.turtleHits || 0) + 1; // 亀は「モー」と鳴かない
    else kart.cowHits = (kart.cowHits || 0) + 1;
    cancelDrift(kart);
    if (meterKmh(kart.speed) >= BUMP_LIMIT_KMH) {
      kart.spin = phys.SPIN_TIME;
      kart.spinTo = track.samples[kart.seg].h;
      kart.speed *= 0.5;
      hit = 'spin';
    } else {
      kart.speed *= phys.WALL_KEEP;
      hit = 'bounce';
    }
  }
  // 押し出したあと、柵の外に出ないように戻す
  if (touching) pushInside(kart, track);
  kart.onCow = touching;
  return hit;
}

// イノシシ（Soki Forest。2026-10-16 のユーザー依頼「動物が横切る」）
export const BOAR_RADIUS = 1.3; // イノシシの大きさ（半径 m）
const BOAR_WARN = 0.35; // 道のはしで止まって向きを変える（「ブヒッ」。秒）
const BOAR_RUN = 1.6; // 道を横切る時間（秒）
const BOAR_LINE = 3.5; // 親子の列の、真ん中から両わきの子まで（m。src/game/track.js の BOAR_GAP と同じ）
// 時刻 time のイノシシ: いつも道を左右に突進して行ったり来たり（2026-10-16 のユーザー依頼「常に道を左右に突進」）。
// はし（道のふちの少し外）で BOAR_WARN 秒止まり、BOAR_RUN 秒で反対のはしへ
export function boarPose(track, boar, time) {
  const p = track.samples[Math.round(boar.s) % track.length];
  const half = BOAR_WARN + BOAR_RUN;
  const cycle = Math.floor((time + boar.phase) / half);
  const tin = time + boar.phase - cycle * half;
  const from = (cycle % 2 === 0 ? boar.side : -boar.side) * (p.half + 1 - (boar.offset === undefined ? 0 : BOAR_LINE)); // 親子の列の真ん中の、はし（はしの子が道のふちの少し外まで）
  let lateral = from;
  let state = 'warn';
  if (tin >= BOAR_WARN) {
    state = 'run';
    lateral = from - 2 * from * ((tin - BOAR_WARN) / BOAR_RUN);
  }
  const dir = Math.sign(-from);
  lateral += boar.offset ?? 0; // 親子の列の中の場所（横に並ぶ）
  return { x: p.x - Math.sin(p.h) * lateral, z: p.z + Math.cos(p.h) * lateral, lateral, heading: p.h + (dir * Math.PI) / 2, state };
}

// 車とイノシシの当たり（牛と同じ）。最初に当たったときだけ 'spin'（メーター150以上）か 'bounce' を返す。ドリフトは解除
export const BOAR_PASS = 1.5; // ぶつかったあと、イノシシに押されずに通りぬけられる秒数（2026-10-16: 押し戻され続けて動けなくなった）
export function boarContact(kart, track, time, phys) {
  if (kart.auto) return null; // 自動の区間（Global City）の車は当たらない
  let hit = null;
  let touching = false;
  if (time < (kart.boarPassUntil ?? -Infinity)) return null;
  for (const boar of track.boars ?? []) {
    const c = boarPose(track, boar, time);
    if (c.state === 'hide') continue;
    const dx = kart.x - c.x;
    const dz = kart.z - c.z;
    const d = Math.hypot(dx, dz);
    const min = BOAR_RADIUS + COW_PAD;
    if (d >= min || d === 0 || kart.airborne || kart.tumble > 0) continue;
    touching = true;
    kart.x = c.x + (dx / d) * min;
    kart.z = c.z + (dz / d) * min;
    if (kart.onBoar) continue;
    kart.boarHits = (kart.boarHits || 0) + 1;
    kart.boarPassUntil = time + BOAR_PASS;
    cancelDrift(kart);
    if (meterKmh(kart.speed) >= BUMP_LIMIT_KMH) {
      kart.spin = phys.SPIN_TIME;
      kart.spinTo = track.samples[kart.seg].h;
      kart.speed *= 0.5;
      hit = 'spin';
    } else {
      kart.speed *= phys.WALL_KEEP;
      hit = 'bounce';
    }
  }
  if (touching) pushInside(kart, track);
  kart.onBoar = touching;
  return hit;
}

// サルと木の実（Soki Forest。2026-10-16 のユーザー依頼「猿が木の実を投げてくる」）。内の道（近道）だけ
export const NUT_FALL = 1.0; // 投げてから落ちるまで（秒。そのあいだ落ちる所に影が見える）
export const NUT_RADIUS = 1.6; // 落ちた所からこの距離の車に当たる（m）
export const MONKEY_RANGE = 40; // この距離より近い車をねらう（m）
export const MONKEY_EVERY = 2.5; // 1匹が投げる間（秒。2026-10-16 に 3 から。近道をもう少し難しく）
export const MONKEY_HEIGHT = 9; // 木の上の高さ（m）
const NUT_SPREAD = 4.5; // 1回に投げる3つの木の実の間（道に沿って m）

export function createNuts(track) {
  return { list: [], next: (track.monkeys ?? []).map(() => 0) };
}

// サルが投げる。内の道にいて MONKEY_RANGE m 以内でいちばん近い車の、NUT_FALL 秒後の場所（道の上、点をたどって先）をねらう
// 投げたサルの番号の配列を返す（音のため）
export function stepNuts(nuts, track, karts, time) {
  const thrown = [];
  (track.monkeys ?? []).forEach((m, k) => {
    if (time < nuts.next[k]) return;
    let best = null;
    for (const kart of karts) {
      if (track.samples[kart.seg]?.path !== m.path) continue; // 橋の上（本線）の車はねらわない
      const d = Math.hypot(kart.x - m.x, kart.z - m.z);
      if (d < MONKEY_RANGE && (!best || d < best.d)) best = { kart, d };
    }
    if (!best) return;
    // 1回に3つ: ねらう所と、その手前・先（道に沿って NUT_SPREAD m ずつ。当たる所が3倍。2026-10-16 のユーザー依頼）
    const d = Math.max(0, Math.round(best.kart.speed * NUT_FALL));
    for (const off of [0, -NUT_SPREAD, NUT_SPREAD]) {
      const target = track.samples[d + off >= 0 ? ahead(track, best.kart.seg, d + off) : behind(track, best.kart.seg, -(d + off))];
      nuts.list.push({ x: target.x, z: target.z, y: target.y ?? 0, from: { x: m.x, y: (m.y ?? 0) + MONKEY_HEIGHT, z: m.z }, t0: time, monkey: k });
    }
    nuts.next[k] = time + MONKEY_EVERY;
    thrown.push(k);
  });
  return thrown;
}

// 落ちた木の実の当たり（速さに関係なくスピン。ドリフトは解除）。落ちた時刻をすぎた木の実は、当たっても外れても消す
// keep: true のときは消さない（全部の車で見てから dropFallen で消す）
export function nutContact(kart, nuts, time, phys, { keep = false } = {}) {
  if (kart.auto) return null; // 自動の区間（Global City）の車は当たらない
  let hit = null;
  for (const n of nuts.list) {
    if (time - n.t0 < NUT_FALL) continue;
    if (Math.hypot(kart.x - n.x, kart.z - n.z) < NUT_RADIUS && !kart.airborne && !(kart.spin > 0) && !(kart.tumble > 0)) {
      kart.spin = phys.SPIN_TIME;
      kart.spinTo = kart.move ?? kart.heading;
      kart.speed *= 0.5;
      kart.nutHits = (kart.nutHits || 0) + 1;
      cancelDrift(kart);
      hit = 'spin';
    }
  }
  if (!keep) dropFallen(nuts, time);
  return hit;
}

export function dropFallen(nuts, time) {
  nuts.list = nuts.list.filter((n) => time - n.t0 < NUT_FALL);
}

// 恐竜（Soki Forest。2026-10-16 のユーザー依頼）: ジャンプ②の下の川から、大きな顔が口を開けて、ジャンプの通り道に出てくる
// そのとき飛んだ車は食べられて、DINO_BLACK 秒まっくら。そのあとジャンプ台の DINO_BACK m 手前から走り直し
export const DINO_BLACK = 3; // 食べられて、まっくらの秒数
export const DINO_BACK = 90; // 走り直す所（ジャンプ②の印の手前 m。2026-10-16 に 30 から3倍に）
// 急に出て、ゆっくり川にかくれる（2026-10-16 のユーザー依頼）。ジャンプ②に来た車の 6割くらいが食べられる間（同じ日に 3割から）
const DINO_RISE = 0.25; // 川から飛び出す秒数
const DINO_UP = 3.0; // 顔を出している秒数
const DINO_SINK = 2.2; // ゆっくりもぐる秒数
// 時刻 time の恐竜: state は 'hide' 'rise' 'up' 'sink'、rise は 0（川の中）〜1（いちばん上）
export function dinoPose(track, time) {
  const d = track.dino;
  if (!d) return { state: 'hide', rise: 0 };
  const cycle = Math.floor((time + d.phase) / d.period);
  const tin = time + d.phase - cycle * d.period;
  const a = d.period - DINO_RISE - DINO_UP - DINO_SINK;
  if (tin < a) return { state: 'hide', rise: 0 };
  if (tin < a + DINO_RISE) return { state: 'rise', rise: (tin - a) / DINO_RISE };
  if (tin < a + DINO_RISE + DINO_UP) return { state: 'up', rise: 1 };
  return { state: 'sink', rise: 1 - (tin - a - DINO_RISE - DINO_UP) / DINO_SINK };
}

// 車が恐竜に食べられるか。ジャンプ②から飛び出して川の上にいて、恐竜が口を開けて出ているとき 'eaten'
// 恐竜の顔の置き場所（川の真ん中。src/main.js の形もここに置く）。y は顔の下（下あごの下）の高さ
export function dinoPlace(track, time) {
  const d = track.dino;
  const p = track.samples[Math.round(d.s + 2) % track.length];
  // 道のまん中に出る（2026-10-17 のユーザー依頼で、左右にずらすのをやめた）
  return { x: p.x, z: p.z, h: p.h, y: -17 + 16 * dinoPose(track, time).rise };
}
// 顔の中（形の中か、開いた口の中）か。u は顔の前（走ってくる車の方）へ、w は横、v は顔の下からの高さ（m。src/render/models.js の createDinoModel の形）
const DINO_W = 26 / 2 + 1; // 顔の半分のはば（車の大きさの分を足す）。道はばいっぱいなので、道の端を飛んでも食べられる
function insideDino(u, w, v) {
  if (Math.abs(w) > DINO_W || v < -1) return false;
  if (u < -8.5 || u > 7.5) return false;
  if (u < -2) return v < 18; // 首と頭のてっぺん（大きな目まで）
  // 開いた上あご（つけ根 u=-3.5, v=2.6 から、0.8 ラジアン上へ）の上までと、その先の口の入口
  const jaw = 2.6 + (Math.min(u, 3.5) + 3.5) * Math.tan(0.8) + 1.5;
  return v < Math.min(jaw, 11);
}
// 車が恐竜に食べられるか: 恐竜の顔（形か、開いた口の中）に、車が本当にぶつかったときだけ 'eaten'
// （2026-10-16 のユーザー依頼「画面上で明らかに衝突したとわかる時のみ」。前は、恐竜が出ていて川の上を飛んでいれば食べていた）
export function dinoContact(kart, track, time) {
  if (kart.auto) return null; // 自動の区間（Global City）の車は当たらない
  const d = track.dino;
  if (!d || kart.respawn > 0) return null;
  if (dinoPose(track, time).rise <= 0) return null;
  const c = dinoPlace(track, time);
  const dx = kart.x - c.x;
  const dz = kart.z - c.z;
  const a = dx * Math.cos(c.h) + dz * Math.sin(c.h); // 走る向きに
  const w = -dx * Math.sin(c.h) + dz * Math.cos(c.h); // 横に
  if (!insideDino(-a, w, (kart.y ?? 0) + 0.8 - c.y)) return null;
  kart.eaten = (kart.eaten || 0) + 1;
  kart.swallowed = true; // 見えなくする（自分の車なら画面をまっくらに）
  // 空中のしるしを消す（走り直すときに着地の音が鳴らないように。2026-10-17 のユーザー依頼）
  kart.airborne = false;
  kart.launched = false;
  kart.vy = 0;
  kart.respawn = DINO_BLACK;
  kart.respawnAt = Math.round(d.s - DINO_BACK + track.length) % track.length;
  kart.speed = 0;
  cancelDrift(kart);
  return 'eaten';
}

// 橋の下の橋脚（Soki Forest。2026-10-17）: 下の道の車が、橋のはばいっぱいの石の壁にぶつかる。壁は通りぬけられない
// 入り口のはしに正面からぶつかったときは、牛と同じ判定（メーター150以上でスピン、遅いと跳ね返る。2026-10-22 のユーザー依頼）。
// 壁の横をこすったときは、はね返されるだけ（柵と同じ。2026-10-19 のユーザー依頼）
// 正面からぶつかったあと BOAR_PASS 秒は、続けてスピンしない（押し出すだけ）
const KART_PAD = 1.1; // 車の大きさ（半径 m）
const PIER_SCRAPE_KEEP = 0.85; // 横をこすりはじめたときに残る速さの割合
export function pierContact(kart, track, time, phys) {
  if (kart.auto) return null; // 自動の区間（Global City）の車は当たらない
  let hit = null;
  let touching = false;
  for (const pier of track.bridgePiers ?? []) {
    if ((kart.y ?? 0) > pier.top - 1) continue; // 橋の上の車
    const dx = kart.x - pier.x;
    const dz = kart.z - pier.z;
    const c = Math.cos(pier.h);
    const s = Math.sin(pier.h);
    const a = dx * c + dz * s; // 本線の向き（壁の厚さの向き）
    const w = -dx * s + dz * c; // 橋のはばの向き（壁の長い向き。下の道はこの向きに通る）
    const reach = pier.halfThick + KART_PAD;
    const reachW = pier.halfLen + KART_PAD;
    if (Math.abs(a) >= reach || Math.abs(w) >= reachW) continue;
    const side = reach - Math.abs(a); // 横の面からのめりこみ
    const end = reachW - Math.abs(w); // はしの面からのめりこみ
    if (side <= end) {
      // 横をこすった: 近い方の横の面へ押し出し、壁にそう向きにそろえる（スピンしない）
      const sa = Math.sign(a) || 1;
      kart.x += c * sa * side;
      kart.z += s * sa * side;
      const into = -(Math.cos(kart.move) * c + Math.sin(kart.move) * s) * sa * Math.sign(kart.speed || 1);
      if (into > 0 && !kart.airborne) {
        if (!kart.pierTouch) kart.speed *= PIER_SCRAPE_KEEP;
        const fwd = Math.cos(kart.move) * -s + Math.sin(kart.move) * c >= 0 ? 1 : -1;
        const along = Math.atan2(c * fwd, -s * fwd);
        kart.move = along;
        kart.heading = along;
      }
      touching = true;
      continue;
    }
    // 入り口のはしに正面から: はしの面へ押し出して、スピン
    const sw = Math.sign(w) || 1;
    kart.x += -s * sw * end;
    kart.z += c * sw * end;
    if (time < (kart.pierPassUntil ?? -Infinity) || kart.airborne || kart.spin > 0) continue;
    kart.pierPassUntil = time + BOAR_PASS;
    kart.pierHits = (kart.pierHits || 0) + 1;
    cancelDrift(kart);
    if (meterKmh(kart.speed) >= BUMP_LIMIT_KMH) {
      kart.spin = phys.SPIN_TIME;
      kart.spinTo = track.samples[kart.seg].h;
      kart.speed *= 0.5;
      hit = 'spin';
    } else {
      kart.speed *= phys.WALL_KEEP;
      hit = 'bounce';
    }
  }
  kart.pierTouch = touching;
  if (touching) kart.onWall = true; // 柵と同じ、ぶつかる音
  return hit;
}

// ぬかるみ（Soki Forest の近道。2026-10-16 のユーザー依頼）: 入ると MUD_TIME 秒、ハンドルが左右逆になる（kart.js が kart.muddy を見る）
// 雪だるま（Kyugo Mountain。2026-10-18 のユーザー依頼「ジャンプしながら左右に動いている」）
export const SNOWMAN_RADIUS = 2.0; // 2026-10-18 のユーザー依頼「2倍の大きさ」で 1.0 から
export const SNOWMAN_HEIGHT = 4.6; // 帽子のてっぺんまで（m。src/render/models.js の雪だるま。2倍の大きさ）
export const SNOWMAN_HOP = 0.8; // 跳ねる高さ（m。観客席の前の小さなジャンプで、頭の上を飛び越えられる高さ）
export const SNOWMAN_HOP_TIME = 0.6; // 1回跳ねる秒数
export function snowmanPose(track, sm, time) {
  const p = track.samples[sm.i];
  const a = (2 * Math.PI * time) / sm.period + sm.phase;
  const lateral = (p.half - 2) * Math.sin(a);
  const u = ((((time + sm.phase) % SNOWMAN_HOP_TIME) + SNOWMAN_HOP_TIME) % SNOWMAN_HOP_TIME) / SNOWMAN_HOP_TIME;
  const hop = SNOWMAN_HOP * 4 * u * (1 - u);
  return { x: p.x - Math.sin(p.h) * lateral, z: p.z + Math.cos(p.h) * lateral, y: p.y ?? 0, lateral, hop, heading: p.h };
}

// 車と雪だるまの当たり（牛と同じ。2026-10-18 のユーザー依頼）。ぶつかったあと BOAR_PASS 秒は通りぬけられる
export function snowmanContact(kart, track, time, phys) {
  if (kart.auto) return null; // 自動の区間（Global City）の車は当たらない
  if (time < (kart.snowmanPassUntil ?? -Infinity) || kart.airborne || kart.tumble > 0) return null;
  for (const sm of track.snowmen ?? []) {
    const c = snowmanPose(track, sm, time);
    if (Math.abs((kart.y ?? 0) - c.y) > 4) continue; // 橋の上と下
    const dx = kart.x - c.x;
    const dz = kart.z - c.z;
    const d = Math.hypot(dx, dz);
    const min = SNOWMAN_RADIUS + COW_PAD;
    if (d >= min || d === 0) continue;
    kart.x = c.x + (dx / d) * min;
    kart.z = c.z + (dz / d) * min;
    kart.snowmanHits = (kart.snowmanHits || 0) + 1;
    kart.snowmanPassUntil = time + BOAR_PASS;
    cancelDrift(kart);
    pushInside(kart, track);
    if (meterKmh(kart.speed) >= BUMP_LIMIT_KMH) {
      kart.spin = phys.SPIN_TIME;
      kart.spinTo = track.samples[kart.seg].h;
      kart.speed *= 0.5;
      return 'spin';
    }
    kart.speed *= phys.WALL_KEEP;
    return 'bounce';
  }
  return null;
}

// コブ（Kyugo Mountain。2026-10-18）: 正面（進む向きとコブへの向きの差が MOGUL_FRONT 以内）から当たると上へ跳ね、横からははじかれる
export const MOGUL_HOP_VY = 6;
export const MOGUL_FRONT = (35 * Math.PI) / 180;
export const MOGUL_SIDE_PUSH = 2.5;
export const MOGUL_SIDE_KEEP = 0.85;
export function mogulContact(kart, track) {
  if (kart.auto) return null; // 自動の区間（Global City）の車は当たらない
  if (kart.airborne || !track.moguls?.length) return null;
  for (const m of track.moguls) {
    const dx = m.x - kart.x;
    const dz = m.z - kart.z;
    const d = Math.hypot(dx, dz);
    if (d >= m.r + COW_PAD || d === 0) continue;
    kart.mogulHits = (kart.mogulHits || 0) + 1;
    const toward = Math.atan2(dz, dx);
    const off = Math.abs(Math.atan2(Math.sin(toward - kart.move), Math.cos(toward - kart.move)));
    if (off < MOGUL_FRONT && kart.speed > 3) {
      kart.airborne = true;
      kart.launched = false; // ジャンプ台ではないので「イヤッホー」と着地の音はなし
      kart.vy = MOGUL_HOP_VY;
      return 'hop';
    }
    // 横から: コブの中心から外へ、ふれる所よりさらに MOGUL_SIDE_PUSH m 押し出す
    const min = m.r + COW_PAD + MOGUL_SIDE_PUSH;
    kart.x = m.x - (dx / d) * min;
    kart.z = m.z - (dz / d) * min;
    kart.speed *= MOGUL_SIDE_KEEP;
    pushInside(kart, track);
    return 'side';
  }
  return null;
}

// 道の上の動かない木（Soki Forest。2026-10-18 のユーザー依頼）: 牛と同じ当たり（メーター150以上でスピン、遅いと跳ね返る、
// ドリフト解除、ぶつかったあと BOAR_PASS 秒は通りぬけられる）
export const TREE_RADIUS = 0.9; // 幹の大きさ（半径 m）
export function treeContact(kart, track, time, phys) {
  if (kart.auto) return null; // 自動の区間（Global City）の車は当たらない
  if (!track.trees?.length || time < (kart.treePassUntil ?? -Infinity) || kart.airborne || kart.tumble > 0) return null;
  for (const tr of track.trees) {
    if (Math.abs((kart.y ?? 0) - tr.y) > 4) continue;
    const dx = kart.x - tr.x;
    const dz = kart.z - tr.z;
    const d = Math.hypot(dx, dz);
    const min = TREE_RADIUS + COW_PAD;
    if (d >= min || d === 0) continue;
    kart.x = tr.x + (dx / d) * min;
    kart.z = tr.z + (dz / d) * min;
    kart.treeHits = (kart.treeHits || 0) + 1;
    kart.treePassUntil = time + BOAR_PASS;
    cancelDrift(kart);
    pushInside(kart, track);
    if (meterKmh(kart.speed) >= BUMP_LIMIT_KMH) {
      kart.spin = phys.SPIN_TIME;
      kart.spinTo = track.samples[kart.seg].h;
      kart.speed *= 0.5;
      return 'spin';
    }
    kart.speed *= phys.WALL_KEEP;
    return 'bounce';
  }
  return null;
}

// スローの板（Kyugo Mountain。2026-10-18 のユーザー依頼「逆向きの歩く歩道」）: 乗っている間、うしろへ引っぱる。止まりはしない
export const SLOW_PULL = 18; // m/s²
export const SLOW_MIN = 8; // これより遅くはしない（m/s）
export function slowContact(kart, track, dt) {
  if (kart.auto) return; // 自動の区間（Global City）の車は当たらない
  if (kart.airborne || !track.slows?.length) return false;
  const loc = locate(track, kart.x, kart.z, kart.seg, 40, kart.y ?? null);
  if (track.samples[loc.i].path !== 0) return false;
  for (const sl of track.slows) {
    const d = (loc.i - sl.from + track.length) % track.length;
    if (d >= 30 || Math.abs(loc.lateral - sl.lateral) > sl.half) continue;
    if (kart.speed > SLOW_MIN) kart.speed = Math.max(SLOW_MIN, kart.speed - SLOW_PULL * dt);
    return true;
  }
  return false;
}

export const MUD_TIME = 4;
export function mudContact(kart, track, dt) {
  if (kart.auto) return; // 自動の区間（Global City）の車は当たらない
  if (kart.muddy > 0) kart.muddy = Math.max(0, kart.muddy - dt);
  const inside = !kart.airborne && !(kart.respawn > 0) && (track.muds ?? []).some((m) => Math.hypot(kart.x - m.x, kart.z - m.z) < m.r);
  if (inside && !kart.onMud) {
    kart.muddy = MUD_TIME;
    kart.mudHits = (kart.mudHits || 0) + 1;
  }
  kart.onMud = inside;
}

// 自分の車から range m 以内に、飛び出す前（予告）のイノシシがいるか（「ブヒッ」を鳴らす）
export function boarWarning(track, kart, time, range = 35) {
  return (track.boars ?? []).some((boar) => {
    const c = boarPose(track, boar, time);
    return c.state === 'warn' && Math.hypot(c.x - kart.x, c.z - kart.z) < range;
  });
}

// バンプの警告を出すか: バンプの手前のしま模様の上か、今の速さで BUMP_WARN_EARLY 秒以内にしまに入る（転がっている・飛んでいる・止まりかけは出さない）
export function bumpWarning(track, kart) {
  if (kart.tumble > 0 || kart.airborne || !(kart.speed > 2)) return false;
  const s = track.samples[kart.seg].s;
  return (track.bumps ?? []).some((b) => {
    const ahead = span(track, s, b);
    return ahead > 0 && ahead < track.length / 2 && ahead - BUMP_STRIPE_M <= BUMP_WARN_EARLY * kart.speed;
  });
}

// スクールバス（BAS SEKOLAH。2026-10-16 のユーザー依頼）: レースの進む向きの右側の車線を、いつも逆向きに走ってくる。
// 牛とはぶつからずに通り過ぎる。カートが触れると、速さに関係なくスピンする
export const BUS_SPEED = 13; // バスの速さ（m/s。メーター約70）
export const BUS_LANE = 6; // 道の真ん中から右へ（m）。ロータリーでは、道が広がった分だけ外（島の右側）を回る
export const BUS_LENGTH = 7.5; // バスの長さ（m）
export const BUS_WIDTH = 2.6; // バスの幅（m）
export const BUS_NEAR = 20; // すれちがいの音を鳴らす近さ（m）

// 時刻 time のバスの場所: s はコースの上の場所（逆に進む）、lateral は右へ
// 前と後ろの車輪の、真ん中からの距離（m）。坂では、両方の車輪が道にのるように、高さと傾きを決める
// （ジョージ・ワシントン・ブリッジの坂で、タクシーが道にめり込んでいた。2026-10-22 のユーザー依頼）
export const WHEEL_HALF = { taxi: 2.9, tram: 3.5, bus: 3 };
function roadYAt(track, s) {
  const n = track.length;
  const k = ((s % n) + n) % n;
  const i = Math.floor(k);
  const p = track.samples[i];
  const q = track.samples[(i + 1) % n];
  return (p.y ?? 0) + ((q.y ?? p.y ?? 0) - (p.y ?? 0)) * (k - i);
}
export function busPose(track, bus, time) {
  const L = track.length;
  const n = track.length; // バスは本線だけを走る（分かれ道の点は本線の点のあとにある）
  // 範囲のある乗り物（Global City の路面電車・タクシー）は、その範囲の中でくり返す
  const len = bus.from !== undefined ? bus.to - bus.from : 0;
  // dir: -1 はコースと逆向き（向かってくる）、1 は同じ向き。side: 1 は道の右、-1 は左（Global City。2026-10-21）
  const dir = bus.dir ?? -1;
  const side = bus.side ?? 1;
  const s = len ? bus.from + ((((bus.s0 + dir * BUS_SPEED * time - bus.from) % len) + len) % len) : ((((bus.s0 + dir * BUS_SPEED * time) % L) + L) % L);
  const i = Math.floor(s) % n;
  const p = track.samples[i];
  const q = track.samples[(i + 1) % n];
  const f = s - Math.floor(s);
  const lateral = side * (BUS_LANE + (p.half - track.roadHalf));
  const px = p.x + (q.x - p.x) * f;
  const pz = p.z + (q.z - p.z) * f;
  // 高さは道の高さ（高い橋やらせんの上で、地面の高さを走って見えた。2026-10-21 のユーザー依頼）
  // 坂では、前と後ろの車輪の所の道の高さから、高さと傾き（pitch。車の前が上がると +）を決める
  const half = WHEEL_HALF[bus.kind ?? 'bus'] ?? WHEEL_HALF.bus;
  const yFront = roadYAt(track, s + dir * half);
  const yBack = roadYAt(track, s - dir * half);
  return {
    s,
    x: px - Math.sin(p.h) * lateral,
    y: (yFront + yBack) / 2,
    pitch: Math.atan2(yFront - yBack, 2 * half),
    z: pz + Math.cos(p.h) * lateral,
    lateral,
    heading: dir < 0 ? p.h + Math.PI : p.h, // 向かってくる車はコースと逆向き
  };
}

// 車とバスの当たり（バスは長い四角）。触れた最初だけ 'spin' を返し、横へ押し出す
export function busContact(kart, track, time, phys) {
  if (kart.auto) return null; // 自動の区間（Global City）の車は当たらない
  let hit = null;
  let touching = false;
  for (const bus of track.buses ?? []) {
    const b = busPose(track, bus, time);
    if (Math.abs((kart.y ?? 0) - b.y) > 3) continue; // 高さがちがう（らせんの上と下など）
    const fx = Math.cos(b.heading);
    const fz = Math.sin(b.heading);
    const dx = kart.x - b.x;
    const dz = kart.z - b.z;
    const along = dx * fx + dz * fz;
    const side = dx * -fz + dz * fx;
    const halfL = BUS_LENGTH / 2 + COW_PAD;
    const halfW = BUS_WIDTH / 2 + COW_PAD;
    if (Math.abs(along) >= halfL || Math.abs(side) >= halfW || kart.airborne || kart.tumble > 0) continue;
    touching = true;
    // 横（近い側）へ押し出す
    const out = (Math.sign(side) || -1) * halfW - side;
    kart.x += -fz * out;
    kart.z += fx * out;
    if (kart.onBus || kart.spin > 0) continue;
    kart.busHits = (kart.busHits || 0) + 1;
    cancelDrift(kart);
    kart.spin = phys.SPIN_TIME;
    kart.spinTo = track.samples[kart.seg].h;
    kart.speed *= 0.5;
    hit = 'spin';
  }
  if (touching) {
    const loc = locate(track, kart.x, kart.z, kart.seg, 40, kart.y ?? null);
    const excess = Math.abs(loc.lateral) - loc.wall;
    if (excess > 0) {
      const sd = Math.sign(loc.lateral);
      kart.x -= -Math.sin(loc.heading) * sd * excess;
      kart.z -= Math.cos(loc.heading) * sd * excess;
    }
  }
  kart.onBus = touching;
  return hit;
}

// 近くにバスがいるか（すれちがいの音）
// 近くの乗り物の種類（'bus' スクールバス・'tram' 香港の路面電車・'taxi'）を返す。近くになければ false。
// 種類で、すれちがう音を変える（路面電車は電車のクラクション。2026-10-22 のユーザー依頼）
export function busNear(track, pos, time) {
  const bus = (track.buses ?? []).find((bus) => {
    const b = busPose(track, bus, time);
    return Math.hypot(b.x - pos.x, b.z - pos.z) < BUS_NEAR;
  });
  return bus ? bus.kind ?? 'bus' : false;
}

// 逆走を止める柵（2026-10-22 のユーザー依頼）: 柵の手前（前向きに GATE_MIN m より近い所）へ、逆向きに走ってきた車を押し戻して止める。
// 前向きに走る車（ジャンプで飛んでくる車も、手前に着地した車も）は当たらない
export const GATE_MIN = 0.8;
const GATE_ROAD = 12; // 柵の道の点から、前後この数の点の中にいる車だけ
export function oneWayContact(kart, track) {
  if (kart.auto || !track.oneWays?.length) return null;
  for (const g of track.oneWays) {
    const dx = kart.x - g.x;
    const dz = kart.z - g.z;
    const fwd = dx * Math.cos(g.h) + dz * Math.sin(g.h);
    if (fwd >= GATE_MIN || fwd < -4) continue;
    const lat = -dx * Math.sin(g.h) + dz * Math.cos(g.h);
    if (Math.abs(lat) > g.wall + 1 || Math.abs((kart.y ?? g.y) - g.y) > 4) continue;
    // 柵の道の上の車だけ（そばを横切るほかの道の壁ぎわで引っかかった。Kenta Circuit の交わる道。2026-10-22 のユーザー依頼）
    const d = Math.abs(kart.seg - g.i);
    if (Math.min(d, track.length - d) > GATE_ROAD) continue;
    if (kart.speed * Math.cos(kart.move - g.h) > -0.5 * Math.abs(kart.speed)) continue; // はっきり逆向きに走っている車だけ
    kart.x += Math.cos(g.h) * (GATE_MIN - fwd);
    kart.z += Math.sin(g.h) * (GATE_MIN - fwd);
    kart.speed = 0;
    cancelDrift(kart);
    return 'stop';
  }
  return null;
}
