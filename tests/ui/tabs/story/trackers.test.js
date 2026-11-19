import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { buildStory } from '../../../../ui/fixtures/story.js';
import { createPrefs } from '../../../../ui/runtime/prefs.js';
import { trackersView } from '../../../../ui/tabs/story/trackers.js';
import { makeCtx } from './helpers.js';

test('each tracker is a card with its fields; bars carry a tone and width', () => {
  installFakeDom();
  const view = trackersView(buildStory(), makeCtx());
  const cards = view.querySelectorAll('[data-card="tracker"]');
  assert.deepEqual(cards.map(c => c.dataset.trackerId), ['chapel-debt', 'ships-stores']);
  assert.equal(cards[0].querySelectorAll('.fld').length, 3);
  assert.match(cards[0].textContent, /Owed.*120 silver/);
  const bar = cards[0].querySelector('.fld i b');
  assert.equal(bar.className, 'tone-bad');
  assert.equal(bar.style.getPropertyValue('width'), '83%');
  assert.equal(cards[0].querySelectorAll('.fld i').length, 2);
});

test('the pack-hidden tracker is counted, never drawn, and the footer adds up', () => {
  installFakeDom();
  const view = trackersView(buildStory(), makeCtx());
  assert.match(view.textContent, /1 tracker is hidden by the pack/);
  assert.match(view.textContent, /2 here, 1 hidden by the pack/);
});

test('a tracker card has no Show on Now switch: Now is gone and every tracker is on this page', () => {
  installFakeDom();
  const view = trackersView(buildStory(), makeCtx());
  assert.equal(view.querySelectorAll('[role="switch"]').length, 0);
  assert.doesNotMatch(view.textContent, /on Now/);
});

test('no trackers shows a pointer to Settings; hidden-only still shows the count', () => {
  installFakeDom();
  assert.match(trackersView(buildStory({ empty: true })).textContent, /No trackers yet/);
  assert.match(trackersView({ trackers: [], trackersHidden: 2 }).textContent, /2 trackers are hidden by the pack/);
  assert.match(trackersView().textContent, /No trackers yet/);
});

test('the limits line names one limit: 28 blocks in all', () => {
  installFakeDom();
  const line = trackersView(buildStory(), makeCtx()).querySelector('p.fine').textContent;
  assert.match(line, /up to 28 blocks in all/);
  assert.doesNotMatch(line, /20 trackers/);
});
