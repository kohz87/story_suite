import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchPath, parseRules } from '../../scripts/codemod/rules.mjs';
import { buildPlan, makeMapper, planProblems } from '../../scripts/codemod/plan.mjs';

const prefix = parseRules({ area: 'npc', scope: ['d'], rules: [
  { from: 'd/npc-meters*', to: 'people/meters/npc-meters*' },
  { from: 'd/npc-meters-extra*', to: 'people/extra/npc-meters-extra*' },
  { from: 'd/old*', to: null },
  { from: 'd/sub', to: 'people/sub' },
] });

test('a name-prefix rule takes every name that starts so, and the longest prefix wins', () => {
  assert.equal(matchPath(prefix.rules, 'd/npc-meters.js').to, 'people/meters/npc-meters.js');
  assert.equal(matchPath(prefix.rules, 'd/npc-meters-fill.js').to, 'people/meters/npc-meters-fill.js');
  assert.equal(matchPath(prefix.rules, 'd/npc-meters-parts/a.js').to, 'people/meters/npc-meters-parts/a.js');
  assert.equal(matchPath(prefix.rules, 'd/npc-meters-extra-x.js').to, 'people/extra/npc-meters-extra-x.js');
  assert.equal(matchPath(prefix.rules, 'd/old-thing.js').to, null);
  assert.equal(matchPath(prefix.rules, 'd/npc-other.js'), null);
  assert.equal(matchPath(prefix.rules, 'd/sub/x.js').to, 'people/sub/x.js');
});

test('a prefix rule needs a starred target and one trailing star; x and x* are one name', () => {
  assert.throws(() => parseRules({ area: 'a', rules: [{ from: 'd/x*', to: 'q/x' }] }), /ends in \*/);
  assert.throws(() => parseRules({ area: 'a', rules: [{ from: 'd/x', to: 'q/x*' }] }), /not a name prefix/);
  assert.throws(() => parseRules({ area: 'a', rules: [{ from: 'd/*', to: 'q/*' }] }), /name-prefix/);
  assert.throws(() => parseRules({ area: 'a', rules: [{ from: 'd/x*', to: 'q/x*' }, { from: 'd/x', to: 'q/y' }] }), /duplicate/);
});

test('plan: a prefix rule plans moves and deletes; the same name in two rule files fails the plan', () => {
  const plan = buildPlan(['d/npc-meters.js', 'd/npc-meters-a.js', 'd/old.js', 'd/zzz.js'], [prefix]);
  assert.deepEqual(plan.moves.map(move => move.to), ['people/meters/npc-meters.js', 'people/meters/npc-meters-a.js']);
  assert.deepEqual(plan.deletes, ['d/old.js']);
  assert.deepEqual(plan.unmatched, ['d/zzz.js']);
  assert.equal(makeMapper(plan, [prefix]).map('d/npc-meters-a.js'), 'people/meters/npc-meters-a.js');
  const one = parseRules({ area: 'one', rules: [{ from: 'p/x', to: 'a' }] });
  const two = parseRules({ area: 'two', rules: [{ from: 'p/x', to: 'b' }] });
  const star = parseRules({ area: 'star', rules: [{ from: 'p/x*', to: 'c*' }] });
  for (const sets of [[one, two], [two, one], [one, star]]) {
    const dup = buildPlan(['p/x/f.js'], sets);
    assert.equal(dup.moves.length, 0);
    assert.match(planProblems(dup)[0], /rule "p\/x" is given by more than one rule file/);
  }
  assert.deepEqual(planProblems(buildPlan(['p/x/f.js'], [one])), []);
});

test('matchPath never lets the order of equal-named rules decide', () => {
  const one = parseRules({ area: 'one', rules: [{ from: 'p/x', to: 'a' }] });
  const two = parseRules({ area: 'two', rules: [{ from: 'p/x', to: 'b' }] });
  assert.throws(() => matchPath([...one.rules, ...two.rules], 'p/x/f.js'), /same name/);
});
