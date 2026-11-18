// LAB2-3, the atlas's anchor rules one by one (pure): the pack place itself, its town part, the place the atlas saved it in, the pack
// place last written on the map in its region, the region alone, and nothing. Also the known limit of `last` (it follows the map's
// write order, not the last visit).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { anchorOf } from '../../../modules/atlas/atlas/anchor.js';
import { worldOf } from '../../../modules/atlas/atlas/world.js';
import { initialAtlas } from '../../../modules/atlas/atlas/domain.js';

const pack = {
    places: [
        { key: 'auvoth', name: 'Auvoth', definition: null, region: 'auvoth-compact', kind: 'city', layer: '', x: 59, y: 110, aliases: [], aliasNames: [], hidden: false },
        { key: 'auvoth depths', name: 'Auvoth Depths', definition: null, region: 'auvoth-compact', kind: 'dungeon', layer: '', x: 58, y: 110, aliases: [], aliasNames: [], hidden: false },
        { key: 'bluewatch village', name: 'Bluewatch Village', definition: null, region: 'bluewatch-reach', kind: 'village', layer: '', x: 40, y: 100, aliases: [], aliasNames: [], hidden: false },
    ],
    routes: [],
};
const place = (id, name, region, rev, extra = {}) => ({ id, name, region, kind: '', layer: '', discovered: true, rev, ...extra });
function atlasWith(places) {
    const atlas = initialAtlas();
    for (const own of places) {
        atlas.places[own.id] = own;
        atlas.keys[own.name.toLowerCase()] = own.id;
    }
    return atlas;
}
const anchor = (atlas, name, region = '') => anchorOf(worldOf(atlas, pack), atlas, pack, name, { region });

test('LAB2-3 anchor rules: pack, town, parent, last, region, none', () => {
    const atlas = atlasWith([
        place('pl_auvoth00', 'Auvoth', 'auvoth-compact', 10),
        place('pl_cellar00', 'Old Cellar', 'auvoth-compact', 30, { parent: 'pl_auvoth00' }),
        place('pl_sled0000', 'Sled & Winch', 'auvoth-compact', 40),
    ]);
    assert.deepEqual(anchor(atlas, 'Auvoth'), { name: 'Auvoth', region: 'auvoth-compact', via: 'pack' });
    assert.equal(anchor(atlas, 'Auvoth / Pale Market Inn')?.via, 'town');
    assert.equal(anchor(atlas, 'Auvoth / Pale Market Inn')?.name, 'Auvoth');
    assert.equal(anchor(atlas, 'Pale Market Inn in Auvoth')?.name, 'Auvoth');
    assert.equal(anchor(atlas, 'Auvoth · Southern Gatehouse')?.name, 'Auvoth');
    assert.deepEqual(anchor(atlas, 'Old Cellar'), { name: 'Auvoth', region: 'auvoth-compact', via: 'parent' });
    assert.deepEqual(anchor(atlas, 'The Sled & Winch'), { name: 'Auvoth', region: 'auvoth-compact', via: 'last' });
    assert.deepEqual(anchor(atlas, 'A New Tavern', 'auvoth-compact'), { name: 'Auvoth', region: 'auvoth-compact', via: 'last' }, 'not on the map yet: the scene\'s region');
    assert.deepEqual(anchor(atlas, 'A Hut', 'bluewatch-reach'), { name: '', region: 'bluewatch-reach', via: 'region' }, 'no pack place visited in that region');
    assert.equal(anchor(atlas, 'Nowhere Known'), null, 'no region, nothing known');
    assert.equal(anchor(atlas, ''), null);
});

test('LAB2-3 known limit: `last` is the pack place last written on the map in the region, not the last one visited', () => {
    // Auvoth (rev 10) → Auvoth Depths (rev 20) → back to Auvoth (the map does not write it again) → a tavern: the Depths.
    const atlas = atlasWith([place('pl_auvoth00', 'Auvoth', 'auvoth-compact', 10), place('pl_depths00', 'Auvoth Depths', 'auvoth-compact', 20)]);
    assert.equal(anchor(atlas, 'A Tavern', 'auvoth-compact')?.name, 'Auvoth Depths');
});
