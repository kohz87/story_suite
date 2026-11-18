// What a pack is for (packs/kind.js): the tag the Packs list shows under a pack's name, read from the kind the pack states:
// "World pack", "Game pack", or "Pack" for anything that states neither.
import test from 'node:test';
import assert from 'node:assert/strict';
import { packTag } from '../../packs/kind.js';
import { validatePack } from '../../packs/validate.js';

const pack = (kind, extra = {}) => ({ id: 'tag-x', format: 4, version: '1.0.0', requires: { suite: '^0.1' }, content: {}, ...(kind ? { kind } : {}), ...extra });

test('a world is a "World pack" and a game is a "Game pack", whatever else the pack declares or holds', () => {
    assert.equal(packTag(pack('world')), 'World pack');
    assert.equal(packTag(pack('game')), 'Game pack');
    assert.equal(packTag(pack('world', { requires: { suite: '^0.1', capabilities: ['inventory', 'scene'] } })), 'World pack', 'a declared module changes nothing');
    assert.equal(packTag(pack('game', { content: { currency: { name: 'mark' } } })), 'Game pack', 'neither does what it holds');
});

test('a pack that states neither kind, states an unknown one, or is not usable is "Pack"', () => {
    assert.equal(packTag(pack()), 'Pack', 'no kind');
    assert.equal(packTag(pack('story-block')), 'Pack', 'a kind this list does not name');
    assert.equal(packTag(pack('World')), 'Pack', 'the kind is read exactly');
    assert.equal(packTag(null), 'Pack', 'a pack that is not usable');
    assert.equal(packTag(undefined), 'Pack');
});

test('a validated pack gets the tag of its kind', () => {
    const world = validatePack({ id: 'world-x', format: 4, kind: 'world', version: '1.0.0', name: 'Harbour', requires: { suite: '^0.1' }, content: { places: [{ id: 'harbour', name: 'Harbour', x: 1, y: 2 }] } });
    assert.equal(world.ok, true, JSON.stringify(world.errors));
    assert.equal(packTag(world.pack), 'World pack');
    const game = validatePack({ id: 'game-x', format: 4, kind: 'game', version: '1.0.0', requires: { suite: '^0.1' }, content: {} });
    assert.equal(game.ok, true, JSON.stringify(game.errors));
    assert.equal(packTag(game.pack), 'Game pack');
});
