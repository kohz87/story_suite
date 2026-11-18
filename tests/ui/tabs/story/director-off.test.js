// With the Story Director off the Director view is one plain card: no plan bar, no arc planner button, no dead cards (soak bug #4). Trackers still work.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { buildStory } from '../../../../ui/fixtures/story.js';
import { storyTab } from '../../../../ui/tabs/story/story.js';
import { makeCtx } from './helpers.js';

test('Director off: one "Story Director is off" card and nothing that plans', () => {
  installFakeDom();
  const story = buildStory({ planShown: true });
  const tab = storyTab({ ...story, plan: { ...story.plan, off: true } }, makeCtx());
  assert.deepEqual(tab.querySelectorAll('[data-card]').map(c => c.dataset.card), ['director-off']);
  assert.match(tab.textContent, /Story Director is off/);
  assert.equal(tab.querySelector('[data-act="arc-plan"]'), null);
  assert.equal(tab.querySelector('.spobar'), null);
  assert.ok(tab.querySelector('.wseg'), 'the Director / Trackers switch stays');
});

test('Director on: the cards are as before', () => {
  installFakeDom();
  const tab = storyTab(buildStory(), makeCtx());
  assert.ok(tab.querySelector('[data-act="arc-plan"]'));
  assert.equal(tab.querySelector('[data-card="director-off"]'), null);
});
