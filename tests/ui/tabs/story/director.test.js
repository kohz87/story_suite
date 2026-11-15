import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../../packages/story-block/tests/ui-fake-dom.js';
import { buildStory } from '../../../../ui/fixtures/story.js';
import { createPrefs } from '../../../../ui/runtime/prefs.js';
import { directorCards, gatedCard, planBar } from '../../../../ui/tabs/story/director.js';
import { makeCtx } from './helpers.js';

const text = el => (el ? el.textContent : '');

test('gatedCard hides an empty group, shows counts when hidden and rows when shown', () => {
  installFakeDom();
  const group = { count: 2, items: [{ n: 'a' }, { n: 'b' }] };
  const row = i => ({ nodeType: 1, textContent: i.n, ...{} });
  assert.equal(gatedCard('Beats', { count: 0, items: [] }, true, row), null);
  assert.equal(gatedCard('Beats', undefined, true, row), null);
  const hidden = gatedCard('Beats', { count: 1, items: [] }, false, row);
  assert.match(text(hidden), /1 is hidden/);
  assert.match(text(gatedCard('Beats', group, false, row)), /2 are hidden/);
  assert.equal(gatedCard('Hooks it', group, false, row).dataset.card, 'hooks-it');
});

test('planBar labels both states and reports the opposite value', () => {
  installFakeDom();
  const seen = [];
  const off = planBar(false, v => seen.push(v));
  assert.match(text(off), /Plan spoilers hidden/);
  off.querySelector('[data-act="plan"]').click();
  const on = planBar(true, v => seen.push(v));
  assert.match(text(on), /Hide the plan/);
  on.querySelector('[data-act="plan"]').click();
  assert.deepEqual(seen, [true, false]);
});

test('pulse hides what a roll caused until the plan is shown', () => {
  installFakeDom();
  const hid = directorCards(buildStory())[0];
  assert.equal(hid.querySelector('.die').textContent, '?');
  assert.match(text(hid), /Rolled this reply/);
  assert.equal(hid.querySelectorAll('.rrow').length, 5);
  assert.match(text(hid.querySelectorAll('.rrow')[0]), /part of the plan/);
  assert.match(text(hid.querySelectorAll('.rrow')[2]), /Skipped.*quiet scene/);
  const shown = directorCards(buildStory({ planShown: true }))[0];
  assert.equal(shown.querySelector('.die').textContent, '14');
  assert.match(text(shown), /Rumour/);
  assert.match(text(shown), /rumour recorded/);
});

test('quiet scene shows its note and the switch sends pulse.quiet', () => {
  installFakeDom();
  const ctx = makeCtx();
  const quiet = directorCards(buildStory({ quiet: true }), ctx)[0];
  assert.match(text(quiet), /Quiet scene: no rolls/);
  assert.equal(quiet.querySelector('.die'), null);
  directorCards(buildStory(), ctx)[0].querySelector('[role="switch"]').click();
  assert.deepEqual(ctx.calls.command, [['pulse.quiet', { on: true }]]);
});

test('cast shows counts only and never names the unmet', () => {
  installFakeDom();
  const cast = directorCards(buildStory({ planShown: true }))[1];
  assert.deepEqual(cast.querySelectorAll('.castn b').map(b => b.textContent), ['6', '2', '4']);
  assert.match(text(cast), /Last moved Goldwane 13 at dawn/);
  assert.equal(directorCards(buildStory({ empty: true }))[1], null);
});

test('arc card plans and ends through commands and sends the note', () => {
  installFakeDom();
  const ctx = makeCtx();
  const arc = directorCards(buildStory({ planShown: true }), ctx)[2];
  assert.match(text(arc), /accepted Goldwane 12/);
  assert.match(text(arc), /The Grey Toll/);
  arc.querySelector('textarea').value = 'more Torka';
  arc.querySelector('[data-act="arc-plan"]').click();
  arc.querySelector('[data-act="arc-end"]').click();
  assert.deepEqual(ctx.calls.command, [['arc.plan', { note: 'more Torka' }], ['arc.end', {}]]);
  assert.match(text(directorCards(buildStory(), ctx)[2]), /The arc plan is hidden/);
  assert.match(text(directorCards(buildStory({ empty: true, planShown: true }))[2]), /No arc is planned yet/);
});

test('beats, clocks, hooks and news render their rows with plan on', () => {
  installFakeDom();
  const c = directorCards(buildStory({ planShown: true }));
  assert.match(text(c[3]), /Temiwa’s request.*ready/);
  assert.match(text(c[3]), /The bridge ambush.*waiting/);
  assert.match(text(c[4]), /due Goldwane 16.*shown in the story: a sign/);
  assert.match(text(c[4]), /shown in the story: not yet/);
  assert.match(text(c[5]), /A buyer for the east-quay crate/);
  assert.match(text(c[6]), /reaches you Goldwane 14/);
  assert.equal(directorCards(buildStory({ empty: true })).filter(Boolean).length, 2);
});
