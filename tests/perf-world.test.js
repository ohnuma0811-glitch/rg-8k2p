import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { COURSE5 } from '../src/data/tracks.js';
import { createTurtleModel, mergeStatic } from '../src/render/models.js';
import { buildSea } from '../src/render/world/sea.js';

// World Cities がタブレットで 40fps（香港は 30fps）になった（2026-10-22 のユーザー依頼）: 描く回数を減らす
const t = buildTrack(COURSE5);
const meshes = (o) => { let n = 0; o.traverse((x) => { if (x.isMesh) n++; }); return n; };

test('海の底の亀は、1匹を1つの形で描く（足と頭を別に動かさない）', () => {
  for (let k = 0; k < 7; k++) assert.equal(meshes(mergeStatic(createTurtleModel(k))), 1, `亀 ${k}`);
});

test('海の底の泳ぐ生き物と怪獣は、1匹（1つの群れ）を材質ごとにまとめて描く', () => {
  const g = buildSea(t).children.find((c) => c.userData.swimmers);
  const swimmers = g.children.filter((c) => c.userData.swim || c.userData.watch);
  for (const s of swimmers) assert.ok(meshes(s) <= 6, `${s.userData.watch ? '怪獣' : '泳ぐ生き物'}: ${meshes(s)} 個の形`);
});
