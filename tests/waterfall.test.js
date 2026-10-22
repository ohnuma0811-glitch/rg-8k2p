import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { COURSE3 } from '../src/data/tracks.js';
import { buildWaterfall, fallsStreaks, FALL_SPEED } from '../src/render/forest/water.js';

// 2026-10-23 のユーザー依頼「滝が流れているように見えない。水の流れを表現して」
test('滝の水は、白いすじの模様が下へ流れる（時間で模様がずれる）', () => {
  const g = buildWaterfall(buildTrack(COURSE3));
  const fall = g.children.find((o) => o.userData.kind === 'falls');
  assert.ok(fall, '滝の水の板');
  assert.ok(FALL_SPEED > 0.5, `流れる速さ ${FALL_SPEED}`);
  const a = fall.userData.flow(0);
  const b = fall.userData.flow(0.5);
  assert.notEqual(a, b, '時間で模様がずれる');
  const streaks = fallsStreaks(7);
  assert.ok(streaks.length >= 12, 'すじがたくさん');
  assert.ok(streaks.every((s) => s.len > 0 && s.x >= 0 && s.x <= 1));
});
