import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, makeMapper, planProblems, trackedFiles } from '../../scripts/codemod/plan.mjs';
import { parseRules } from '../../scripts/codemod/rules.mjs';
import { TOY, TOY_RULES, toyRepo } from './codemod-toy.js';

const rules = parseRules(TOY_RULES);

test('plans moves for every tracked file and nothing for unrelated ones', () => {
  const files = trackedFiles(toyRepo({ ...TOY, 'README.md': 'x\n' }));
  const plan = buildPlan(files, [rules]);
  assert.equal(plan.moves.length, 7);
  assert.deepEqual(planProblems(plan), []);
  assert.deepEqual(plan.moves.find(move => move.from === 'pkg/src/store-parts/a.js'), { from: 'pkg/src/store-parts/a.js', to: 'core/store-parts/a.js' });
});

test('an unmatched file under the scope is refused, one outside it is ignored', () => {
  const plan = buildPlan(['pkg/other.js', 'docs/x.md'], [rules]);
  assert.deepEqual(plan.unmatched, ['pkg/other.js']);
  assert.match(planProblems(plan)[0], /no rule covers pkg\/other\.js/);
});

test('collisions and clobbered targets are refused, deletes are listed', () => {
  const two = parseRules({ area: 'k', rules: [{ from: 'a/x', to: 'z/x' }, { from: 'b/x', to: 'z/x' }, { from: 'c', to: 'd' }, { from: 'gone', to: null }] });
  const plan = buildPlan(['a/x/f.js', 'b/x/f.js', 'c/f.js', 'd/f.js', 'gone/g.js'], [two]);
  assert.equal(plan.collisions[0].to, 'z/x/f.js');
  const same = buildPlan(['a/x', 'b/x'], [two]);
  assert.equal(same.collisions[0].to, 'z/x');
  assert.deepEqual(plan.existing.map(move => move.to), ['d/f.js']);
  assert.deepEqual(plan.deletes, ['gone/g.js']);
  assert.equal(planProblems(plan).length, 3);
});

test('the mapper gives moved, deleted, folder and unchanged paths', () => {
  const del = parseRules({ area: 'k', rules: [{ from: 'p/a', to: 'q/a' }, { from: 'p/dead', to: null }] });
  const plan = buildPlan(['p/a/f.js', 'p/dead/g.js', 'p/keep.js'], [del]);
  const mapper = makeMapper(plan, [del]);
  assert.equal(mapper.map('p/a/f.js'), 'q/a/f.js');
  assert.equal(mapper.map('p/a'), 'q/a');
  assert.equal(mapper.map('p/dead/g.js'), null);
  assert.equal(mapper.map('p/keep.js'), 'p/keep.js');
});

test('a rename chain and a two-file swap are refused at planning', () => {
  const chain = parseRules({ area: 'k', rules: [{ from: 'p/a.js', to: 'p/b.js' }, { from: 'p/b.js', to: 'p/c.js' }] });
  const plan = buildPlan(['p/a.js', 'p/b.js'], [chain]);
  assert.deepEqual(plan.chains, [{ from: 'p/a.js', to: 'p/b.js' }]);
  assert.match(planProblems(plan).join('\n'), /p\/a\.js moves to p\/b\.js, which is itself moved/);
  const swap = parseRules({ area: 'k', rules: [{ from: 'p/a.js', to: 'p/b.js' }, { from: 'p/b.js', to: 'p/a.js' }] });
  const swapped = buildPlan(['p/a.js', 'p/b.js'], [swap]);
  assert.equal(swapped.chains.length, 2);
  assert.equal(planProblems(swapped).length, 2);
  const free = parseRules({ area: 'k', rules: [{ from: 'p/a.js', to: 'p/b.js' }, { from: 'p/b.js', to: null }] });
  assert.deepEqual(planProblems(buildPlan(['p/a.js', 'p/b.js'], [free])), []);
});
