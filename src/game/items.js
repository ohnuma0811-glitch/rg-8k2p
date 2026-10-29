// アイテム（設計書 docs/superpowers/specs/2026-10-22-items-design.md）: 枠・ルーレット・ITEM ボタンの順番・使ったときの効果
// ボタンを押したことは「出来事」（{ type, k, t, ... }）にして applyItemEvent で効かせる（M4 の対戦で、ほかの端末にも同じ出来事を送るため）
import { useMushroom, STAR, startBlast, LIGHTNING, BLAST, SQUASH, squashKart } from './kart.js?v=a44eecd';
import { rollItem } from './itemOdds.js?v=a44eecd';
import { createBoxes, stepBoxes, touchBoxes } from './itemBoxes.js?v=a44eecd';
import { locate } from './track.js?v=a44eecd';
import { KART_RADIUS } from './collide.js?v=a44eecd';
import { launchShell, stepShells, guard, scatterBananas, advanceShell, SHELL } from './shells.js?v=a44eecd';

export { SQUASH, squashKart };

export const ITEM = {
  ROULETTE: 2, // ルーレットが回る秒数
  BANANA_SWAP: 5, // バナナを踏むと、ハンドルの左右が入れ替わる秒数
  LIGHTNING_TIME: LIGHTNING.TIME, // 稲妻で小さくなっている秒数（当たってから）
  LIGHTNING_SCALE: LIGHTNING.SCALE, // そのときの大きさ
  LIGHTNING_SPEED: LIGHTNING.SPEED, // そのときの最高速の倍率
  BANANA_DROP: 3, // バナナを置く所（車の後ろ m）
  BANANA_SET: 5, // バナナは5個セット。1回目の ITEM で5個を後ろにぶら下げ、そのあと1回ごとに1個置く（2026-10-22 のユーザー依頼）
  BANANA_MAX: 20, // コース全体のバナナの数（超えたら古い物から消える。5個セットにしたので10から20へ）
  BANANA_R: 0.8, // バナナの大きさ（半径 m）
  BANANA_OWNER_SAFE: 1, // 置いてすぐは、自分では踏まない（秒）
  TRAIL_BACK: 2.4, // ぶら下げたバナナの場所（車の後ろ m。いちばん前の1個）
  TRAIL_GAP: 1.2, // ぶら下げたバナナどうしの間（m）
  ORBIT_R: 2.4, // 回る緑の甲羅の、車の中心からの距離（m）
  ORBIT_SPIN: 5, // 回る速さ（rad/s）
  ZAP_SHOW: 0.5, // 稲妻が見えている秒数
  FLASH_FADE: 2.5, // 稲妻の白い光が消える速さ（1秒に。約0.4秒で消える）
};

// 車にアイテムの性質を足す（レースの最初に1回。コースに戻っても消さない）
export function initItems(kart) {
  Object.assign(kart, { held: null, roulette: 0, rouletteItem: null, orbit: [], orbitAngle: 0, trailing: 0, zap: 0, small: 1, smallTime: 0 });
}

// レースのアイテムの世界（箱・置かれたバナナ・飛んでいる甲羅）
// owns(k): この端末が動かす車か（対戦。SOLO は全部）。idFor(k): 車 k の新しい出来事の番号（対戦。null なら数の番号）
// hidden(k): 見えない車か（対戦の QUIT・切れた車。当たりを見ない。SOLO はなし）
export function createItemWorld(track, { owns = () => true, idFor = null, hidden = () => false } = {}) {
  return { track, boxes: createBoxes(track), bananas: [], shells: [], pending: [], nextId: 1, flash: 0, thunder: 0, owns, idFor, hidden };
}

// その番号の甲羅・バナナを消す（対戦の「当たった」。なければ何もしない）
export function removeItem(world, id) {
  world.shells = world.shells.filter((s) => s.id !== id);
  world.bananas = world.bananas.filter((b) => b.id !== id);
  world.pending = world.pending.filter((q) => q.id !== id);
}

// 出来事の「出した所」（ほかの端末から届いたとき）。なければその車の今の様子
function fromKart(kart, from) {
  return from ? { ...kart, x: from.x, y: from.y, z: from.z, heading: from.h, seg: from.i, airborne: false } : kart;
}

// 新しいアイテムを取れるか（緑の甲羅を回している・バナナをぶら下げているのは、空として扱う）
export function canTake(kart) {
  return !kart.held && !(kart.roulette > 0);
}

