import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePack } from '../../packs/validate.js';
import { createInstalled } from '../../packs/installed.js';
import { HOST_CAPABILITIES } from '../../packs/limits.js';

test('rules manifests are rejected and cannot replace an installed pack', async () => {
    const store = {};
    const installed = createInstalled({ settings: { read: () => store, save: async () => {} }, capabilities: () => ['scene', 'inventory'] });
    const world = { id: 'world', format: 4, kind: 'world', version: '1.0.0', requires: { suite: '^0.1' }, content: {} };
    assert.equal((await installed.install(world)).ok, true);
    const rules = { ...world, version: '2.0.0', content: { rules: [{}] } };
    const result = await installed.install(rules);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error => error.code === 'UNKNOWN_KIND' && error.path === 'content.rules'));
    assert.equal(installed.list()[0].version, '1.0.0');
    assert.deepEqual(HOST_CAPABILITIES, ['data-modules-v1']);
});

test('the open world example pair remains valid with the supported host capabilities', () => {
    const read = name => readFileSync(new URL(`../../examples/packs/${name}/pack.json`, import.meta.url), 'utf8');
    // The world's events use chronicle-lasting, which a story-director module gives.
    const options = { capabilities: ['scene', 'inventory', 'chronicle-lasting', ...HOST_CAPABILITIES] };
    const world = validatePack(read('ersveil'), options);
    assert.equal(world.ok, true, JSON.stringify(world.errors));
    assert.equal(world.pack.content.places.length, 323);
    assert.equal(world.pack.content.routes.length, 352);
    const game = validatePack(read('ersveil-game'), options);
    assert.equal(game.ok, true, JSON.stringify(game.errors));
    assert.equal(game.pack.content.dataModules.length, 4);
});
