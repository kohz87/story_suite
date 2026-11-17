import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildBundleSet } from '../../scripts/release/bundle.mjs';
import { tempDir } from '../../scripts/temp-dir.mjs';

// The release step packs an eager import('./x.js') into the entry. This runs a fixture package on the source and
// on its bundle and compares what the code can see: what the promise gives (the namespace's keys, values, default),
// that it is one module instance, the order of evaluation, and the error cases.
let root;
let source;
let bundled;
const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };

before(async () => {
  root = tempDir('release-pack-');
  write('pkg/boot.js', [
    "import { counter, bump } from './shared.js';",
    "(globalThis.order ??= []).push('boot');",
    "export const loadOk = () => import('./ok.js');",
    "export const loadBad = () => import('./bad.js');",
    "export const loadCatch = () => import('./bad.js').catch(error => `caught ${error.message}`);",
    "export const loadStatic = () => import('./shared.js');",
    "export const state = () => ({ counter, bump });",
  ].join('\n'));
  write('pkg/shared.js', "(globalThis.order ??= []).push('shared');\nexport let counter = 0;\nexport const bump = () => { counter += 1; };\n");
  write('pkg/ok.js', "import { bump } from './shared.js';\nglobalThis.order.push('ok');\nbump();\nexport const answer = 42;\nexport function add(a, b) { return a + b; }\nexport default { kind: 'default' };\n");
  write('pkg/bad.js', "globalThis.order.push('bad');\nglobalThis.badRuns = (globalThis.badRuns ?? 0) + 1;\nthrow new Error('init failed');\n");
  await buildBundleSet({ name: 'pkg', entries: ['pkg/boot.js'], lazy: [] }, path.join(root, 'out'), root);
  const load = async file => {
    for (const key of ['order', 'badRuns']) delete globalThis[key];
    const boot = await import(`${pathToFileURL(file).href}?run=${Math.random()}`);
    const ns = await boot.loadOk();
    const first = await boot.loadBad().then(() => 'resolved', error => error.message);
    const second = await boot.loadBad().then(() => 'resolved', error => error.message);
    const view = {
      keys: Object.keys(ns).sort(), values: { answer: ns.answer, sum: ns.add(2, 3), default: ns.default }, destructured: (({ answer, ...rest }) => Object.keys(rest).sort())(ns),
      same: (await boot.loadOk()) === ns, first, second, caught: await boot.loadCatch(), order: [...globalThis.order], counter: boot.state().counter,
      sharedKeys: Object.keys(await boot.loadStatic()).sort(),
    };
    return { view, ns, badRuns: globalThis.badRuns };
  };
  source = await load(path.join(root, 'pkg/boot.js'));
  bundled = await load(path.join(root, 'out/boot.js'));
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

test('packed and native import() give the same keys, values, default, instance, order and caught errors', () => {
  assert.deepEqual(bundled.view, source.view);
  assert.deepEqual(source.view.keys, ['add', 'answer', 'default']);
  assert.equal(source.view.first, 'init failed');
  assert.equal(source.view.caught, 'caught init failed');
  assert.deepEqual(source.view.order, ['shared', 'boot', 'ok', 'bad']);
});

test('a module that throws while it starts runs once and fails the same way every time', () => {
  assert.equal(source.badRuns, 1);
  assert.equal(bundled.badRuns, 1);
});

test('a packed namespace is shaped like the native module namespace', () => {
  for (const check of [ns => Object.prototype.toString.call(ns), ns => Object.getPrototypeOf(ns), ns => Object.isExtensible(ns), ns => ns[Symbol.toStringTag], ns => Reflect.ownKeys(ns).map(String), ns => Object.entries(ns).map(([key, value]) => [key, typeof value])]) {
    assert.deepEqual(check(bundled.ns), check(source.ns));
  }
  assert.throws(() => { 'use strict'; bundled.ns.extra = 1; }, TypeError);
});
