import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listTracked, loadLayoutRules, main, planLayout } from '../../../scripts/codemod/cli.mjs';
import { buildPlan, planProblems } from '../../../scripts/codemod/plan.mjs';
import { matchPath, ruleKey } from '../../../scripts/codemod/rules.mjs';

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

test('a delete still imported by a kept file fails the plan; a deleted importer does not', () => {
  const ruleSets = [{
    area: 'core',
    scope: ['packages'],
    rules: [
      { from: 'packages/a/keep.js', to: 'core/keep.js' },
      { from: 'packages/a/also-kept.js', to: 'core/also-kept.js' },
      { from: 'packages/a/deleted.js', to: null },
      { from: 'packages/a/dropped.test.js', to: null },
    ],
  }];
  const files = ['packages/a/keep.js', 'packages/a/also-kept.js', 'packages/a/deleted.js', 'packages/a/dropped.test.js'];
  const sources = new Map([
    ['packages/a/keep.js', "import { value } from './deleted.js';\n"],
    ['packages/a/also-kept.js', "export { value } from './deleted.js';\n"],
    ['packages/a/dropped.test.js', "import { value } from './deleted.js';\n"],
  ]);
  const plan = buildPlan(files, ruleSets);
  assert.deepEqual(planProblems(plan, { files: new Set(files), readFile: file => sources.get(file) ?? '' }), [
    'plan deletes packages/a/deleted.js, still imported by packages/a/also-kept.js, packages/a/keep.js',
  ]);
});

test('a URL read of a deleted file fails the plan and a non-literal URL is a warning', () => {
  const ruleSets = [{
    area: 'core',
    scope: ['packages'],
    rules: [
      { from: 'packages/a/keep.js', to: 'core/keep.js' },
      { from: 'packages/a/other.js', to: 'core/other.js' },
      { from: 'packages/a/deleted.json', to: null },
    ],
  }];
  const files = ['packages/a/keep.js', 'packages/a/other.js', 'packages/a/deleted.json'];
  const sources = new Map([
    ['packages/a/keep.js', "const pkg = new URL('./deleted.json', import.meta.url);\n"],
    ['packages/a/other.js', "const rel = 'deleted.json';\nconst pkg = new URL(`./${rel}`, import.meta.url);\n"],
  ]);
  const warnings = [];
  assert.deepEqual(planProblems(buildPlan(files, ruleSets), {
    files: new Set(files),
    readFile: file => sources.get(file) ?? '',
    warnings,
  }), [
    'plan deletes packages/a/deleted.json, still imported by packages/a/keep.js',
  ]);
  assert.deepEqual(warnings, [
    'packages/a/other.js:2: non-literal URL reference cannot be checked against planned deletes',
  ]);
});

