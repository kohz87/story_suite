import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseModule } from '../../scripts/codemap/parse-module.mjs';

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

test('postfix ++ followed by division does not hide later exports', () => {
  const src = 'let n=10; export const a = n++ / 2; export const b=2; export const c=3; export const d=4; export const e=5; const x = 4 / 2;';
  assert.deepEqual(names(src), ['a', 'b', 'c', 'd', 'e']);
});

test('a regex literal after an if condition is not an export', () => {
  const src = 'if (true) /export const phantom=1;/.test("");\nexport const a=1; export const b=2; export const c=3; export const d=4;';
  assert.deepEqual(names(src), ['a', 'b', 'c', 'd']);
});

test('CommonJS programs are flagged, not silently counted', () => {
  for (const src of [
    'Object.assign(exports, {a:1,b:2,c:3,d:4,e:5});',
    'module.exports = {...{a:1,b:2,c:3,d:4,e:5}};',
    'exports.foo = 1;',
    "exports['bar'] = 2;",
    'module.exports.a = 1;',
  ]) assert.equal(parseModule(src).commonJs, true, src);
  assert.equal(parseModule('export const a = 1;').commonJs, false);
});

test('a file that is not a valid module is one unparsable export', () => {
  const { exports: list } = parseModule('export const = ;');
  assert.equal(list.length, 1);
  assert.deepEqual([list[0].name, list[0].kind], ['?', 'unparsable']);
  assert.ok(list[0].signature.length > 0);
  assert.equal(parseModule('const a = 1; with (a) {}').exports[0].kind, 'unparsable');
});

test('namespace re-exports, default declarations and import() order', () => {
  const src = "export * as ns from './n.js';\nexport default class {}\nconst m = import('./b.js');\nimport './a.js';";
  const r = parseModule(src);
  assert.deepEqual(r.exports.map(e => [e.name, e.kind]), [['ns', 'reexport'], ['default', 'default']]);
  assert.deepEqual(r.imports, ['./n.js', './b.js', './a.js']);
  assert.deepEqual(parseModule("export const a = () => import('./deep.js');").imports, ['./deep.js']);
});

test('default expressions are distinct bindings; named declarations keep theirs', () => {
  const loc = src => parseModule(src).exports.map(e => `${e.name}:${e.local}`);
  assert.deepEqual(loc('let a = 1; export default a; export { a };'), ['default:undefined', 'a:a']);
  assert.deepEqual(loc('export default function f() {}'), ['default:f']);
  assert.deepEqual(loc('export default class C {}'), ['default:C']);
  assert.deepEqual(loc('export default function () {}'), ['default:undefined']);
});
