import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { worldFor } from '../../../../ui/fixtures/world.js';
import { createBackStack } from '../../../../ui/runtime/back-stack.js';
import { worldTab } from '../../../../ui/tabs/world/world.js';

function setup(variant = 'default', extra = {}) {
  const went = [];
  const edits = [];
  const back = createBackStack();
  const ctx = { rpg: true, back, go: (t, a) => went.push([t, a]), edit: t => edits.push(t), ...extra };
  const tab = worldTab(worldFor(variant), ctx);
  return { tab, went, edits, back };
}
const view = tab => tab.dataset.view;
const pressed = tab => tab.querySelectorAll('.wseg button').filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent);

test('World opens on the Map with a Map / News / Factions switch', () => {
  installFakeDom();
  const { tab } = setup();
  assert.equal(tab.dataset.tab, 'world');
  assert.equal(view(tab), 'map');
  assert.deepEqual(tab.querySelectorAll('.wseg button').map(b => b.textContent), ['Map', 'News', 'Factions']);
  assert.deepEqual(pressed(tab), ['Map']);
  assert.ok(tab.querySelector('[data-card="map"]'));
  assert.equal(tab.querySelector('[data-card="news"]'), null);
});

test('the switch swaps the body and keeps one card at a time', () => {
  installFakeDom();
  const { tab } = setup();
  tab.querySelector('.wseg [data-value="news"]').click();
  assert.equal(view(tab), 'news');
  assert.ok(tab.querySelector('[data-card="news"]'));
  assert.equal(tab.querySelector('[data-card="map"]'), null);
  assert.deepEqual(pressed(tab), ['News']);
  tab.querySelector('.wseg [data-value="factions"]').click();
  assert.ok(tab.querySelector('[data-card="factions"]'));
  assert.deepEqual(pressed(tab), ['Factions']);
  tab.querySelector('.wseg [data-value="map"]').click();
  assert.ok(tab.querySelector('[data-card="map"]'));
});

test('tapping a place opens its sheet, marks it selected, and closing clears both', () => {
  installFakeDom();
  const { tab, back } = setup();
  tab.querySelector('[data-pl="auvoth"]').click();
  assert.ok(tab.querySelector('[data-sheet="place"]'));
  assert.equal(tab.querySelector('.wsheet .dn').textContent, 'Auvoth');
  assert.deepEqual(tab.querySelectorAll('.pl.sel').map(g => g.dataset.pl), ['auvoth']);
  assert.equal(back.top().layer, 'sheet');
  tab.querySelector('.wsheet .x').click();
  assert.equal(tab.querySelector('[data-sheet="place"]'), null);
  assert.equal(tab.querySelectorAll('.pl.sel').length, 0);
  assert.equal(back.top(), null);
});

test('Escape through the back-stack closes the sheet; opening another place replaces it', () => {
  installFakeDom();
  const { tab, back } = setup();
  tab.querySelector('[data-pl="hollin"]').click();
  tab.querySelector('[data-pl="oldweir"]').click();
  assert.equal(tab.querySelectorAll('[data-sheet="place"]').length, 1);
  assert.equal(tab.querySelector('.wsheet .dn').textContent, 'Old Weir');
  back.back();
  assert.equal(tab.querySelector('[data-sheet="place"]'), null);
  assert.equal(back.top(), null);
});

test('the scrim closes the sheet; the sheet works without a back-stack', () => {
  installFakeDom();
  const { tab } = setup('default', { back: null });
  tab.querySelector('[data-pl="auvoth"]').click();
  tab.querySelector('[data-sheet="place"]').click();
  assert.equal(tab.querySelector('[data-sheet="place"]'), null);
});

test('a place link in News jumps to the map, centres on that place and opens its sheet', () => {
  installFakeDom();
  const { tab } = setup();
  tab.querySelector('.wseg [data-value="news"]').click();
  tab.querySelector('[data-goto="wolfmere"]').click();
  assert.equal(view(tab), 'map');
  assert.equal(tab.querySelector('.wsheet .dn').textContent, 'Wolfmere Outpost');
  assert.deepEqual(tab.querySelectorAll('.pl.sel').map(g => g.dataset.pl), ['wolfmere']);
  const vb = tab.querySelector('svg.mp').getAttribute('viewBox').split(' ').map(Number);
  assert.equal(Math.round(vb[0] + vb[2] / 2), 170);
});

test('faction and news links switch views and close an open sheet', () => {
  installFakeDom();
  const { tab, back } = setup();
  tab.querySelector('[data-pl="auvoth"]').click();
  tab.querySelector('.wseg [data-value="news"]').click();
  assert.equal(tab.querySelector('[data-sheet="place"]'), null);
  assert.equal(back.top(), null);
  tab.querySelector('[data-wf="factions"]').click();
  assert.equal(view(tab), 'factions');
  tab.querySelector('[data-wf="news"]').click();
  assert.equal(view(tab), 'news');
});

test('People links and Edit buttons go through ctx', () => {
  installFakeDom();
  const { tab, went, edits } = setup();
  tab.querySelector('[data-pl="bluewatch"]').click();
  tab.querySelector('.plink').click();
  assert.deepEqual(went, [['people', { personId: 'temiwa' }]]);
  tab.querySelector('.wsheet .ed').click();
  assert.deepEqual(edits, [{ kind: 'place', id: 'bluewatch' }]);
  tab.querySelector('.wseg [data-value="factions"]').click();
  tab.querySelector('[data-person-id="brann"]').click();
  assert.deepEqual(went[1], ['people', { personId: 'brann' }]);
});

test('Story-only chats hide danger words in the sheet', () => {
  installFakeDom();
  const { tab } = setup('default', { rpg: false });
  tab.querySelector('[data-pl="wolfmere"]').click();
  assert.equal(tab.querySelector('.wsheet .dz'), null);
});

test('ctx.view picks the first view; an unavailable view falls back to the first available one', () => {
  installFakeDom();
  assert.equal(view(worldTab(worldFor(), { view: 'factions' })), 'factions');
  assert.equal(view(worldTab({ ...worldFor(), places: [] }, { view: 'map' })), 'news');
});

test('views with nothing in them are left out; one view gives no switch', () => {
  installFakeDom();
  const onlyNews = worldTab({ ...worldFor(), places: [], factions: [] });
  assert.equal(onlyNews.querySelector('.wseg'), null);
  assert.ok(onlyNews.querySelector('[data-card="news"]'));
  const noNews = worldTab({ ...worldFor(), news: [] });
  assert.deepEqual(noNews.querySelectorAll('.wseg button').map(b => b.textContent), ['Map', 'Factions']);
});

test('an empty world, or no world at all, shows a note and no cards', () => {
  installFakeDom();
  for (const w of [worldFor('empty'), undefined, {}, { places: null }]) {
    const tab = worldTab(w);
    assert.equal(tab.querySelectorAll('[data-card]').length, 0);
    assert.equal(tab.querySelector('.wseg'), null);
    assert.equal(view(tab), 'none');
    assert.match(tab.textContent, /Nothing is known about the world yet/);
  }
});

test('the fight-open variant opens on a map with the bridge and the road trip', () => {
  installFakeDom();
  const { tab } = setup('fightOpen');
  assert.ok(tab.querySelector('[data-pl="auvoth-bridge"]'));
  assert.equal(tab.querySelector('[data-card="trip"] .th small').textContent, 'on the road · leg 3 of 3');
});

test('World is built without innerHTML', () => {
  installFakeDom();
  const { tab } = setup();
  assert.equal(tab.innerHTML.includes('<'), false);
});