// ITEM ボタンが効くか
export function canUse(kart, finished) {
  return !finished && !(kart.blast > 0) && !(kart.tumble > 0) && !kart.auto && !(kart.respawn > 0) && !(kart.squash > 0);
}

// 左右の入れ替え（Banana・Lightning。Soki Forest のぬかるみと同じ kart.muddy）。残りは「今の残り」と「新しい時間」の長い方
// Star の車と、自動の区間の車には効かない
export function swapSteer(kart, time) {
  if (kart.star > 0 || kart.auto) return false;
  kart.muddy = Math.max(kart.muddy ?? 0, time);
  kart.swapItem = true; // CPU がふらふら走るための目印（ぬかるみとの見分け。muddy が 0 になったら stepItems が消す）
  return true;
}

// 稲妻（2026-10-22 のユーザー依頼）: 自分以外の全員が、赤甲羅と同じようにスピンしながら35%に小さくなり、10秒間、最高速が75%。
// 効いた車に稲妻が見える。画面は白く光る。Star の車と自動の区間の車には効かない。すでに小さい車は、10秒をやり直してスピンする
function strikeLightning(world, karts, k) {
  karts.forEach((o, j) => {
    if (j === k || !world.owns(j) || o.star > 0 || o.auto) return;
    o.smallTime = ITEM.LIGHTNING_TIME;
    startBlast(o, world.track); // スピン中ならそのまま（false）
    o.zap = ITEM.ZAP_SHOW;
  });
  world.flash = 1;
  world.thunder += 1;
}

// 小さくなっている車の大きさ（kart.small）を進める: スピンの間に1→0.35、そのあと0.35、終わりの BACK 秒で1にもどる
function stepSmall(kart, dt) {
  if (kart.squash > 0) return; // ぺしゃんこの間は、時間も大きさも止める（終わると元にもどる）
  if (kart.smallTime > 0) {
    kart.smallTime = Math.max(0, kart.smallTime - dt);
    const down = kart.blast > 0 ? 1 - kart.blast / BLAST.TIME : 1; // スピンの進み 0 → 1
    const shrink = 1 - (1 - ITEM.LIGHTNING_SCALE) * down;
    const back = Math.min(1, kart.smallTime / LIGHTNING.BACK); // 1 → 0
    const target = 1 - (1 - shrink) * back;
    kart.small = kart.blast > 0 ? Math.min(kart.small, target) : target; // スピン中は、もう小さい車がまた大きくならない
  } else if (kart.small !== 1) {
    kart.small = 1;
  }
}

// バナナを置く（車の 3m 後ろの地面）。コース全体で10個まで
function dropBanana(world, kart, k, id = world.nextId++) {
  const x = kart.x - Math.cos(kart.heading) * ITEM.BANANA_DROP;
  const z = kart.z - Math.sin(kart.heading) * ITEM.BANANA_DROP;
  const loc = locate(world.track, x, z, kart.seg, 40, kart.y ?? null);
  world.bananas.push({ id, owner: k, x, z, y: loc.ground ?? kart.y, age: 0, h: kart.heading }); // h: 置いた車の向き（見た目で、道に対して横向きに置く）
  if (world.bananas.length > ITEM.BANANA_MAX) world.bananas.shift();
}

// 置かれたバナナの当たり。踏んだ車は左右が入れ替わる（Star の車は何も起きない）。どちらでもバナナは消える
function stepBananas(world, karts, dt, out) {
  for (const b of [...world.bananas]) {
    b.age += dt;
    for (let j = 0; j < karts.length; j++) {
      const o = karts[j];
      if (o.auto || o.airborne || o.respawn > 0 || world.hidden?.(j)) continue;
      if (j === b.owner && b.age < ITEM.BANANA_OWNER_SAFE) continue;
      if (Math.abs((o.y ?? 0) - b.y) > 1.5 || Math.hypot(o.x - b.x, o.z - b.z) > ITEM.BANANA_R + KART_RADIUS) continue;
      world.bananas.splice(world.bananas.indexOf(b), 1);
      if (!world.owns(j)) break; // ほかの端末の車: 消えるだけ（当たったかはその車の端末が決める）
      if (o.star > 0) {
        out.push({ type: 'squash', k: j, id: b.id });
        break;
      }
      const by = guard(o, Math.atan2(b.z - o.z, b.x - o.x), false);
      if (by) {
        out.push({ type: 'blocked', k: j, by, id: b.id });
        break;
      }
      swapSteer(o, ITEM.BANANA_SWAP);
      o.bananaHits = (o.bananaHits || 0) + 1;
      out.push({ type: 'banana', k: j, id: b.id });
      break;
    }
  }
}

