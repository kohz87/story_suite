import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../../../core/registry.js';
import { loadSettings } from '../../../core/settings/load.js';
import { createSettings } from '../../../core/sdk/settings.js';
import { createHost } from '../../../testkit/index.js';

const module = { id: 'counter', name: 'Counter', version: '1.0.0', settings: { defaults: { step: 1 }, schema: { step: { type: 'int' } } } };
const make = es => {
    const registry = createRegistry();
    registry.register(module);
    let saves = 0;
    const tree = loadSettings({ root: () => es, registry, coreDefaults: { tailBudget: 1500 }, save: () => { saves += 1; } });
    return { registry, tree, saves: () => saves };
};

test('a first load makes the schema-1 tree with only choices stored, and saves once', () => {
    const es = {};
    const { tree, saves } = make(es);
    assert.deepEqual(es.storySuite, { schema: 1, core: {}, ui: { next: false }, modules: {} });
    assert.equal(tree, es.storySuite);
    assert.equal(saves(), 1);
});

test('an old-shaped tree (host bucket, no schema) is kept whole as storySuite_legacy and never read', () => {
    const old = { modules: { counter: { step: 9 } }, host: { tailBudget: 7 }, features: { 'a.b': true } };
    const es = { storySuite: old };
    const { registry } = make(es);
    assert.equal(es.storySuite_legacy, old);
    assert.deepEqual(es.storySuite, { schema: 1, core: {}, ui: { next: false }, modules: {} });
    assert.equal(createSettings({ root: () => es, registry })('counter').step, 1);
});

test('a second load changes nothing and does not save', () => {
    const es = { storySuite: { schema: 1, core: { tailBudget: 800 }, ui: { next: true }, modules: { counter: { step: 4 } } } };
    const before = structuredClone(es);
    const { saves } = make(es);
    assert.deepEqual(es, before);
    assert.equal(saves(), 0);
});

test('the core bucket is stored under `core`, never `host`', () => {
    const es = {};
    const { registry } = make(es);
    const settings = createSettings({ root: () => es, registry });
    settings.set(null, 'tailBudget', 900);
    assert.deepEqual(es.storySuite.core, { tailBudget: 900 });
    assert.equal(Object.hasOwn(es.storySuite, 'host'), false);
});

test('a runtime started over an old tree sets it aside and a pack currency still shows', async () => {
    const host = await createHost({ st: { extensionSettings: { storySuite: { modules: { 'story-block': { currency: 'silver' } }, host: { tailBudget: 5 } } } } });
    assert.equal(host.ctx.extensionSettings.storySuite.schema, 1);
    assert.equal(host.ctx.extensionSettings.storySuite_legacy.host.tailBudget, 5);
    assert.notEqual(host.sdk.query('inventory.currency').name, 'silver');
    host.close();
});
