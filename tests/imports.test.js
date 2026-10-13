import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const files = (dir) => readdirSync(dir, { withFileTypes: true })
  .flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : d.name.endsWith('.js') ? [join(dir, d.name)] : []));

// importmap は iOS 16.4 より前（古い iPad など）で使えず、画面が真っ白になる
test('Three.js は名前（three）ではなく、ファイルの場所で読む（古い iPad でも動く）', () => {
  for (const f of files('src')) {
    assert.ok(!/from 'three'/.test(readFileSync(f, 'utf8')), f);
  }
  assert.ok(!readFileSync('index.html', 'utf8').includes('importmap'));
});