// 赤の甲羅がねらう車: 使った時点で、ひとつ前の順位の車（1位なら null）
// ゴール済みの車は飛ばして、その前の順位のゴールしていない車（いなければ null。まっすぐ飛ぶ）
function targetOf(ranks, k, finished) {
  for (let pos = ranks.indexOf(k) - 1; pos >= 0; pos--) if (!finished[ranks[pos]]) return ranks[pos];
  return null;
}

// ITEM ボタン（設計書 3.1 の順番）。出来事を返す（何もしないときは null）
export function itemPress(world, karts, k, f) {
  const kart = karts[k];
  if (!canUse(kart, f.finished[k])) return null;
  let ev = null;
  if (kart.trailing) {
    if (kart.airborne) return null; // 空中では置けない（空中にバナナが置かれていた。2026-10-22 のユーザー依頼）
    ev = { type: 'drop', k, t: f.t };
  }
  else if (kart.orbit.length) ev = { type: 'throw', k, t: f.t };
  else if (kart.roulette > 0) ev = { type: 'stop', k, t: f.t };
  else if (kart.held === 'mushroom' && kart.mushroom > 0) return null; // キノコの加速が効いている間は、次のキノコを使えない（連打できない。2026-10-22 のユーザー依頼）
  else if (kart.held) ev = { type: 'use', k, t: f.t, item: kart.held, target: kart.held === 'shell' ? targetOf(f.ranks, k, f.finished) : null };
  if (ev && ev.type !== 'stop' && world.idFor) ev.id = world.idFor(k);
  if (ev) applyItemEvent(world, karts, ev, f);
  return ev;
}

// ジャンプ台の上・飛んでいる間か（甲羅はジャンプ台を越えられないので、ここで投げた甲羅は着地してから出す）
function onJump(world, kart) {
  const p = world.track.samples[kart.seg];
  return kart.airborne || p.y === null || p.ramp || p.kick;
}

// 甲羅を出す。ジャンプ台で投げたときは消さずにとっておき、着地したら出す（2026-10-22 のユーザー依頼）
function fireShell(world, kart, k, kind, target, topSpeed, id) {
  if (onJump(world, kart)) world.pending.push({ k, kind, target, topSpeed, id });
  else launchShell(world, kart, k, kind, target, topSpeed, id);
}

// とっておいた甲羅: 投げた車が着地したら出す（自動の区間・コースに戻る途中は待つ）
function firePending(world, karts) {
  world.pending = world.pending.filter((q) => {
    const kart = karts[q.k];
    if (kart.auto || kart.respawn > 0 || onJump(world, kart)) return true;
    launchShell(world, kart, q.k, q.kind, q.target, q.topSpeed, q.id);
    return false;
  });
}

// ルーレットで決まったアイテムを枠に入れる。キノコは3個セット（3回使える。2026-10-22 のユーザー依頼）
export const MUSHROOM_SET = 3;
function takeItem(kart, item) {
  kart.held = item;
  kart.heldUses = item === 'mushroom' ? MUSHROOM_SET : 1;
}

