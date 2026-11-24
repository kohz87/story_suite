// FU134, reading an old chat: a "settlement" the story made for a spot in a pack's village ("Bluewatch River-Gate Storehouse | kind: settlement",
// saved before spots in town were filed inside) is read as inside the village when its name starts with the village's own name word and no road
// leads to it; a pack's settlement in the chain wins over a story-made one. Narrow: a road, another name word or a pack's own place is left alone.
import test from 'node:test';
import assert from 'node:assert/strict';

import { locator } from '../../../../modules/cast/cast/entries-parts/places.js';
import { atPlace } from '../../../../modules/cast/cast/world-parts/places.js';

const PACK = [
    { name: 'Bluewatch Village', aliases: ['Bluewatch'], kind: 'settlement' },
    { name: 'Bluewatch Village / Guild Office', kind: 'building' },
    { name: 'Auvoth', kind: 'town' },
    { name: 'Silver Hollow', kind: 'village' },
    { name: 'Ersveil', kind: 'city' },
];
const STORY = {
    'bluewatch river-gate storehouse': { id: 'pl_1', name: 'Bluewatch River-Gate Storehouse', kind: 'settlement', region: 'Bluewatch Reach', parent: null, routes: [] },
    'bluewatch village': { id: 'pl_2', name: 'Bluewatch Village', kind: 'settlement', parent: null, routes: [], source: 'atlas' },
    'harrow mill': { id: 'pl_3', name: 'Harrow Mill', kind: 'settlement', parent: null, routes: [] },
    'silver creek': { id: 'pl_5', name: 'Silver Creek', kind: 'settlement', parent: null, routes: [] },
    'bluewatch farm': { id: 'pl_6', name: 'Bluewatch Farm', kind: 'village', parent: null, routes: [] },
    'ashford': { id: 'pl_7', name: 'Ashford', kind: 'village', parent: 'pl_8', routes: [] },
    'ersveil': { id: 'pl_8', name: 'Ersveil', kind: 'city', parent: null, routes: [] },
    'bluewatch mill': { id: 'pl_4', name: 'Bluewatch Mill', kind: 'village', parent: null, routes: [{ id: 'rt_1' }] },
};
const BY_ID = Object.fromEntries(Object.values(STORY).map(place => [place.id, place]));
const query = (name, args) => (name === 'packs.content' ? (args?.kind === 'places' ? PACK : []) : name === 'atlas.place' ? (args?.id ? BY_ID[args.id] : STORY[String(args?.name).toLowerCase()]) ?? null : null);
const party = place => ({ place, locate: locator(query) });

test('a story-made "settlement" starting with the village\'s name word, with no road to it, sits in the village', () => {
    const spot = locator(query)('Bluewatch River-Gate Storehouse');
    assert.deepEqual(spot.up.map(up => up.name), ['Bluewatch Village']);
    assert.equal(spot.up[0].pack, true);
    assert.equal(atPlace('Bluewatch Village', party('Bluewatch River-Gate Storehouse')), true, 'the village\'s people are here');
    assert.equal(atPlace('Bluewatch Village / Guild Office', party('Bluewatch River-Gate Storehouse')), true);
});

test('left alone: the pack\'s own village, another name word, a place a road leads to', () => {
    const locate = locator(query);
    assert.deepEqual(locate('Bluewatch Village').up, []);
    assert.equal(locate('Bluewatch Village').pack, true);
    assert.deepEqual(locate('Harrow Mill').up, [], 'no village of the pack starts with its name word');
    assert.deepEqual(locate('Bluewatch Mill').up, [], 'a road leads to it');
    assert.equal(atPlace('Auvoth', party('Harrow Mill')), false);
});

test('left alone: a colour word shared with a pack settlement, a story village with no road (no trip is recorded per place), a story place under a pack city', () => {
    const locate = locator(query);
    assert.deepEqual(locate('Silver Creek').up, [], '"silver" is a common word, not a town\'s own');
    assert.deepEqual(locate('Bluewatch Farm').up, [], 'only a place saved with the kind "settlement" is tied by name');
    const ashford = locate('Ashford');
    assert.equal(ashford.up[0].name, 'Ersveil');
    assert.equal(ashford.tie, '', 'its saved parent is no name tie: the nearest settlement stays Ashford');
    assert.equal(locate('Bluewatch River-Gate Storehouse').tie, locate('Bluewatch Village').key, 'the tied pack village is the settlement');
});
