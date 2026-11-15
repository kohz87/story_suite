import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseModule } from '../../scripts/codemap/parse-module.mjs';
import { blankLiterals } from '../../scripts/codemap/blank-literals.mjs';

const names = src => parseModule(src).exports.map(e => e.name);

test('five exports on one line are all counted', () => {
  const src = 'export const a=1; export const b=2; export const c=3; export const d=4; export const e=5;';
  assert.deepEqual(names(src), ['a', 'b', 'c', 'd', 'e']);
});

test('a regex literal with ; and , does not split a declaration', () => {
  assert.deepEqual(names('export const a=/;/, b=1, c=2, d=3, e=4;'), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(names('export const r = /[;,/]+/g, s = 1;'), ['r', 's']);
});

test('division is not mistaken for a regex', () => {
  assert.deepEqual(names('const x = a / b / c;\nexport const y = 4 / 2, z = 1;'), ['y', 'z']);
});

test('a template literal containing export text is not code', () => {
  const src = 'const t = `x\nexport function phantom() {}\n`;\nexport const real = 1;';
  assert.deepEqual(names(src), ['real']);
});

test('template expressions nest and stay code', () => {
  const src = 'const t = `a ${ `b ${ {x: 1}.x } }` + "}" } c`;\nexport const k = `${1}`;';
  assert.deepEqual(names(src), ['k']);
  assert.deepEqual(parseModule('const t = `${await import("./in-tpl.js")}`;').imports, ['./in-tpl.js']);
});

test('a string that looks like an import creates no edge', () => {
  const src = "const s = \"import('./ghost.js')\";\nconst t = 'import x from \"./ghost2.js\"';\nimport('./real.js');";
  assert.deepEqual(parseModule(src).imports, ['./real.js']);
});

test('property and method names called export are not exports', () => {
  const src = 'const o = { export: 1 };\no.export = 2;\nclass C { export() {} }\nexport const z = 1;';
  assert.deepEqual(names(src), ['z']);
});

test('CommonJS exports are reported as unknown so they cannot dodge the limit', () => {
  const object = parseModule('module.exports = { a, b, c, d, e };').exports;
  assert.equal(object.length, 5);
  assert.ok(object.every(e => e.kind === 'unknown'));
  assert.equal(parseModule('module.exports = fn;').exports[0].kind, 'unknown');
  assert.equal(parseModule('exports.foo = 1;\nexports.bar = 2;').exports.length, 2);
  assert.equal(parseModule('module.exports.a = 1;').exports.length, 1);
});

test('blankLiterals keeps length and line breaks', () => {
  const src = "a = 'x';\n/* c\nd */ b = `t\nu`; // e\nr = /a\\/b/g;";
  const out = blankLiterals(src);
  assert.equal(out.length, src.length);
  assert.equal(out.split('\n').length, src.split('\n').length);
  assert.equal(out.includes('x'), false);
  assert.equal(out.includes('t\n'), false);
});