// 出来事を効かせる（どの端末でも、同じ出来事から同じように動く）
export function applyItemEvent(world, karts, ev, f) {
  if (ev.type === 'hit') return removeItem(world, ev.id);
  if (ev.type === 'orbit') {
    const o = karts[ev.o];
    if (!world.owns(ev.o) || !o?.orbit) return;
    const n = o.orbit.indexOf(ev.s);
    if (n >= 0) o.orbit.splice(n, 1);
    return;
  }
  if (ev.type === 'scatter') {
    const f0 = ev.from;
    if (!f0) return; // おかしな出来事（届いたものが壊れていても、レースを止めない）
    scatterBananas(world, { x: f0.x, y: f0.y, z: f0.z, heading: f0.h, seg: f0.i, trailing: ev.c }, ev.k, ev.id);
    return;
  }
  const kart = karts[ev.k];
  if (!kart) return; // ない車の出来事は何もしない
  const src = fromKart(kart, ev.from); // ほかの端末から届いたときは、出した所から
  const top = ev.from?.v ?? (f.paramsOf?.(ev.k) ?? f.params).topSpeed;
  if (ev.type === 'drop') {
    kart.trailing = Math.max(0, kart.trailing - 1); // 残りの数（0 になったら、ぶら下げていない）
    dropBanana(world, src, ev.k, ev.id ?? world.nextId++);
    return;
  }
  if (ev.type === 'throw') {
    kart.orbit.shift();
    fireShell(world, src, ev.k, 'green', null, top, ev.id ?? world.nextId++);
    kart.thrown = (kart.thrown || 0) + 1;
    return;
  }
  if (ev.type === 'stop') {
    kart.roulette = 0;
    takeItem(kart, kart.rouletteItem);
    kart.rouletteItem = null;
  } else if (ev.type === 'use') {
    kart.heldUses = Math.max(0, (kart.heldUses ?? 1) - 1);
    if (kart.heldUses === 0) kart.held = null; // キノコは3回使うまで枠に残る
    if (ev.item === 'mushroom') useMushroom(kart, f.paramsOf?.(ev.k) ?? f.params); // その車自身のパラメーターで（CPU は自分の最高速で）
    else if (ev.item === 'star') kart.star = STAR.TIME;
    else if (ev.item === 'banana') kart.trailing = ITEM.BANANA_SET;
    else if (ev.item === 'green') {
      kart.orbit = [0, 1, 2];
      kart.thrown = (kart.thrown || 0) + 1;
    } else if (ev.item === 'shell') {
      fireShell(world, src, ev.k, 'red', ev.target, top, ev.id ?? world.nextId++);
      kart.thrown = (kart.thrown || 0) + 1;
    } else if (ev.item === 'lightning') strikeLightning(world, karts, ev.k);
  }
}

// 毎フレーム: 箱・ルーレット・時間。起きたこと（音・見た目のため）を返す
export function stepItems(world, karts, f, dt) {
  const out = [];
  stepBoxes(world.boxes, dt);
  firePending(world, karts);
  world.flash = Math.max(0, world.flash - ITEM.FLASH_FADE * dt);
  karts.forEach((kart, k) => {
    stepSmall(kart, dt);
    if (kart.swapItem && !(kart.muddy > 0)) kart.swapItem = false;
    if (kart.zap > 0) kart.zap = Math.max(0, kart.zap - dt);
    kart.orbitAngle = (kart.orbitAngle + ITEM.ORBIT_SPIN * dt) % (2 * Math.PI);
    if (kart.roulette > 0) {
      kart.roulette = Math.max(0, kart.roulette - dt);
      if (kart.roulette === 0) {
        takeItem(kart, kart.rouletteItem);
        kart.rouletteItem = null;
        out.push({ type: 'decided', k });
      }
    }
    if (kart.auto || kart.respawn > 0 || f.finished[k]) return;
    if (touchBoxes(world.boxes, kart) && world.owns(k) && canTake(kart)) {
      kart.rouletteItem = rollItem(f.ranks.indexOf(k) + 1, karts.length, k !== f.me, f.rand());
      kart.roulette = ITEM.ROULETTE;
      kart.boxes = (kart.boxes || 0) + 1;
      out.push({ type: 'box', k });
    }
  });
  stepBananas(world, karts, dt, out);
  out.push(...stepShells(world, karts, dt));
  // Star の車がほかの車にぶつかったら、相手が吹き飛ぶ（車どうしの押し合いの前に見る）
  const hidden = world.hidden ?? (() => false); // 見えない車（QUIT・切れた）は、Star・回る甲羅があっても当たらない
  karts.forEach((a, i) => {
    if (!(a.star > 0) || a.auto || hidden(i)) return;
    karts.forEach((b, j) => {
      if (j === i || !world.owns(j) || hidden(j) || b.star > 0 || b.auto || b.blast > 0 || b.respawn > 0) return;
      if (Math.abs((a.y ?? 0) - (b.y ?? 0)) > 1.5 || Math.hypot(a.x - b.x, a.z - b.z) >= KART_RADIUS * 2 + 0.2) return;
      if (startBlast(b, world.track)) out.push({ type: 'blast', k: j, by: i });
    });
  });
  // 回っている緑の甲羅に、ほかの車がふれたら、甲羅に当たったのと同じ（吹き飛ぶ。甲羅は1つ消える。2026-10-22 のユーザー依頼）
  karts.forEach((a, i) => {
    if (!a.orbit?.length || a.auto || a.respawn > 0 || hidden(i)) return;
    for (let n = a.orbit.length - 1; n >= 0; n--) {
      const ang = a.orbitAngle + (a.orbit[n] * 2 * Math.PI) / 3;
      const sx = a.x + Math.cos(ang) * ITEM.ORBIT_R;
      const sz = a.z + Math.sin(ang) * ITEM.ORBIT_R;
      const j = karts.findIndex((b, jj) => jj !== i && world.owns(jj) && !hidden(jj) && !b.auto && !(b.respawn > 0) && !b.swallowed && !(b.blast > 0) && Math.abs((a.y ?? 0) - (b.y ?? 0)) < 2 && Math.hypot(b.x - sx, b.z - sz) < KART_RADIUS + SHELL.R);
      if (j < 0) continue;
      const b = karts[j];
      const sIdx = a.orbit[n];
      a.orbit.splice(n, 1);
      out.push({ type: 'orbitHit', k: j, o: i, s: sIdx });
      if (b.star > 0) {
        out.push({ type: 'starBlock', k: j });
        continue;
      }
      const by = guard(b, Math.atan2(sz - b.z, sx - b.x), true);
      if (by) out.push({ type: 'blocked', k: j, by });
      else if (startBlast(b, world.track)) out.push({ type: 'blast', k: j, by: i });
    }
  });
  return out;
}