test('the plan CLI lists non-literal URL references as warnings without hiding a literal URL problem', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b3p2-plan-'));
  try {
    const rulesDir = path.join(dir, 'rules');
    fs.mkdirSync(rulesDir);
    for (const area of AREAS) {
      const rules = area === 'core'
        ? [
          { from: 'packages/a/keep.js', to: 'core/keep.js' },
          { from: 'packages/a/other.js', to: 'core/other.js' },
          { from: 'packages/a/deleted.json', to: null },
        ]
        : [];
      fs.writeFileSync(path.join(rulesDir, `${area}.rules.json`), JSON.stringify({ area, scope: ['packages'], rules }));
    }
    fs.mkdirSync(path.join(dir, 'packages/a'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'packages/a/keep.js'), "const pkg = new URL('./deleted.json', import.meta.url);\n");
    fs.writeFileSync(path.join(dir, 'packages/a/other.js'), "const rel = 'deleted.json';\nconst pkg = new URL(`./${rel}`, import.meta.url);\n");
    fs.writeFileSync(path.join(dir, 'packages/a/deleted.json'), '{}\n');
    const files = ['packages/a/deleted.json', 'packages/a/keep.js', 'packages/a/other.js'];
    const stdout = sink();
    const stderr = sink();
    const code = await main(['plan', '--all'], { root: dir, rulesDir, listFiles: async () => files, stdout, stderr });
    assert.equal(code, 1);
    assert.match(stdout.text, /plan warnings \(1 warning\):\n  packages\/a\/other\.js:2: non-literal URL reference cannot be checked against planned deletes/);
    assert.match(stderr.text, /plan deletes packages\/a\/deleted\.json, still imported by packages\/a\/keep\.js/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('dead rules are warnings in the plan output and do not fail it', async () => {
  const sets = loadLayoutRules();
  const all = samples(sets);
  const dead = sets.find(set => set.area === 'core').rules[0];
  const omitted = sample(dead, 'core-0');
  const stdout = sink();
  const stderr = sink();
  const code = await main(['plan', '--all'], {
    listFiles: async () => all.filter(file => file !== omitted),
    stdout,
    stderr,
  });
  assert.equal(code, 0, stderr.text);
  assert.match(stdout.text, /dead rules \(1 warning\):\n  core: packages\/story-block\/src\/v2\/runtime matches no tracked file/);
});

test('the rules delete only manifests dead at the move PR and keep later removals movable', () => {
  const rules = loadLayoutRules().flatMap(set => set.rules);
  const deletes = rules.filter(rule => rule.to === null).map(rule => rule.from).sort();
  assert.deepEqual(deletes, [
    'packages/npc-state-delta/package.json',
    'packages/story-director/package.json',
  ]);
  assert.equal(matchPath(rules, 'packages/story-block/package.json').to, 'docs/history/packages/story-block/package.json', 'the move parks it under docs/history; the layout switch then removes it (its readers use the root package.json)');
  const target = file => matchPath(rules, file).to;
  assert.equal(target('packages/story-block/index.js'), 'core/boot/boot.js');
  assert.equal(target('packages/story-block/src/v2/shared/redraw.js'), 'ui/legacy/shared/redraw.js');
  assert.equal(target('packages/story-director/index.js'), 'ui/legacy/director/index.js');
  assert.equal(target('packages/story-director/src/v2/module/shared.js'), 'ui/legacy/director/module/shared.js');
  for (const file of [
    'modules/people/legacy/story-block-tabs.js',
    'modules/people/legacy/runtime-suite.js',
    'modules/people/legacy/suite.js',
    'modules/people/legacy/suite-handshake.js',
    'modules/people/legacy/branch-core.js',
    'modules/people/legacy/checkpoint-pack.js',
    'modules/people/legacy/runtime-persist.js',
    'modules/people/legacy/runtime-branch.js',
    'modules/people/legacy/runtime-reconcile.js',
    'modules/people/legacy/storysuite-participant/timeline.js',
  ]) assert.match(target(file), /^modules\/people\/legacy\//, `${file} must move to legacy`);
});

test('longer people prefixes win over their broader catch-alls', () => {
  const rules = loadLayoutRules().flatMap(set => set.rules);
  const cases = [
    ['modules/people/portrait/core-portrait.js', 'modules/people/portrait/core-portrait.js'],
    ['modules/people/core/core-mechanics.js', 'modules/people/core/core-mechanics.js'],
    ['modules/people/core/identity.js', 'modules/people/core/identity.js'],
    ['packages/npc-state-delta/style-settings.css', 'modules/people/legacy/style-settings.css'],
    ['modules/people/calls/runtime-scan-helpers.js', 'modules/people/calls/runtime-scan-helpers.js'],
    ['packages/npc-state-delta/runtime-entry.js', 'modules/people/runtime/runtime-entry.js'],
    ['modules/people/legacy/story-block-tabs.js', 'modules/people/legacy/story-block-tabs.js'],
    ['modules/people/legacy/branch-core.js', 'modules/people/legacy/branch-core.js'],
  ];
  for (const [file, expected] of cases) assert.equal(matchPath(rules, file).to, expected, file);
});

test('the real tree passes the required plan checks and tolerates an unmatched lane file', () => {
  const sets = loadLayoutRules();
  const files = listTracked(root);
  const laneFile = 'packages/story-block/lane-added.test.js';
  const laneFiles = [...files, laneFile];
  const { plan, counts } = planLayout(laneFiles, sets);
  assert.ok(plan.unmatched.includes(laneFile), 'a new package file is still reported as unmatched');
  const knownM2 = 'plan deletes packages/story-block/package.json, still imported by packages/story-block/testkit/matrix/report.js, packages/story-block/tests/v2/bootstrap.test.js';
  const problems = planProblems({ ...plan, unmatched: [] }, {
    files: new Set(laneFiles),
    readFile: file => fs.readFileSync(path.join(root, file), 'utf8'),
  });
  assert.deepEqual(problems.filter(problem => problem !== knownM2), []);
  assert.ok(files.length > 5000, `expected the real tree, found ${files.length} files`);
  // An area whose files have all moved has nothing left to plan; it still has its counts (zero), but never a negative or missing one.
  for (const area of AREAS) assert.ok(counts[area].moves + counts[area].deletes >= 0, `${area} has no counts`);
});
