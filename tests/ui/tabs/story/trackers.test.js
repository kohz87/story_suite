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
  assert.match(view.textContent, /2 here, 1 hidden by the pack, 1 shown on Now/);
});

test('Show on Now and Edit send tracker commands with the id', () => {
  installFakeDom();
  const ctx = makeCtx();
  const view = trackersView(buildStory(), ctx);
  const second = view.querySelectorAll('[data-card="tracker"]')[1];
  second.querySelector('[role="switch"]').click();
  second.querySelector('[data-act="edit"]').click();
  assert.deepEqual(ctx.calls.command, [['tracker.pin', { id: 'ships-stores', on: true }], ['tracker.edit', { id: 'ships-stores' }]]);
  assert.equal(view.querySelectorAll('[role="switch"]')[0].getAttribute('aria-checked'), 'true');
});

test('no trackers shows a pointer to Settings; hidden-only still shows the count', () => {
  installFakeDom();
  assert.match(trackersView(buildStory({ empty: true })).textContent, /No trackers yet/);
  assert.match(trackersView({ trackers: [], trackersHidden: 2 }).textContent, /2 trackers are hidden by the pack/);
  assert.match(trackersView().textContent, /No trackers yet/);
});
