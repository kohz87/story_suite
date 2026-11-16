import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { codePart, moduleRefHits, moduleRefProblems, parseRefList } from '../../scripts/checks/core-module-refs.mjs';

const file = (name, text) => ({ path: name, text });

test('a whole-line comment and a trailing comment do not count; code does', () => {
  assert.equal(codePart('  // the fight board'), '');
  assert.equal(codePart(' * a board note'), '');
  assert.equal(codePart('const a = 1; // board'), 'const a = 1;');
  assert.equal(codePart("const url = 'https://x/board';"), "const url = 'https://x/board';");
});

test('only the core scope is scanned, and the words match in any case', () => {
  const hits = moduleRefHits([
    file('core/turn/a.js', 'const boardStop = 1;\nconst ok = 2;\nstopChangedBoard();'),
    file('core/sdk/b.js', "import { x } from '../../modules/rpg/lean-rpg.js'; // fine"),
    file('modules/rpg/c.js', 'const board = 1;'),
    file('ui/legacy/ui-host/d.js', 'const RPG_START = 1;'),
    file('ui/legacy/screens/e.js', 'const board = 1;'),
    file('core/store/f.js', 'const fight = 1;'),
  ]);
  assert.deepEqual(hits, [
    "core/sdk/b.js :: import { x } from '../../modules/rpg/lean-rpg.js';",
    'core/turn/a.js :: const boardStop = 1;',
    'core/turn/a.js :: stopChangedBoard();',
    'ui/legacy/ui-host/d.js :: const RPG_START = 1;',
  ]);
});

test('an unlisted line, a stale entry and an entry the base lacks are problems', () => {
  const hits = ['core/turn/a.js :: const boardStop = 1;'];
  assert.deepEqual(moduleRefProblems(hits, parseRefList('core/turn/a.js :: const boardStop = 1;')), []);
  assert.match(moduleRefProblems(hits, new Set()).join('\n'), /core\/turn\/a\.js: const boardStop = 1;: a core file names/);
  assert.match(moduleRefProblems([], parseRefList('core/turn/a.js :: const boardStop = 1;')).join('\n'), /no line matches; remove it/);
  const listed = parseRefList('# note\n\ncore/turn/a.js :: const boardStop = 1;\n');
  assert.deepEqual(moduleRefProblems(hits, listed, listed), []);
  assert.match(moduleRefProblems(hits, listed, new Set()).join('\n'), /added to docs\/merge\/core-module-refs\.txt/);
});

test('the real tree matches the list (the script exits 0)', () => {
  const root = path.resolve(import.meta.dirname, '../..');
  execFileSync(process.execPath, [path.join(root, 'scripts/checks/core-module-refs.mjs')], { cwd: root, stdio: 'pipe' });
});
