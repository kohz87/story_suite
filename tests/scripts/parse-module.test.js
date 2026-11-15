import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseModule } from '../../scripts/codemap/parse-module.mjs';

test('exports: functions with signatures, async, classes, consts, default', () => {
  const src = [
    'export function partyPace({ members = [], transport = [] } = {}) {',
    '  return 1;',
    '}',
    'export async function load(path,\n   opts) { }',
    'export class Store {}',
    'export const LIMIT = 450;',
    'export let counter = 0;',
    'export default function () {}',
  ].join('\n');
  const { exports } = parseModule(src);
  assert.deepEqual(exports.map(e => [e.name, e.kind]), [
    ['partyPace', 'function'], ['load', 'function'], ['Store', 'class'],
    ['LIMIT', 'const'], ['counter', 'const'], ['default', 'default'],
  ]);
  assert.equal(exports[0].signature, 'partyPace({ members = [], transport = [] } = {})');
  assert.equal(exports[1].signature, 'load(path, opts)');
  assert.equal(exports[2].signature, 'class Store');
  assert.equal(exports[3].signature, 'LIMIT');
});

test('export lists, renames and re-exports', () => {
  const src = [
    "const a = 1, b = 2;",
    "export { a, b as beta };",
    "export { kindPace, WALK_PACE } from './kind-pace.js';",
    "export * from './with-party.js';",
  ].join('\n');
  const { exports, imports } = parseModule(src);
  assert.deepEqual(exports.map(e => [e.name, e.kind]), [
    ['a', 'binding'], ['beta', 'binding'], ['kindPace', 'reexport'], ['WALK_PACE', 'reexport'], ['*', 'reexport'],
  ]);
  assert.deepEqual(imports, ['./kind-pace.js', './with-party.js']);
});

test('imports: static, side-effect, dynamic with a string literal; comments ignored', () => {
  const src = [
    "import { x } from './x.js';",
    "import def, * as ns from \"../y/z.mjs\";",
    "import './side.css';",
    "// import { gone } from './commented.js';",
    "/* import { gone2 } from './block.js'; */",
    "const m = await import('./lazy.js');",
    "const url = 'https://example.org/a.js';",
    "import fs from 'node:fs';",
  ].join('\n');
  assert.deepEqual(parseModule(src).imports, ['./x.js', '../y/z.mjs', './side.css', './lazy.js', 'node:fs']);
});

test('an import spread over several lines', () => {
  const src = "import {\n  one,\n  two,\n} from './many.js';\nexport const z = 1;";
  const r = parseModule(src);
  assert.deepEqual(r.imports, ['./many.js']);
  assert.deepEqual(r.exports.map(e => e.name), ['z']);
});

test('no exports and no imports', () => {
  assert.deepEqual(parseModule('const a = 1;\n'), { exports: [], imports: [], commonJs: false });
});

test('generator functions are functions', () => {
  const { exports } = parseModule('export function* g(a) {}\nexport async function* h() {}');
  assert.deepEqual(exports.map(e => [e.name, e.kind, e.signature]), [
    ['g', 'function', 'g(a)'], ['h', 'function', 'h()'],
  ]);
});

test('multi-declarator and destructuring consts count every name', () => {
  const src = [
    'export const a = 1, b = 2;',
    'export const { c, d: e } = o;',
    'export const [f, g] = arr;',
    "export const x = { p: 1, q: [1, 2] }, y = fn(1, 2), z = 'a, b';",
    'export const { m = 1, n: { deep }, ...rest } = obj;',
  ].join('\n');
  const names = parseModule(src).exports.map(e => e.name);
  assert.deepEqual(names, ['a', 'b', 'c', 'e', 'f', 'g', 'x', 'y', 'z', 'm', 'deep', 'rest']);
  assert.ok(parseModule(src).exports.every(e => e.kind === 'const'));
});

test('trailing // comments drop imports but string URLs survive', () => {
  const src = [
    'import a from "./a.js"; // import b from "./b.js"',
    "import c from './c.js'; // note",
    "const u = 'https://example.org/x.js'; import d from './d.js';",
  ].join('\n');
  assert.deepEqual(parseModule(src).imports, ['./a.js', './c.js', './d.js']);
});
