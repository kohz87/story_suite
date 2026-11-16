import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectWorld } from '../../../ui/select/world.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { WORLD_SHAPE } from '../../../ui/contract/world.js';

// Recorded answers, written from the real query code:
// atlas.view: packages/story-director/src/v2/atlas/map.js:101-141 (places :118-122, routes :124-127).
const ATLAS_VIEW = {
  places: [
    { id: 'bluewatch', name: 'Bluewatch', aliases: [], region: 'The Salt Coast', kind: 'Port town', icon: 'fa-anchor', plane: '', layer: 'the salt coast', x: 600, y: 440, line: 'Bluewatch', parent: '', inside: 0, visited: true, here: true },
    { id: 'oldweir', name: 'Old Weir', aliases: [], region: 'The Salt Coast', kind: 'Ford', icon: 'fa-bridge', plane: '', layer: 'the salt coast', x: 470, y: 382, line: 'Old Weir', parent: '', inside: 0, visited: false, here: false },
    { id: 'wolfmere', name: 'Wolfmere', aliases: [], region: '', kind: '', icon: 'fa-location-dot', plane: '', layer: '', x: 170, y: 440, line: 'Wolfmere', parent: '', inside: 0, visited: false, here: false },
    { id: 'nowhere', name: 'Nowhere', aliases: [], region: '', kind: 'Ruin', icon: '', plane: '', layer: '', x: null, y: null, line: 'Nowhere', parent: '', inside: 0, visited: true, here: false },
  ],
  routes: [
    { from: 'bluewatch', to: 'oldweir', kind: 'road', known: false },
    { from: 'oldweir', to: 'wolfmere', kind: 'Trail', known: false },
    { from: 'bluewatch', to: 'nowhere', kind: 'road', known: true },
  ],
  layers: [], layer: '', current: 'bluewatch', kinds: {}, tidy: 0, orient: { north: 'up', east: 'right' },
};
// world.areaTier: SD/atlas/policy.js:68-82 gives { place, tier, source, ... } per place; the port passes tier by id.
const TIERS = { bluewatch: 1, oldweir: 4, wolfmere: 7 };
// atlas.selected → placeDetail: SD/atlas/queries.js:50-56 (trip from tripFrom :65-70).
const SELECTED = { id: 'oldweir', name: 'Old Weir', here: false, routes: [], trip: { fromId: 'bluewatch', fromName: 'Bluewatch', km: 3, days: 0.5, unit: 'day', mode: 'foot', hops: 1, by: ['road'], text: 'half a day' } };
// director.world → worldView: SD/world/known.js:399-423 (news :249-278, factions :280-293).
const WORLD_VIEW = {
  news: [
    { id: 'ev_1', kind: 'world', name: 'Raids', summary: 'A caravan burned.', state: 'ongoing', open: true, when: 'Goldwane 12', ago: 'a day ago', place: 'Wolfmere', factions: 'Men in Grey', placeId: 'wolfmere', factionIds: ['fa_1'], heard: [{ where: 'Wolfmere', when: 'Goldwane 12', from: 'Men in Grey' }, { where: '', when: '', from: null }] },
    { id: 'th_2', kind: 'event', name: 'Harvest fair', summary: 'Set for the 16th.', state: '', open: true, when: '', ago: '', place: '', factions: '' },
    { id: 'th_3', kind: 'event', name: 'Old news', summary: '', state: '', open: false, when: '', ago: '', place: 'Atlantis', factions: '' },
  ],
  factions: [
    { id: 'fa_1', name: 'Men in Grey', summary: 'Bandits.', area: 'Wolfmere', stance: 'Hostile', areaPlaceIds: ['wolfmere'], members: [{ personId: 'np_1', name: 'Garr' }, { personId: null, name: 'Dess' }, { name: '' }] },
    { id: 'fa_2', name: 'Guild', summary: 'Adventurers.', area: 'The Salt Coast', stance: 'friendly to you' },
    { id: 'fa_3', name: 'Quiet', summary: '', area: '', stance: '' },
  ],
};

const world = () => selectWorld({ atlasView: ATLAS_VIEW, tiers: TIERS, selected: SELECTED, worldView: WORLD_VIEW });

test('the recorded answers build a view-model that matches WORLD_SHAPE', () => {
  assert.deepEqual(checkShape(world(), WORLD_SHAPE), []);
});

test('places: drops unplaced ones, nulls an empty region, maps tiers to danger', () => {
  const { places } = world();
  assert.deepEqual(places.map(p => p.id), ['bluewatch', 'oldweir', 'wolfmere']);
  assert.equal(places[2].region, null);
  assert.deepEqual(places.map(p => p.danger), ['safe', 'risky', 'dangerous']);
  assert.equal(places[0].here, true);
  assert.equal(places[1].visited, false);
});

