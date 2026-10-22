// アイテム（設計書 docs/superpowers/specs/2026-10-22-items-design.md）: 枠・ルーレット・ITEM ボタンの順番・使ったときの効果
// ボタンを押したことは「出来事」（{ type, k, t, ... }）にして applyItemEvent で効かせる（M4 の対戦で、ほかの端末にも同じ出来事を送るため）
import { useMushroom, STAR } from './kart.js';
import { rollItem } from './itemOdds.js';
import { createBoxes, stepBoxes, touchBoxes } from './itemBoxes.js';
import { locate } from './track.js';
import { KART_RADIUS } from './collide.js';

export const ITEM = {
  ROULETTE: 2, // ルーレットが回る秒数
  BANANA_SWAP: 5, // バナナを踏むと、ハンドルの左右が入れ替わる秒数
  LIGHTNING_SWAP: 10, // 稲妻の入れ替わりの秒数
  BANANA_DROP: 3, // バナナを置く所（車の後ろ m）
  BANANA_MAX: 10, // コース全体のバナナの数（超えたら古い物から消える）
  BANANA_R: 0.8, // バナナの大きさ（半径 m）
  BANANA_OWNER_SAFE: 1, // 置いてすぐは、自分では踏まない（秒）
  TRAIL_BACK: 2.4, // ぶら下げたバナナの場所（車の後ろ m）
  ORBIT_R: 2.4, // 回る緑の甲羅の、車の中心からの距離（m）
  ORBIT_SPIN: 5, // 回る速さ（rad/s）
  ZAP_SHOW: 0.5, // 稲妻が見えている秒数
  FLASH_FADE: 4, // 稲妻の白い光が消える速さ（1秒に）
};

// 車にアイテムの性質を足す（レースの最初に1回。コースに戻っても消さない）
export function initItems(kart) {
  Object.assign(kart, { held: null, roulette: 0, rouletteItem: null, orbit: [], orbitAngle: 0, trailing: false, shock: 0, zap: 0 });
}

// レースのアイテムの世界（箱・置かれたバナナ・飛んでいる甲羅）
export function createItemWorld(track) {
  return { track, boxes: createBoxes(track), bananas: [], shells: [], nextId: 1, flash: 0, thunder: 0 };
}

// 新しいアイテムを取れるか（緑の甲羅を回している・バナナをぶら下げているのは、空として扱う）
export function canTake(kart) {
  return !kart.held && !(kart.roulette > 0);
}

// ITEM ボタンが効くか
export function canUse(kart, finished) {
  return !finished && !(kart.blast > 0) && !(kart.tumble > 0) && !kart.auto && !(kart.respawn > 0);
}

// 左右の入れ替え（Banana・Lightning。Soki Forest のぬかるみと同じ kart.muddy）。残りは「今の残り」と「新しい時間」の長い方
// Star の車と、自動の区間の車には効かない
export function swapSteer(kart, time) {
  if (kart.star > 0 || kart.auto) return false;
  kart.muddy = Math.max(kart.muddy ?? 0, time);
  return true;
}

// バナナを置く（車の 3m 後ろの地面）。コース全体で10個まで
function dropBanana(world, kart, k) {
  const x = kart.x - Math.cos(kart.heading) * ITEM.BANANA_DROP;
  const z = kart.z - Math.sin(kart.heading) * ITEM.BANANA_DROP;
  const loc = locate(world.track, x, z, kart.seg, 40, kart.y ?? null);
  world.bananas.push({ id: world.nextId++, owner: k, x, z, y: loc.ground ?? kart.y, age: 0 });
  if (world.bananas.length > ITEM.BANANA_MAX) world.bananas.shift();
}

// 置かれたバナナの当たり。踏んだ車は左右が入れ替わる（Star の車は何も起きない）。どちらでもバナナは消える
function stepBananas(world, karts, dt, out) {
  for (const b of [...world.bananas]) {
    b.age += dt;
    for (let j = 0; j < karts.length; j++) {
      const o = karts[j];
      if (o.auto || o.airborne || o.respawn > 0) continue;
      if (j === b.owner && b.age < ITEM.BANANA_OWNER_SAFE) continue;
      if (Math.abs((o.y ?? 0) - b.y) > 1.5 || Math.hypot(o.x - b.x, o.z - b.z) > ITEM.BANANA_R + KART_RADIUS) continue;
      world.bananas.splice(world.bananas.indexOf(b), 1);
      if (o.star > 0) {
        out.push({ type: 'squash', k: j });
        break;
      }
      swapSteer(o, ITEM.BANANA_SWAP);
      o.bananaHits = (o.bananaHits || 0) + 1;
      out.push({ type: 'banana', k: j });
      break;
    }
  }
}

// ITEM ボタン（設計書 3.1 の順番）。出来事を返す（何もしないときは null）
export function itemPress(world, karts, k, f) {
  const kart = karts[k];
  if (!canUse(kart, f.finished[k])) return null;
  let ev = null;
  if (kart.trailing) ev = { type: 'drop', k, t: f.t };
  else if (kart.roulette > 0) ev = { type: 'stop', k, t: f.t };
  else if (kart.held) ev = { type: 'use', k, t: f.t, item: kart.held, target: null };
  if (ev) applyItemEvent(world, karts, ev, f);
  return ev;
}

// 出来事を効かせる（どの端末でも、同じ出来事から同じように動く）
export function applyItemEvent(world, karts, ev, f) {
  const kart = karts[ev.k];
  if (ev.type === 'drop') {
    kart.trailing = false;
    dropBanana(world, kart, ev.k);
    return;
  }
  if (ev.type === 'stop') {
    kart.roulette = 0;
    kart.held = kart.rouletteItem;
    kart.rouletteItem = null;
  } else if (ev.type === 'use') {
    kart.held = null;
    if (ev.item === 'mushroom') useMushroom(kart, f.params);
    else if (ev.item === 'star') kart.star = STAR.TIME;
    else if (ev.item === 'banana') kart.trailing = true;
  }
}

// 毎フレーム: 箱・ルーレット・時間。起きたこと（音・見た目のため）を返す
export function stepItems(world, karts, f, dt) {
  const out = [];
  stepBoxes(world.boxes, dt);
  karts.forEach((kart, k) => {
    if (kart.roulette > 0) {
      kart.roulette = Math.max(0, kart.roulette - dt);
      if (kart.roulette === 0) {
        kart.held = kart.rouletteItem;
        kart.rouletteItem = null;
        out.push({ type: 'decided', k });
      }
    }
    if (kart.auto || kart.respawn > 0 || f.finished[k]) return;
    if (touchBoxes(world.boxes, kart) && canTake(kart)) {
      kart.rouletteItem = rollItem(f.ranks.indexOf(k) + 1, karts.length, k !== f.me, f.rand());
      kart.roulette = ITEM.ROULETTE;
      kart.boxes = (kart.boxes || 0) + 1;
      out.push({ type: 'box', k });
    }
  });
  stepBananas(world, karts, dt, out);
  return out;
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
