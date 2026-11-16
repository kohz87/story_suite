import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseModule } from '../../scripts/codemap/parse-module.mjs';

const cjs = src => parseModule(src).commonJs;

test('any reference to module or exports is flagged, including computed access', () => {
  assert.equal(cjs('module.exports = {};'), true);
  assert.equal(cjs("module['exports'] = {a: 1};"), true);
  assert.equal(cjs('exports.a = 1;'), true);
  assert.equal(cjs('Object.assign(exports, {a: 1});'), true);
  assert.equal(cjs('exports = {};'), true);
  assert.equal(cjs('const x = typeof module;'), true);
});

test('a free name is CommonJS even when a declaration of it comes after the use in another form', () => {
  assert.equal(cjs('switch (module.exports = {a:1}) {\n  default: let other;\n}'), true);
  assert.equal(cjs('(function (x = module.exports = {a:1}) {\n  var other;\n})();'), true);
});

test('a name the file declares itself (a variable, a parameter, a catch or import binding, a function) is not CommonJS', () => {
  assert.equal(cjs('const exports = [];'), false);
  assert.equal(cjs('function f(module) {}'), false);
  assert.equal(cjs('try {} catch (exports) {}'), false);
  assert.equal(cjs('const { module } = {};'), false);
  assert.equal(cjs("import module from './x.js';"), false);
  assert.equal(cjs("import { a as exports } from './x.js';"), false);
  assert.equal(cjs('function module() {}'), false);
  assert.equal(cjs('const rows = []; rows.map(row => row.module);'), false);
});

test('member properties and object keys called module or exports are fine', () => {
  assert.equal(cjs('const o = { module: 1, exports: 2 }; o.module; o.exports;'), false);
  assert.equal(cjs('const o = { module: 1 };'), false);
  assert.equal(cjs('const o = {}; o.module;'), false);
  assert.equal(cjs('class A { module() {} }'), false);
});

test('require, __filename and __dirname are CommonJS when free', () => {
  assert.equal(cjs('require.cache[__filename].exports = {};'), true);
  assert.equal(cjs("const fs = require('node:fs');"), true);
  assert.equal(cjs('const d = __dirname;'), true);
  assert.equal(cjs('function f(require) {}'), false);
  assert.equal(cjs('const o = { require: 1 }; o.require;'), false);
});
