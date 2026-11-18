// Places the story made up (no map position) show on the World tab as a Places list; with no mapped place it is the only view.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { worldTab } from '../../../../ui/tabs/world/world.js';
import { selectWorld } from '../../../../ui/select/world.js';
import { checkShape } from '../../../../ui/contract/shapes.js';
import { WORLD_SHAPE } from '../../../../ui/contract/world.js';

const place = (id, name, extra = {}) => ({ id, name, aliases: [], region: '', kind: 'Hamlet', icon: '', x: null, y: null, visited: true, here: false, ...extra });
const ATLAS = { places: [place('weir', 'Weir', { region: 'The Marsh' }), place('landing', 'North Landing', { here: true })], routes: [], orient: { north: 'up', east: 'right' } };

test('the selector lists places with no position and keeps them off the map', () => {
  const view = selectWorld({ atlasView: ATLAS });
  assert.deepEqual(view.places, []);
  assert.deepEqual(view.unmapped.map(p => [p.name, p.kind, p.region, p.here]), [['Weir', 'Hamlet', 'The Marsh', false], ['North Landing', 'Hamlet', null, true]]);
  assert.deepEqual(checkShape(view, WORLD_SHAPE), []);
});

test('the World tab shows them as Places (here first) instead of "Nothing is known"', () => {
  installFakeDom();
  const tab = worldTab(selectWorld({ atlasView: ATLAS }), {});
  assert.equal(tab.dataset.view, 'places');
  assert.doesNotMatch(tab.textContent, /Nothing is known/u);
  assert.deepEqual(tab.querySelectorAll('.wplaces li').map(li => li.dataset.place), ['landing', 'weir']);
  assert.match(tab.textContent, /Weir.*Hamlet · The Marsh/u);
});

test('mapped places keep the Map and add a Places switch only when some have no position', () => {
  installFakeDom();
  const mapped = { ...ATLAS, places: [place('a', 'A', { x: 10, y: 10 }), place('b', 'B')] };
  const tab = worldTab(selectWorld({ atlasView: mapped }), {});
  assert.deepEqual(tab.querySelectorAll('.wseg button').map(b => b.textContent), ['Map', 'Places']);
  assert.equal(tab.dataset.view, 'map');
  const all = worldTab(selectWorld({ atlasView: { ...ATLAS, places: [place('a', 'A', { x: 1, y: 1 })] } }), {});
  assert.equal(all.querySelectorAll('.wseg button').length, 0);
});
