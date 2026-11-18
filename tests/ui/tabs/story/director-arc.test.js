// The Arc card with a plan waiting: Accept and Discard, the Planning… state, the error line, and the overdue mark on a clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { buildStory } from '../../../../ui/fixtures/story.js';
import { directorCards } from '../../../../ui/tabs/story/director.js';
import { makeCtx } from './helpers.js';

const arcCardOf = (arc, shown, ctx) => directorCards({ ...buildStory({ planShown: shown }), arc }, ctx)[2];
const BASE = { accepted: null, plan: null, draft: null, busy: false, error: '' };

test('a waiting plan shows Accept and Discard instead of Plan, and both send their commands', () => {
  installFakeDom();
  const ctx = makeCtx();
  const card = arcCardOf({ ...BASE, draft: { reason: 'manual', text: '+ arc Next' } }, true, ctx);
  assert.match(card.textContent, /A plan is waiting/);
  assert.match(card.textContent, /\+ arc Next/);
  assert.equal(card.querySelector('[data-act="arc-plan"]'), null);
  card.querySelector('[data-act="arc-accept"]').click();
  card.querySelector('[data-act="arc-discard"]').click();
  assert.deepEqual(ctx.calls.command, [['arc.accept', {}], ['arc.discard', {}]]);
});

test('with the plan hidden a waiting plan names nothing but can still be accepted or discarded', () => {
  installFakeDom();
  const card = arcCardOf({ ...BASE, draft: { reason: 'manual', text: '' } }, false, makeCtx());
  assert.doesNotMatch(card.textContent, /\+ arc/);
  assert.ok(card.querySelector('[data-act="arc-accept"]') && card.querySelector('[data-act="arc-discard"]'));
});

test('planning shows a disabled Planning… button, an error shows its line, and an accepted arc without a date says only accepted', () => {
  installFakeDom();
  const busy = arcCardOf({ ...BASE, busy: true, error: 'Planning failed: x' }, true, makeCtx());
  assert.equal(busy.querySelector('[data-act="arc-plan"]').textContent, 'Planning…');
  assert.match(busy.textContent, /Planning failed: x/);
  assert.match(arcCardOf({ ...BASE, accepted: '' }, true, makeCtx()).textContent, /accepted(?! )/);
  assert.match(arcCardOf({ ...BASE, accepted: 'Goldwane 3' }, true, makeCtx()).textContent, /accepted Goldwane 3/);
});

test('a past-due clock is marked overdue', () => {
  installFakeDom();
  const story = buildStory({ planShown: true });
  story.clocks = { count: 1, items: [{ title: 'Thaw', text: '', due: 'December 5', shown: 'none', overdue: true }] };
  const clocks = directorCards(story, makeCtx()).find(card => card?.dataset?.card === 'clocks');
  assert.match(clocks.textContent, /overdue · due December 5/);
});
