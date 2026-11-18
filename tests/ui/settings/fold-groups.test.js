// Every Settings page's cards fold: the card title is a button with aria-expanded, a folded card shows only its title, and the fold is kept
// per device (the prefs' folds in local storage), so a new overlay, and a new prefs store over the same storage, opens it folded.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { buildSettings } from '../../../ui/fixtures/settings.js';
import { createSettingsOverlay } from '../../../ui/settings/overlay.js';
import { renderSettingsSection } from '../../../ui/settings/sections/index.js';
import { createPrefs } from '../../../ui/runtime/prefs.js';
import { foldKey } from '../../../ui/settings/fold-groups.js';

function storage() {
  const data = new Map();
  return { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), data };
}
function open(prefs, id = 'people') {
  const doc = installFakeDom();
  const ov = createSettingsOverlay({ doc, settings: buildSettings(), renderSection: renderSettingsSection, onChange: () => {}, onAction: () => {}, prefs });
  ov.open(id);
  return { ov, page: () => ov.el.querySelector('.spage') };
}
const card = (page, name) => page.querySelectorAll('.sgrp').find(c => c.querySelector('.gt').textContent === name);

test('each card title on every page is a button that starts expanded; the title text stays the card name', () => {
  const { ov, page } = open(createPrefs({ storage: storage() }));
  for (const id of ['look', 'people', 'rpg', 'world', 'director', 'money', 'extras', 'packs', 'tools', 'start']) {
    ov.show(id);
    const titles = page().querySelectorAll('.sgrp > .gt');
    // Chat extras' groups are hidden while their features are off (the default), so that page may draw no card.
    if (id !== 'extras') assert.ok(titles.length > 0, id);
    for (const t of titles) {
      assert.equal(t.tagName, 'BUTTON', `${id}: ${t.textContent}`);
      assert.equal(t.getAttribute('type'), 'button');
      assert.equal(t.getAttribute('aria-expanded'), 'true');
    }
  }
  ov.show('look');
  assert.equal(page().querySelector('.sgrp .gt').textContent, 'Skin');
});

test('a click folds the card (only its title shows) and a second click opens it; the fold is stored per device', () => {
  const store = storage();
  const prefs = createPrefs({ storage: store });
  const { page } = open(prefs);
  const portraits = card(page(), 'Portraits');
  portraits.querySelector('.gt').click();
  assert.equal(portraits.querySelector('.gt').getAttribute('aria-expanded'), 'false');
  assert.equal(portraits.className.includes('folded'), true);
  assert.equal(prefs.getFold(foldKey('people', 'Portraits')), true);
  assert.match(store.data.get('storySuite.ui.fold'), /settings\.fold\.people\.portraits/);
  assert.equal(card(page(), 'Feelings').className.includes('folded'), false, 'other cards stay open');
  portraits.querySelector('.gt').click();
  assert.equal(portraits.querySelector('.gt').getAttribute('aria-expanded'), 'true');
  assert.equal(portraits.className.includes('folded'), false);
  assert.equal(prefs.getFold(foldKey('people', 'Portraits')), false);
});

test('a folded card is still folded in a new overlay and after a reload (new prefs over the same storage); keys are per page', () => {
  const store = storage();
  const first = open(createPrefs({ storage: store }));
  card(first.page(), 'Pacing').querySelector('.gt').click();
  first.ov.show('world');
  assert.equal(card(first.page(), 'Calendar').className.includes('folded'), false, 'another page’s card is its own');
  assert.notEqual(foldKey('people', 'Pacing'), foldKey('world', 'Pacing'));
  const again = open(createPrefs({ storage: store }));
  const pacing = card(again.page(), 'Pacing');
  assert.equal(pacing.className.includes('folded'), true);
  assert.equal(pacing.querySelector('.gt').getAttribute('aria-expanded'), 'false');
  again.ov.show('world');
  assert.equal(card(again.page(), 'Calendar').className.includes('folded'), false);
  again.ov.show('people');
  assert.equal(card(again.page(), 'Pacing').className.includes('folded'), true, 'a repaint keeps it folded');
});

test('a card whose title carries a count keeps its fold when the count changes; the search page is not folded', () => {
  assert.equal(foldKey('packs', 'Trackers in this chat · 2 of 8'), foldKey('packs', 'Trackers in this chat · 3 of 8'));
  const { ov, page } = open(createPrefs({ storage: storage() }));
  ov.setQuery('portrait');
  assert.ok(page().querySelectorAll('.sgrp').length > 0);
  assert.equal(page().querySelectorAll('.sgrp > button.gt').length, 0);
});

test('without prefs the overlay still folds (kept while it is open)', () => {
  const { ov, page } = open(undefined);
  card(page(), 'Stages').querySelector('.gt').click();
  ov.show('look');
  ov.show('people');
  assert.equal(card(page(), 'Stages').className.includes('folded'), true);
});

test('the mounted suite keeps a folded Settings card through its own prefs: closing and reopening Settings opens it folded', async () => {
  const { mountSuite } = await import('../../../ui/mount.js');
  const { createFakePort } = await import('../../../ui/port/fake-port.js');
  const doc = installFakeDom();
  const prefs = createPrefs({ storage: storage() });
  const suite = mountSuite({ port: createFakePort(), doc, prefs });
  suite.open('now');
  suite.settings();
  doc.body.querySelector('.si3[data-sec="look"]').click();
  const skin = () => doc.body.querySelectorAll('.sov .sgrp').find(c => c.querySelector('.gt').textContent === 'Skin');
  skin().querySelector('.gt').click();
  assert.equal(prefs.getFold(foldKey('look', 'Skin')), true);
  suite.settings();
  doc.body.querySelector('.si3[data-sec="look"]').click();
  assert.equal(skin().className.includes('folded'), true);
  suite.destroy();
});
