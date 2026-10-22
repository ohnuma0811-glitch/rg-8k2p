import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';

test('Emulator が動き、ルールが読める（何も読めない）', async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-race', database: { rules: readFileSync('database.rules.json', 'utf8'), host: '127.0.0.1', port: 9000 } });
  await assertFails(env.unauthenticatedContext().database().ref('anything').once('value'));
  await env.cleanup();
});
