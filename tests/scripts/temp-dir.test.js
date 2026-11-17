import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const helper = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/temp-dir.mjs');
const run = (body, extra = {}) => spawnSync(process.execPath, ['--input-type=module', '-e', `import { tempDir } from ${JSON.stringify(helper)}; const d = tempDir('tempdir-test-'); fs_write(d); ${body}`.replace('fs_write(d);', "await import('node:fs').then(f => f.writeFileSync(d + '/x', '1')); console.log(d);")], { encoding: 'utf8', ...extra });
const made = result => result.stdout.trim().split('\n')[0];

test('a folder from tempDir is gone after a normal exit', () => {
  const dir = made(run(''));
  assert.match(dir, /tempdir-test-/);
  assert.equal(fs.existsSync(dir), false);
});

test('a folder from tempDir is gone after an uncaught error', () => {
  const result = run("throw new Error('boom');");
  assert.notEqual(result.status, 0);
  assert.equal(fs.existsSync(made(result)), false);
});

test('a folder from tempDir is gone after process.exit with a failing code', () => {
  const result = run('process.exit(3);');
  assert.equal(result.status, 3);
  assert.equal(fs.existsSync(made(result)), false);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  test(`a folder from tempDir is gone after ${signal}`, async () => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', `import { tempDir } from ${JSON.stringify(helper)}; console.log(tempDir('tempdir-test-')); setInterval(() => {}, 1000);`], { stdio: ['ignore', 'pipe', 'inherit'] });
    const dir = await new Promise(resolve => child.stdout.once('data', chunk => resolve(String(chunk).trim())));
    assert.equal(fs.existsSync(dir), true);
    const closed = new Promise(resolve => child.once('close', resolve));
    child.kill(signal);
    await closed;
    assert.equal(fs.existsSync(dir), false);
  });
}
