// TIME TRIAL（2026-10-18 のユーザー依頼）: 1人で3周。コースごとのいちばん速いタイム（その端末に残す）
export function updateBest(bests, course, time) {
  const old = bests[course];
  const record = old === undefined || time < old;
  const next = record ? { ...bests, [course]: time } : bests;
  return { bests: next, best: next[course], record };
}
