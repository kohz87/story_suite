import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deadExportProblems, parseEntries } from '../../scripts/b4/dead-exports.mjs';

const tree = {
  'old/a.js': 'export const a = 1;\nexport const b = 2;',
  'old/deep/c.js': 'export const c = 3;',
  'keep/ok.js': "import { z } from './z.js';\nexport const k = z;",
  'keep/z.js': 'export const z = 1;',
};
const fileSet = new Set(Object.keys(tree));
const run = (entriesText, extra) => {
  const files = Object.entries({ ...tree, ...extra }).map(([path, text]) => ({ path, text }));
  return deadExportProblems(parseEntries(entriesText), files, new Set([...fileSet, ...Object.keys(extra)]));
};

test('parseEntries reads paths, dirs and path#name, skipping comments', () => {
  const e = parseEntries('# c\n\nold/a.js\nold/deep/\nold/b.js#x\n');
  assert.deepEqual([...e.files], ['old/a.js']);
  assert.deepEqual(e.dirs, ['old/deep/']);
  assert.deepEqual([...e.names.get('old/b.js')], ['x']);
});

test('a clean removal has no problems', () => {
  assert.deepEqual(run('old/a.js\nold/deep/', {}), { problems: [], byHand: [] });
});

test('static import, re-export, dynamic import string and new URL are each caught', () => {
  const kinds = {
    'keep/s.js': "import { a } from '../old/a.js';",
    'keep/r.js': "export * from '../old/a.js';",
    'keep/d.js': "const m = await import('../old/a.js');",
    'keep/u.js': "const u = new URL('../old/a.js', import.meta.url);",
    'keep/q.js': 'import "../old/deep/c";',
  };
  const { problems } = run('old/a.js\nold/deep/', kinds);
  assert.deepEqual(problems.map(p => p.split(':')[0]).sort(), ['keep/d.js', 'keep/q.js', 'keep/r.js', 'keep/s.js', 'keep/u.js']);
});

test('a directory index import and a css url() are caught', () => {
  const { problems } = run('old/deep/', { 'old/deep/index.js': '', 'keep/i.js': "import '../old/deep';", 'keep/s.css': 'a{background:url(../old/deep/c.js)}' });
  assert.deepEqual(problems.map(p => p.split(':')[0]).sort(), ['keep/i.js', 'keep/s.css']);
});

test('files inside the removal are not checked, and a lookalike path is not a hit', () => {
  const { problems } = run('old/a.js', { 'keep/near.js': "import '../old/a.jsx';", 'old/a.js': "import './a.js';" });
  assert.deepEqual(problems, []);
});

test('path#name fails only for importers of that name (or a namespace) and for re-exports of it', () => {
  const kept = {
    'keep/n.js': "import { b } from '../old/a.js';",
    'keep/m.js': "import { a } from '../old/a.js';",
    'keep/ns.js': "import * as all from '../old/a.js';",
    'keep/re.js': "export { b as bee } from '../old/a.js';",
  };
  const { problems } = run('old/a.js#b', kept);
  assert.deepEqual(problems.map(p => p.split(':')[0]).sort(), ['keep/n.js', 'keep/ns.js', 'keep/re.js']);
  assert.match(problems.join('\n'), /removed export old\/a\.js#b/);
});

test('computed specifiers are listed for a hand grep, literal ones are not', () => {
  const { byHand } = run('old/a.js#b', {
    'keep/c1.js': 'const m = await import(`../old/${name}.js`);',
    'keep/c2.js': 'const m = await import(path);',
    'keep/c3.js': 'const u = new URL(rel, import.meta.url);',
    'keep/lit.js': "const m = await import('./z.js'); const u = new URL('./z.js', import.meta.url);",
  });
  assert.deepEqual(byHand.sort(), ['keep/c1.js', 'keep/c2.js', 'keep/c3.js']);
});
