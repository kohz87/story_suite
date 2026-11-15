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

test('the review examples with shadowing declarations are flagged', () => {
  assert.equal(cjs('switch (module.exports = {a:1,b:2,c:3,d:4,e:5}) {\n  default: let module;\n}'), true);
  assert.equal(cjs('(function (x = module.exports = {a:1,b:2,c:3,d:4,e:5}) {\n  var module;\n})();'), true);
});

test('declaring or binding the names is flagged too', () => {
  assert.equal(cjs('const exports = [];'), true);
  assert.equal(cjs('function f(module) {}'), true);
  assert.equal(cjs('try {} catch (exports) {}'), true);
  assert.equal(cjs('const { module } = {};'), true);
  assert.equal(cjs("import module from './x.js';"), true);
  assert.equal(cjs("import { a as exports } from './x.js';"), true);
  assert.equal(cjs('function module() {}'), true);
});

test('member properties and object keys called module or exports are fine', () => {
  assert.equal(cjs('const o = { module: 1, exports: 2 }; o.module; o.exports;'), false);
  assert.equal(cjs('const o = { module: 1 };'), false);
  assert.equal(cjs('const o = {}; o.module;'), false);
  assert.equal(cjs('class A { module() {} }'), false);
});

test('require, __filename and __dirname are reserved too', () => {
  assert.equal(cjs('require.cache[__filename].exports = {};'), true);
  assert.equal(cjs("const fs = require('node:fs');"), true);
  assert.equal(cjs('const d = __dirname;'), true);
  assert.equal(cjs('function f(require) {}'), true);
  assert.equal(cjs('const o = { require: 1 }; o.require;'), false);
});
