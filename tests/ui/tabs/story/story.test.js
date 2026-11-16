import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { buildStory } from '../../../../ui/fixtures/story.js';
import { createPrefs } from '../../../../ui/runtime/prefs.js';
import { checkShape } from '../../../../ui/contract/shapes.js';
import { STORY_SHAPE } from '../../../../ui/contract/story.js';
import { storyTab } from '../../../../ui/tabs/story/story.js';
import { makeCtx } from './helpers.js';

test('fixture variants match the Story shape', () => {
  for (const o of [{}, { planShown: true }, { quiet: true }, { empty: true }]) {
    assert.deepEqual(checkShape(buildStory(o), STORY_SHAPE), [], JSON.stringify(o));
  }
});

test('Director shows the plan bar and the cards in order, counts only while the plan is hidden', () => {
  installFakeDom();
  const tab = storyTab(buildStory(), makeCtx());
  assert.equal(tab.dataset.tab, 'story');
  assert.deepEqual(tab.querySelectorAll('[data-card]').map(c => c.dataset.card),
    ['plan-bar', 'pulse', 'cast', 'arc', 'beats', 'clocks', 'agendas', 'hooks-the-story-is-planning', 'news-on-its-way', 'secrets', 'ripples']);
  assert.match(tab.querySelector('.spobar').textContent, /Plan spoilers hidden/);
  assert.equal(tab.textContent.includes('The bridge ambush'), false);
  assert.match(tab.textContent, /3 are hidden/);
});

test('with the plan shown the details appear and the button says Hide the plan', () => {
  installFakeDom();
  const tab = storyTab(buildStory({ planShown: true }), makeCtx());
  assert.match(tab.querySelector('.spobar').textContent, /Hide the plan/);
  assert.match(tab.textContent, /The bridge ambush/);
  assert.match(tab.textContent, /The Grey Toll/);
});

test('the plan button stores the per-chat Plan spoiler and asks for a refresh', () => {
  installFakeDom();
  const ctx = makeCtx();
  const tab = storyTab(buildStory(), ctx);
  tab.querySelector('[data-act="plan"]').click();
  assert.equal(ctx.prefs.getSpoiler('plan'), true);
  assert.deepEqual(ctx.calls.refresh, [true]);
});

test('Trackers view switches in place and the choice is remembered on the device', () => {
  installFakeDom();
  const ctx = makeCtx();
  const tab = storyTab(buildStory(), ctx);
  const buttons = tab.querySelectorAll('.seg button');
  assert.equal(buttons.length, 2);
  buttons[1].click();
  assert.equal(tab.querySelector('.story-body').dataset.view, 'trackers');
  assert.equal(tab.querySelectorAll('[data-card="tracker"]').length, 2);
  assert.equal(tab.querySelector('.spobar'), null);
  assert.equal(storyTab(buildStory(), ctx).querySelector('.story-body').dataset.view, 'trackers');
  buttons[0].click();
  assert.ok(tab.querySelector('.spobar'));
});

test('an empty chat keeps the plan bar and the arc but drops every empty card', () => {
  installFakeDom();
  const tab = storyTab(buildStory({ empty: true }), makeCtx());
  assert.deepEqual(tab.querySelectorAll('[data-card]').map(c => c.dataset.card), ['plan-bar', 'pulse', 'arc']);
});

test('storyTab tolerates no view-model at all', () => {
  installFakeDom();
  const tab = storyTab(undefined, undefined);
  assert.ok(tab.querySelector('.spobar'));
});
