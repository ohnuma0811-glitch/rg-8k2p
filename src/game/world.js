import { sampleAt, stageAt } from './track.js?v=cd7c3b4';
// Global City（2026-10-20）: 世界の都市のコースの、動かない決まり
// 景色の群れ（ステージの番号の配列。自動の区間の景色は 'space' 'warp'）が、今見えるか
// 今のステージとその前後だけ（遠くの都市は描かない。軽くするため）。宇宙・ワープの間は、その景色だけ
// win（stageWindow）があれば、前後のステージは、さかいめの近くだけ（遠くの都市が見えた。2026-10-21 のユーザー依頼）
export function stageVisible(groupStages, cur, autoId, win = null) {
  if (autoId === 'space' || autoId === 'warp') return groupStages.includes(autoId);
  if (!win) return groupStages.some((k) => typeof k === 'number' && Math.abs(k - cur) <= 1);
  return groupStages.some((k) => k === cur || (k === cur + 1 && win.next) || (k === cur - 1 && win.prev));
}

// 今のステージと、次のステージに入る 400m 手前か（next）、前のステージを出て 250m までか（prev）
export const STAGE_AHEAD = 400;
export const STAGE_BEHIND = 250;
export function stageWindow(track, rel) {
  const st = track.stages ?? [];
  const cur = stageAt(track, rel);
  const next = st[cur + 1] ? rel > st[cur + 1].s - STAGE_AHEAD : false;
  const prev = cur > 0 ? rel < st[cur].s + STAGE_BEHIND : false;
  return { cur, next, prev };
}

// 自動の区間の景色（Global City）: 宇宙は高さ 150m より上だけ、ワープは3つ目の輪っかを過ぎてから（leg 2）。ほかは null（ふつうのステージの景色）
export function autoViewOf(kart) {
  const a = kart.auto;
  if (!a) return null;
  if (a.id === 'space') return kart.y >= 150 ? 'space' : null;
  if (a.id === 'warp') return a.leg >= 2 ? 'warp' : null;
  return a.id;
}

// 京都へ向かう加速板（新幹線と並走、SK〜KT）で加速しているか（2026-10-21 のユーザー依頼「あっという間に京都についたような演出」）
export function padRush(track, kart) {
  if (!(kart.boost > 0) || track.marks.SK === undefined) return false;
  const s = track.samples[kart.seg].s;
  return s >= track.marks.SK && s <= track.marks.KT;
}

// 自動の区間の進み（0〜1）。宇宙・ワープの演出に使う
export function autoProgress(track, kart) {
  const st = kart.auto;
  if (!st) return 0;
  const a = track.autos.find((x) => x.id === st.id);
  if (!a) return 0;
  const total = a.legs.reduce((s, l) => s + l.time, 0);
  const done = a.legs.slice(0, st.leg).reduce((s, l) => s + l.time, 0);
  return Math.min(1, (done + st.t) / total);
}

// 見せるステージ（Global City）: ふつうは今のステージ。宇宙から下りてくる後半は、着く所（香港）のステージ
// （京都の青空が一瞬出てから香港の夜になった。最後のレビュー）
export function viewStage(track, kart, cur) {
  const st = kart.auto;
  if (st?.id !== 'space') return cur;
  const leg = track.autos.find((a) => a.id === st.id)?.legs[st.leg];
  return leg && st.t > leg.time / 2 ? stageAt(track, leg.to) : cur;
}

// 新幹線（2026-10-20）: 万能タイプの最高速の SHINKANSEN_FACTOR 倍で、線路（道の横 off m、高さ y）を走る。
// 並走の道の加速板（最高速の 1.3倍）なら追いぬける（2026-10-20 のユーザー依頼）
export const SHINKANSEN_FACTOR = 1.12;
// 新幹線の1両ずつ（2026-10-21 のユーザー依頼「真っすぐなままカーブして、レールの外に突き出ている」）:
// 両の前と後ろのはしを線路の上に置き、その真ん中に、前と後ろを結ぶ向きで置く。線路の始まりより後ろの両は見せない（トンネルから出てくる）
export const SHINKANSEN_CAR = 25; // 1両の長さ（m）
export const SHINKANSEN_GAP = 25.5; // 両と両の間かく（m）
// train.t0: 走り出した時刻（自分が線路の始まりに近づいた時。null ならまだ走らず、見せない）。lead: 走り出した時の先頭の s（from から）。
// 線路の終わり（to）まで行っても始まりへ戻らない（戻ると、横を走っているときに急に消えた。2026-10-21 のユーザー依頼）
export function shinkansenCars(track, train, time, topSpeed, cars = 16) {
  if (train.t0 === null || train.t0 === undefined) return Array.from({ length: cars }, () => ({ x: 0, y: train.y, z: 0, heading: 0, visible: false }));
  const head = train.from + (train.lead ?? 0) + topSpeed * SHINKANSEN_FACTOR * Math.max(0, time - train.t0);
  const rail = (s) => {
    const p = sampleAt(track, s);
    return { x: p.x - Math.sin(p.h) * train.off, z: p.z + Math.cos(p.h) * train.off };
  };
  return Array.from({ length: cars }, (_, k) => {
    const sf = head - k * SHINKANSEN_GAP;
    const sb = sf - SHINKANSEN_CAR;
    const f = rail(sf);
    const b = rail(sb);
    return { x: (f.x + b.x) / 2, y: train.y, z: (f.z + b.z) / 2, heading: Math.atan2(f.z - b.z, f.x - b.x), visible: sb >= train.from && sf <= train.to };
  });
}

export function shinkansenPose(track, train, time, topSpeed) {
  const len = train.to - train.from;
  const s = train.from + ((((train.s0 + topSpeed * SHINKANSEN_FACTOR * time - train.from) % len) + len) % len);
  const p = sampleAt(track, s);
  return { x: p.x - Math.sin(p.h) * train.off, y: train.y, z: p.z + Math.cos(p.h) * train.off, heading: p.h };
}