// 対戦: ほかの端末から届いた出来事を、送った順（at）に効かせる。甲羅は lagOf(ev) 秒だけ先へ進める（M4-C2）
// 進める間に、この端末の車に当たったもの（stepItems の当たりと同じ形・番号付き）を返す。itemFrame の hits に足して送る
export function applyRemoteItems(world, karts, queue, f, lagOf) {
  const hits = [];
  for (const ev of [...queue].sort((a, b) => a.at - b.at)) {
    applyItemEvent(world, karts, { ...ev, t: f.t }, f);
    const s = world.shells.find((sh) => sh.id === ev.id);
    if (s) hits.push(...advanceShell(world, s, karts, lagOf(ev)));
  }
  return hits;
}

// 1フレームのアイテム: ボタン（自分は f.press、CPU は f.cpuPress(k)）→ 箱・ルーレット・当たり
export function itemFrame(world, karts, f, dt) {
  const events = [];
  karts.forEach((kart, k) => {
    const pressed = k === f.me ? f.press : f.cpuPress(k);
    if (!pressed) return;
    const ev = itemPress(world, karts, k, f);
    if (ev) events.push(ev);
  });
  const hits = stepItems(world, karts, f, dt);
  return { events, hits };
}

// Star の車は、障害物（牛・バス・イノシシ・雪だるま・木・橋脚・木の実・ぬかるみ）に当たっても、スピン・転がり・入れ替わりにならない
// 障害物の当たりを見る前の様子をとっておき（starGuard）、見たあとで、Star の車だけ元にもどす（starRestore）
export function starGuard(karts) {
  return karts.map((k) => (k.star > 0 ? { spin: k.spin, tumble: k.tumble, speed: k.speed, heading: k.heading, move: k.move, muddy: k.muddy ?? 0 } : null));
}
export function starRestore(karts, saved) {
  karts.forEach((k, i) => {
    const s = saved[i];
    if (!s) return;
    if (k.spin > s.spin || k.tumble > s.tumble) Object.assign(k, { spin: s.spin, tumble: s.tumble, speed: s.speed, heading: s.heading, move: s.move ?? k.move });
    if ((k.muddy ?? 0) > s.muddy) k.muddy = s.muddy;
  });
}

// 今ぶつかっている組（pushApart が返す 'a-b'）のうち、小さい車が大きい車にぶつかったものをぺしゃんこにする。つぶれた車の番号を返す
export function squashContacts(karts, contacts, owns = () => true) {
  const out = [];
  const big = (k) => !(karts[k].smallTime > 0);
  for (const key of contacts) {
    const [a, b] = key.split('-').map(Number);
    if (big(a) && owns(b) && squashKart(karts[b])) out.push(b);
    else if (big(b) && owns(a) && squashKart(karts[a])) out.push(a);
  }
  return out;
}
