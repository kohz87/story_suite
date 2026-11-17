// The release gate counts a chunk the entry awaits at start (`eager`) among the requests of the load.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { checkRelease } from '../../scripts/release/check.mjs';
import { tempDir } from '../../scripts/temp-dir.mjs';

const dirs = [];
after(() => { for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true }); });

function fixture() {
  const root = tempDir('release-eager-');
  dirs.push(root);
  const put = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  put('package.json', JSON.stringify({ version: '0.1.0' }));
  put('package-lock.json', JSON.stringify({ version: '0.1.0' }));
  put('shared.js', 'export const shared = 1;\n');
  put('early.js', "import { shared } from './shared.js';\nexport const early = shared + 1;\n");
  put('index.js', "import { shared } from './shared.js';\nexport const start = async () => (await import('./early.js')).early + shared;\n");
  const git = (...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: root, stdio: 'ignore' });
  git('init', '-q'); git('add', '.'); git('commit', '-q', '-m', 'x');
  return root;
}
const run = async (root, set) => {
  const { problems, rows } = await checkRelease({ repoRoot: root, outRoot: path.join(root, 'out'), sets: [{ name: 'x', entries: ['index.js'], ...set }] });
  return { problems: problems.filter(problem => problem.startsWith('x:')), row: rows[0] };
};

test('a chunk listed as lazy is fetched later and not counted; the same chunk listed as eager is one more request', async () => {
  const root = fixture();
  const lazy = await run(root, { lazy: ['early.js'], eager: [] });
  const eager = await run(root, { lazy: [], eager: ['early.js'] });
  assert.deepEqual([lazy.problems, eager.problems], [[], []]);
  assert.equal(eager.row.requests, lazy.row.requests + 1, 'the awaited-at-start chunk is a request of the load');
  assert.equal(lazy.row.lazy, 1);
  assert.equal(eager.row.lazy, 0);
});
