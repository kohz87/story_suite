// LAB-5: the World view-model shows a region's name (chronicle.regionNames, World events on), never its id; with no answer the id stays (as before).
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectWorld } from '../../../ui/select/world.js';

const atlasView = { places: [
  { id: 'p1', name: 'Bluewatch Village', kind: 'village', region: 'bluewatch-reach', x: 1, y: 1 },
  { id: 'p2', name: 'Highmark Capital', kind: 'city', region: 'highmark-empire', x: 4, y: 4 },
  { id: 'p3', name: 'Camp', kind: 'site', region: 'the-barrens', x: 7, y: 7 }] };
const names = { 'bluewatch-reach': 'Bluewatch Reach', 'highmark-empire': 'Highmark Empire', 'highmark empire': 'Highmark Empire' };

test('a place\'s region is the region\'s name; an unnamed region keeps its id as the last resort', () => {
  const view = selectWorld({ atlasView, worldEvents: true, regionNames: names });
  assert.deepEqual(view.places.map(p => p.region), ['Bluewatch Reach', 'Highmark Empire', 'the-barrens']);
});

test('no names (World events off, or no answer): the region is the id, as before', () => {
  assert.deepEqual(selectWorld({ atlasView }).places.map(p => p.region), ['bluewatch-reach', 'highmark-empire', 'the-barrens']);
  assert.deepEqual(selectWorld({ atlasView, worldEvents: true, regionNames: null }), selectWorld({ atlasView, worldEvents: true }));
});

test('a faction whose area is the region id or the region name still finds its places', () => {
  const worldView = { factions: [{ id: 'f1', name: 'Wardens', area: 'bluewatch-reach' }, { id: 'f2', name: 'Guild', area: 'Highmark Empire' }] };
  const view = selectWorld({ atlasView, worldView, regionNames: names });
  assert.deepEqual(view.factions.map(f => f.areaPlaceIds), [['p1'], ['p2']]);
});

test('with World events off the names are still shown (they are display only); a pack with no regions reads as before', () => {
  assert.deepEqual(selectWorld({ atlasView, worldEvents: false, regionNames: names }).places.map(p => p.region), ['Bluewatch Reach', 'Highmark Empire', 'the-barrens']);
  assert.deepEqual(selectWorld({ atlasView, regionNames: {} }), selectWorld({ atlasView }));
});
