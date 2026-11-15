import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseModule } from '../../scripts/codemap/parse-module.mjs';

const cjs = src => parseModule(src).commonJs;

test('free module and exports are flagged, including computed access', () => {
  assert.equal(cjs('module.exports = {};'), true);
  assert.equal(cjs("module['exports'] = {a: 1};"), true);
  assert.equal(cjs('exports.a = 1;'), true);
  assert.equal(cjs("Object.assign(exports, {a: 1});"), true);
  assert.equal(cjs('exports = {};'), true);
  assert.equal(cjs('const x = typeof module;'), true);
});

test('a declaration in another scope does not hide a free reference', () => {
  assert.equal(cjs('function unrelated(module) {}\nmodule.exports = {a: 1};'), true);
  assert.equal(cjs('function unrelated(exports) {}\nObject.assign(exports, {});'), true);
  assert.equal(cjs('{ const exports = []; }\nexports.a = 1;'), true);
  assert.equal(cjs('try {} catch (module) {}\nmodule.exports = 1;'), true);
});

test('a local declaration in an enclosing scope is fine', () => {
  assert.equal(cjs('const exports = [];\nexports.push(1);'), false);
  assert.equal(cjs('function f(module) { return module.exports; }'), false);
  assert.equal(cjs('function f() { if (1) { var exports = {}; } return exports.a; }'), false);
  assert.equal(cjs('for (const module of []) { module.exports; }'), false);
  assert.equal(cjs('try {} catch (exports) { exports.a; }'), false);
  assert.equal(cjs('const f = ({ module }) => module.exports;'), false);
});

test('property names and keys called module or exports are not references', () => {
  assert.equal(cjs('const o = { module: 1, exports: 2 }; o.module; o.exports;'), false);
});
