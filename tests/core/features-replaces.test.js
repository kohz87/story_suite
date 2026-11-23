// A feature that `replaces` others: switching it on switches them off in the same action, and switching a replaced one on switches off whatever replaces it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { definitionProblems } from '../../core/registry.js';

const mod = (id, features) => ({ id, name: id, version: '0.0.1', features });
const plug = () => mod('plug', [{ id: 'plug.on', label: 'Plug', default: false, replaces: ['story-block.rpg'] }]);

test('replaces: an array of at most four feature ids', () => {
    const problems = replaces => definitionProblems(mod('plug', [{ id: 'plug.on', label: 'Plug', replaces }]));
    assert.deepEqual(problems(['story-block.rpg']), []);
    assert.deepEqual(problems(['a.b', 'a.c', 'a.d', 'a.e']), []);
    assert.equal(problems('story-block.rpg').length, 1);
    assert.equal(problems(['a', 'b', 'c', 'd', 'e']).length, 1);
    assert.equal(problems([1]).length, 1);
    assert.equal(problems(['']).length, 1);
});

test('the registry keeps replaces on the declared feature', async t => {
    const host = await createHost({ core: true, modules: [plug()] });
    t.after(() => host.close());
    assert.deepEqual(host.sdk.features().find(f => f.id === 'plug.on').replaces, ['story-block.rpg']);
    assert.equal(host.sdk.features().find(f => f.id === 'story-block.rpg').replaces, undefined);
});

test('switching the replacing feature on switches the replaced one off; the other way round too', async t => {
    const host = await createHost({ core: true, modules: [plug()] });
    t.after(() => host.close());
    const on = id => host.features.on(id);
    host.features.set('story-block.rpg', true);
    assert.deepEqual([on('story-block.rpg'), on('plug.on')], [true, false]);
    host.features.set('plug.on', true);
    assert.deepEqual([on('story-block.rpg'), on('plug.on')], [false, true]);
    host.features.set('story-block.rpg', true);
    assert.deepEqual([on('story-block.rpg'), on('plug.on')], [true, false]);
    host.features.set('plug.on', false);
    assert.deepEqual([on('story-block.rpg'), on('plug.on')], [true, false], 'switching off changes nothing else');
    host.features.set('story-block.rpg', false);
    assert.equal(on('plug.on'), false);
});
