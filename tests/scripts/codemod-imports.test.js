import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteImports } from '../../scripts/codemod/rewrite-imports.mjs';
import { resolveSpecifier, scanSpecifiers } from '../../scripts/codemod/specifiers.mjs';
import { buildPlan, makeMapper } from '../../scripts/codemod/plan.mjs';
import { parseRules } from '../../scripts/codemod/rules.mjs';
import { TOY, TOY_RULES } from './codemod-toy.js';

const rules = parseRules(TOY_RULES);
const files = new Set(Object.keys(TOY));
const mapper = makeMapper(buildPlan([...files], [rules]), [rules]);
const ctxFor = oldFile => ({ oldFile, newFile: mapper.map(oldFile), files, mapper });

test('scanSpecifiers finds static, export-from, dynamic and URL specifiers and lists non-literals', () => {
  const scan = scanSpecifiers("import a from './a.js';\nexport { b } from './b.js';\nexport * from './c.js';\nawait import('./d.js');\nnew URL('./e.css', import.meta.url);\nimport(name);\nnew URL('x', 'y');\n");
  assert.deepEqual(scan.specs.map(item => [item.spec, item.kind]), [['./a.js', 'import'], ['./b.js', 'export'], ['./c.js', 'export'], ['./d.js', 'dynamic'], ['./e.css', 'url']]);
  assert.deepEqual(scan.nonLiteral, [{ kind: 'dynamic', line: 6 }]);
  assert.ok(scanSpecifiers('import {').error);
});

test('resolveSpecifier adds extensions, finds index files, and refuses bare and escaping specifiers', () => {
  const set = new Set(['a/b.js', 'a/c/index.js', 'a/d/x.js']);
  assert.deepEqual(resolveSpecifier('a/z.js', './b', set), { target: 'a/b.js', added: '.js', dir: false });
  assert.equal(resolveSpecifier('a/z.js', './c', set).target, 'a/c/index.js');
  assert.equal(resolveSpecifier('a/z.js', 'node:fs', set), null);
  assert.equal(resolveSpecifier('a/z.js', '../../../x.js', set), null);
  assert.equal(resolveSpecifier('a/z.js', './d', set), null);
  assert.deepEqual(resolveSpecifier('a/z.js', './d', set, true), { target: 'a/d', added: '', dir: true });
});

test('specifiers are resolved against the old place and written against the new one', () => {
  const view = rewriteImports(TOY['pkg/src/ui/view.js'], ctxFor('pkg/src/ui/view.js'));
  assert.equal(view.source, "import { store } from '../../core/store.js';\nconst css = new URL('./view.css', import.meta.url);\nexport const load = () => import('../../core/runtime/run.js');\nexport { store };\n");
  assert.equal(view.changed, 2);
  const test1 = rewriteImports(TOY['pkg/tests/store.test.js'], ctxFor('pkg/tests/store.test.js'));
  assert.match(test1.source, /from '\.\.\/\.\.\/core\/store\.js'/);
  assert.match(test1.source, /new URL\('\.\.\/\.\.\/ui\/legacy\/view\.css', import\.meta\.url\)/);
});

test('rewriting is idempotent and keeps extensionless specifiers extensionless', () => {
  const once = rewriteImports("import x from '../store';\n", ctxFor('pkg/src/ui/view.js'));
  assert.equal(once.source, "import x from '../../core/store';\n");
  const same = rewriteImports(once.source, { ...ctxFor('pkg/src/ui/view.js'), oldFile: 'ui/legacy/view.js', newFile: 'ui/legacy/view.js', files: new Set(['ui/legacy/view.js', 'core/store.js']), mapper: { map: p => p } });
  assert.equal(same.changed, 0);
  assert.equal(same.source, once.source);
});

test('unresolved, removed and non-literal specifiers are reported and left alone', () => {
  const gone = parseRules({ area: 'g', rules: [{ from: 'pkg/src/runtime', to: null }] });
  const goneMapper = makeMapper(buildPlan([...files], [gone]), [gone]);
  const out = rewriteImports("import a from './nope.js';\nimport b from '../runtime/run.js';\nimport(x);\n", { oldFile: 'pkg/src/ui/view.js', newFile: 'pkg/src/ui/view.js', files, mapper: goneMapper });
  assert.deepEqual(out.unresolved.map(item => item.spec), ['./nope.js']);
  assert.deepEqual(out.removed.map(item => item.spec), ['../runtime/run.js']);
  assert.equal(out.nonLiteral.length, 1);
  assert.equal(out.changed, 0);
  assert.ok(rewriteImports('import {', ctxFor('pkg/src/ui/view.js')).error);
});
