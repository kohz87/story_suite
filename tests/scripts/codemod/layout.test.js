import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { listTracked, loadLayoutRules, main, planLayout } from '../../../scripts/codemod/cli.mjs';
import { planProblems } from '../../../scripts/codemod/plan.mjs';
import { ruleKey } from '../../../scripts/codemod/rules.mjs';

const root = path.resolve(import.meta.dirname, '../../..');
const AREAS = ['core', 'director', 'legacy-ui', 'packs', 'people', 'rpg', 'scene-inventory', 'shared'];

function sink() {
  const chunks = [];
  return { write(text) { chunks.push(String(text)); }, get text() { return chunks.join(''); } };
}

// One representative tracked path per rule: a file path stays as it is, a folder gets a sample file inside it,
// and a name prefix gets a sample name after the prefix. The sample is only for planning, never written.
function sample(rule, tag) {
  if (rule.from.endsWith('*')) return `${rule.from.slice(0, -1)}sample-${tag}.js`;
  return /\.[a-z0-9]+$/i.test(rule.from) ? rule.from : `${rule.from}/sample-${tag}.js`;
}

function samples(sets) {
  return [...new Set(sets.flatMap(set => set.rules.map((rule, index) => sample(rule, `${set.area}-${index}`))))];
}

test('the eight layout rule files load and validate', () => {
  const sets = loadLayoutRules();
  assert.deepEqual(sets.map(set => set.area).sort(), [...AREAS].sort());
  for (const set of sets) {
    assert.ok(set.rules.length > 0, `${set.area} has no rules`);
    assert.deepEqual(set.scope, ['packages'], `${set.area} does not scope the move to packages/`);
  }
});

test('no rule name is claimed by two areas', () => {
  const owner = new Map();
  for (const set of loadLayoutRules()) {
    for (const rule of set.rules) {
      const key = ruleKey(rule);
      assert.equal(owner.get(key), undefined, `${key} is claimed by ${owner.get(key)} and ${set.area}`);
      owner.set(key, set.area);
    }
  }
});

test('plan --all on a toy tree covers every sample once and prints the area table', async () => {
  const sets = loadLayoutRules();
  const files = samples(sets);
  const { plan, counts } = planLayout(files, sets);
  assert.deepEqual(plan.unmatched, []);
  assert.deepEqual(planProblems(plan), []);
  assert.equal(plan.moves.length + plan.deletes.length, files.length);
  assert.ok(Object.values(counts).every(row => row.moves + row.deletes > 0));
  const stdout = sink();
  const stderr = sink();
  const code = await main(['plan', '--all'], { listFiles: async () => files, stdout, stderr });
  assert.equal(code, 0, stderr.text);
  assert.match(stdout.text, /area\s+moves\s+deletes/);
  for (const area of AREAS) assert.match(stdout.text, new RegExp(`^${area}\\s+\\d+\\s+\\d+$`, 'm'));
  assert.match(stdout.text, /unmatched: none/);
});

test('plan --area prints that area and still reports a file no rule covers', async () => {
  const sets = loadLayoutRules();
  const files = samples(sets);
  const stdout = sink();
  const stderr = sink();
  assert.equal(await main(['plan', '--area', 'core'], { listFiles: async () => files, stdout, stderr }), 0);
  assert.match(stdout.text, /^core: \d+ moves, \d+ deletes$/m);
  assert.match(stdout.text, /unmatched: none/);
  const bad = sink();
  const badErrors = sink();
  const code = await main(['plan', '--all'], {
    listFiles: async () => [...files, 'packages/unknown/file.js'],
    stdout: bad,
    stderr: badErrors,
  });
  assert.equal(code, 1);
  assert.match(bad.text, /unmatched \(1\):\n  packages\/unknown\/file\.js/);
  assert.match(badErrors.text, /no rule covers packages\/unknown\/file\.js/);
});

test('the tracked tree on main is covered once with no plan problems', () => {
  const sets = loadLayoutRules();
  const files = listTracked(root);
  const { plan, counts } = planLayout(files, sets);
  assert.deepEqual(plan.unmatched, []);
  assert.deepEqual(planProblems(plan), []);
  assert.ok(files.length > 6000, `expected the real tree, found ${files.length} files`);
  for (const area of AREAS) assert.ok(counts[area].moves + counts[area].deletes > 0, `${area} planned nothing`);
});
