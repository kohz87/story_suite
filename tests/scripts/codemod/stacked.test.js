import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runApply, runVerify } from '../../../scripts/codemod/area-commands.mjs';
import { occurringStale, splitApplyKnown } from '../../../scripts/codemod/apply-known.mjs';
import { parseRules } from '../../../scripts/codemod/rules.mjs';
import { SET_A, SET_B } from '../codemod-sets.js';
import { SET_TESTS, SET_UI } from '../codemod-three.js';
import { TOY, git, toyRepo } from '../codemod-toy.js';

const sink = () => ({ text: '', write(chunk) { this.text += chunk; } });
const streams = () => ({ stdout: sink(), stderr: sink() });
// pkg/src/KEEP.md stays where it is, so the folder the URL read names still exists once the areas have moved.
const KEEP = { from: 'pkg/src/KEEP.md', to: 'pkg/src/KEEP.md' };
const A = parseRules({ area: 'a', scope: ['pkg'], rules: [...SET_A.rules, KEEP] });
const TWO = [A, SET_B];
const THREE = [A, SET_UI, SET_TESTS];
const FILES = {
  ...TOY,
  'pkg/src/store-parts/dyn.js': "import('./a' + name);\n",
  'pkg/src/ui/dyn.js': "import('./b' + name);\n",
  'pkg/src/ui/bad.js': "import '../../../outside.js';\n",
  'pkg/src/ui/folder.js': "export const here = new URL('..', import.meta.url);\n",
  'pkg/src/KEEP.md': 'keep\n',
  'pkg/tests/dyn.test.js': "import('./c' + name);\n",
};
const ALLOW = ['pkg/src/store-parts/dyn.js', 'pkg/src/ui/dyn.js', 'pkg/tests/dyn.test.js'];
const head = root => git(root, 'rev-parse', 'HEAD').trim();

// Applies the areas in order the way the batch does; returns each area's streams, exit code and commits.
function stack(sets, areas, extra = {}) {
  const root = toyRepo(FILES);
  const runs = areas.map(area => {
    const base = head(root);
    const io = streams();
    const code = runApply(root, sets, area, { dry: false, allowNonLiteral: ALLOW, ...extra, ...io });
    return { area, base, code, io, moves: git(root, 'rev-parse', 'HEAD~1').trim(), rewrites: head(root) };
  });
  return { root, runs };
}

for (const [name, sets, areas] of [['two areas', TWO, ['a', 'b']], ['three areas', THREE, ['a', 'b', 'c']]]) {
  test(`R1, ${name}: an allow-listed file that an earlier area moved is still allow-listed`, () => {
    const { runs } = stack(sets, areas);
    for (const run of runs) assert.equal(run.code, 0, `${run.area}: ${run.io.stderr.text}${run.io.stdout.text}`);
    assert.doesNotMatch(runs.at(-1).io.stdout.text, /non-literal \(not allow-listed\)/);
  });

  test(`R2, ${name}: an earlier area verified at its own tip is not blamed for later areas`, () => {
    const { root, runs } = stack(sets, areas);
    const [first] = runs;
    const opts = { base: first.base, moves: first.moves, rewrites: first.rewrites, codemap: false };
    const blamed = streams();
    assert.equal(runVerify(root, sets, first.area, { ...opts, ...blamed }), 1, 'the working tree at the stack tip is not area a\'s tree');
    assert.match(blamed.stderr.text, /outside\.js/);
    const own = streams();
    assert.equal(runVerify(root, sets, first.area, { ...opts, tip: first.rewrites, ...own }), 0, own.stderr.text);
    for (const run of runs) {
      const io = streams();
      assert.equal(runVerify(root, sets, run.area, { base: run.base, moves: run.moves, rewrites: run.rewrites, tip: run.rewrites, ...io }), 0, `${run.area}: ${io.stderr.text}`);
    }
  });

  test(`R3, ${name}: known test lines are kept when no tests ran; a stale line goes only when its value is gone`, () => {
    const last = areas.at(-1);
    const known = ['test tests/core/store.test.js:1', 'stale pkg/tests/store.test.js node:fs', 'stale pkg/tests/store.test.js gone.js'];
    const { root, runs } = stack(sets, areas.slice(0, -1));
    const io = streams();
    assert.equal(runApply(root, sets, last, { dry: false, allowNonLiteral: ALLOW, known, ...io }), 0, io.stderr.text);
    assert.doesNotMatch(io.stdout.text, /remove it: test /);
    assert.doesNotMatch(io.stdout.text, /remove it: stale pkg\/tests\/store.test.js node:fs/);
    assert.match(io.stdout.text, /remove it: stale pkg\/tests\/store.test.js gone.js/);
    assert.equal(runs.length, areas.length - 1);
  });

  test(`bare-dot folder URL, ${name}: the rewriter and verify agree`, () => {
    const { root, runs } = stack(sets, areas);
    assert.match(git(root, 'show', `${runs[1].rewrites}:ui/legacy/folder.js`), /new URL\('\.\.\/\.\.\/pkg\/src', import\.meta\.url\)/);
    for (const run of runs) {
      const io = streams();
      assert.equal(runVerify(root, sets, run.area, { base: run.base, moves: run.moves, rewrites: run.rewrites, tip: run.rewrites, ...io }), 0, `${run.area}: ${io.stderr.text}`);
    }
  });
}

test('R3: with no tests run no test line is unused; a stale line is unused only without its value', () => {
  const report = { stale: [], plan: { moves: [{ from: 'p/a.test.js', to: 'tests/core/a.test.js' }] } };
  const lines = ['test tests/core/a.test.js:3', 'stale p/a.test.js here', 'stale p/a.test.js gone'];
  assert.deepEqual(splitApplyKnown(report, null, lines, new Set([lines[1]])).unused, [lines[2]]);
  assert.deepEqual(splitApplyKnown(report, { status: 0, output: '' }, lines, new Set(lines.slice(1))).unused, [lines[0]]);
  assert.deepEqual(splitApplyKnown(report, null, lines).unused, [], 'without a way to look, nothing is called unused');
});

test('R3: a stale line is looked for at the file\'s place after earlier areas moved it', () => {
  const { root } = stack(TWO, ['a']);
  const lines = ['stale pkg/src/store.js ./runtime/run.js', 'stale pkg/src/store.js nowhere'];
  assert.deepEqual([...occurringStale(root, TWO, lines)], [lines[0]]);
});

test('a folder named by a plain string (\'../..\') whose index.js moves with it: the rewriter and verify agree', () => {
  const B = parseRules({ area: 'b', scope: ['pkg'], rules: [...SET_B.rules, { from: 'pkg/src/index.js', to: 'ui/legacy/root-index.js' }] });
  const root = toyRepo({ ...FILES, 'pkg/src/index.js': 'export const i = 1;\n', 'pkg/src/ui/deep/helper.js': "export const root = ['x', '../..'];\n" });
  const base = head(root);
  const run = streams();
  assert.equal(runApply(root, [A, B], 'b', { dry: false, allowNonLiteral: ALLOW, ...run }), 0, run.stderr.text);
  assert.match(git(root, 'show', 'HEAD:ui/legacy/deep/helper.js'), /'\.\.\/\.\.\/\.\.\/pkg\/src'/);
  const io = streams();
  assert.equal(runVerify(root, [A, B], 'b', { base, codemap: false, ...io }), 0, io.stderr.text);
});