test('a place with no tier reads as safe', () => {
  assert.equal(selectWorld({ atlasView: ATLAS_VIEW }).places[0].danger, 'safe');
});

test('routes: kinds fold to road or track, routes to dropped places go', () => {
  assert.deepEqual(world().routes, [{ kind: 'road', a: 'bluewatch', b: 'oldweir' }, { kind: 'track', a: 'oldweir', b: 'wolfmere' }]);
});

test('trip: one planned leg from the scene place, minutes from days', () => {
  const { trip } = world();
  assert.equal(trip.state, 'planned');
  assert.deepEqual(trip.placeIds, ['bluewatch', 'oldweir']);
  assert.deepEqual(trip.legs, [{ from: 'Bluewatch', to: 'Old Weir', km: 3, minutes: 720, note: 'road' }]);
  assert.equal(trip.mode, 'foot');
  assert.equal(trip.leave, null);
});

test('trip: hours unit, null without a selected trip', () => {
  const hours = { ...SELECTED, trip: { ...SELECTED.trip, days: 2, unit: 'hour', km: null, by: [] } };
  const { trip } = selectWorld({ atlasView: ATLAS_VIEW, selected: hours });
  assert.equal(trip.legs[0].minutes, 120);
  assert.equal(trip.legs[0].km, null);
  assert.equal(trip.legs[0].note, null);
  assert.equal(selectWorld({ atlasView: ATLAS_VIEW, selected: { ...SELECTED, trip: null } }).trip, null);
  assert.equal(selectWorld({ atlasView: ATLAS_VIEW, selected: null }).trip, null);
});

test('news: state, place and faction links come from the answer; heard stamps are read, empty ones dropped', () => {
  const { news } = world();
  assert.deepEqual(news.map(n => n.state), ['ongoing', 'ongoing', 'resolved']);
  assert.equal(news[0].placeId, 'wolfmere');
  assert.equal(news[0].factionId, 'fa_1');
  assert.equal(news[1].placeId, null);
  assert.equal(news[1].factionId, null);
  assert.equal(news[2].placeId, null);
  assert.deepEqual(news.map(n => n.heard), [[{ where: 'Wolfmere', when: 'Goldwane 12', from: 'Men in Grey' }], [], []]);
  assert.equal(news[0].title, 'Raids');
});

test('factions: stance words fold into the enum, area links to places, members are read', () => {
  const { factions } = world();
  assert.deepEqual(factions.map(f => f.stance), ['hostile', 'friendly', 'neutral']);
  assert.deepEqual(factions[0].areaPlaceIds, ['wolfmere']);
  assert.deepEqual(factions[1].areaPlaceIds, ['bluewatch', 'oldweir']);
  assert.deepEqual(factions[2].areaPlaceIds, []);
  assert.deepEqual(factions[0].members, [{ personId: 'np_1', name: 'Garr' }, { personId: null, name: 'Dess' }]);
  assert.deepEqual(factions[1].members, []);
});

test('stance wording: unfriendly, warm, and unknown text', () => {
  const stances = ['wary of you', 'favours you', 'who knows'];
  const wv = { factions: stances.map((stance, i) => ({ id: `f${i}`, name: `F${i}`, summary: '', area: '', stance })) };
  assert.deepEqual(selectWorld({ worldView: wv }).factions.map(f => f.stance), ['unfriendly', 'warm', 'neutral']);
});

test('no answers at all gives an empty world that matches the shape', () => {
  for (const input of [undefined, {}, { atlasView: null, worldView: null }]) {
    const w = selectWorld(input);
    assert.deepEqual(w, { places: [], routes: [], trip: null, news: [], factions: [] });
    assert.deepEqual(checkShape(w, WORLD_SHAPE), []);
  }
});

test('items without an id are skipped', () => {
  const w = selectWorld({ worldView: { news: [{ name: 'x' }], factions: [{ name: 'y' }] } });
  assert.deepEqual([w.news, w.factions], [[], []]);
});

test('place quests: the open quests that name a place by id; others leave the place without quests', () => {
  const view = { ...WORLD_VIEW, quests: [{ id: 'th_9', name: 'Ford the river', place: 'Old Weir', placeId: 'oldweir' }, { id: 'th_8', name: 'Far', place: 'Atlantis', placeId: null }] };
  const { places } = selectWorld({ atlasView: ATLAS_VIEW, tiers: TIERS, selected: SELECTED, worldView: view });
  assert.deepEqual(places.map(p => p.quests), [[], ['Ford the river'], []]);
  assert.deepEqual(checkShape(selectWorld({ atlasView: ATLAS_VIEW, worldView: view }), WORLD_SHAPE), []);
});
