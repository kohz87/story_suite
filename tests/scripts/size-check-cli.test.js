import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const cli = path.resolve(import.meta.dirname, '../../scripts/checks/run-size-check.mjs');
const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

test('--base with an empty value or no value is an error', () => {
  for (const args of [['--base', ''], ['--base']]) {
    const r = run(args);
    assert.equal(r.status, 1, args.join(' '));
    assert.match(r.stderr, /--base needs a git ref/);
  }
});
