import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { main } from '../../../scripts/codemod/cli.mjs';
import { loadKnownProblems, splitKnown } from '../../../scripts/codemod/known.mjs';
import { tempDir } from '../../../scripts/temp-dir.mjs';

const AREAS = ['core', 'director', 'legacy-ui', 'packs', 'people', 'rpg', 'scene-inventory', 'shared'];
const PROBLEM = 'plan deletes packages/a/deleted.json, still imported by packages/a/keep.js';

function sink() {
  return { text: '', write(chunk) { this.text += chunk; } };
}

function repo(dir) {
  const rulesDir = path.join(dir, 'rules');
  fs.mkdirSync(rulesDir);
  for (const area of AREAS) {
    const rules = area === 'core'
      ? [{ from: 'packages/a/keep.js', to: 'core/keep.js' }, { from: 'packages/a/deleted.json', to: null }]
      : [];
    fs.writeFileSync(path.join(rulesDir, `${area}.rules.json`), JSON.stringify({ area, scope: ['packages'], rules }));
  }
  fs.mkdirSync(path.join(dir, 'packages/a'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'packages/a/keep.js'), "const pkg = new URL('./deleted.json', import.meta.url);\n");
  fs.writeFileSync(path.join(dir, 'packages/a/deleted.json'), '{}\n');
  return rulesDir;
}

async function run(known, extraFiles = []) {
  const dir = tempDir('known-plan-');
  try {
    const rulesDir = repo(dir);
    const knownFile = path.join(dir, 'known.txt');
    fs.writeFileSync(knownFile, known);
    const files = ['packages/a/deleted.json', 'packages/a/keep.js', ...extraFiles];
    const stdout = sink();
    const stderr = sink();
    const code = await main(['plan', '--all', '--known', knownFile], { root: dir, rulesDir, listFiles: async () => files, stdout, stderr });
    return { code, stdout: stdout.text, stderr: stderr.text };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('a plan whose only problem is listed passes and says so as a warning', async () => {
  const result = await run(`# comment\n\n${PROBLEM}\n`);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /known problem \(listed in .*\): plan deletes packages\/a\/deleted\.json/);
  assert.equal(result.stderr, '');
});

test('an unlisted problem still fails, and the listed one does not hide it', async () => {
  const result = await run(`${PROBLEM}\n`, ['packages/a/new.js']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /plan problems \(1\):\n {2}no rule covers packages\/a\/new\.js/);
  const unlisted = await run('# nothing listed\n');
  assert.equal(unlisted.code, 1);
  assert.match(unlisted.stderr, /still imported by packages\/a\/keep\.js/);
});

test('a listed line that no longer occurs is a warning, not a failure', () => {
  assert.deepEqual(splitKnown(['x'], ['x', 'y']), { fresh: [], seen: ['x'], stale: ['y'] });
  assert.deepEqual(splitKnown(['z'], []), { fresh: ['z'], seen: [], stale: [] });
});

test('the shipped list is empty: no plan problem is expected', () => {
  assert.deepEqual(loadKnownProblems(path.resolve(import.meta.dirname, '../../../docs/merge/layout-known-problems.txt')), []);
});
