// Story › Director (owner, drop 2): with the plan hidden the tab printed "null" (the real DOM's replaceChildren writes a null argument as the
// text "null"); now replaceChildren gets nodes only, and with no plan the no-plan line shows whether the plan is hidden or shown.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { selectStory } from '../../../../ui/select/story.js';
import { storyTab } from '../../../../ui/tabs/story/story.js';
import { makeCtx } from './helpers.js';

const EMPTY = { beats: [], clocks: [], hooks: [], agendas: [], secrets: [] };

// Records every argument the tab's elements are given through replaceChildren, as the browser would see them.
function spyReplace(doc) {
  const seen = [];
  const proto = Object.getPrototypeOf(doc.createElement('div'));
  const real = proto.replaceChildren;
  proto.replaceChildren = function (...nodes) { seen.push(...nodes); return real.apply(this, nodes.filter(n => n !== null && n !== undefined)); };
  return { seen, restore: () => { proto.replaceChildren = real; } };
}

for (const planShown of [false, true]) {
  test(`no "null" in the Director view with the plan ${planShown ? 'shown' : 'hidden'}, no arc and no plan`, t => {
    const doc = installFakeDom();
    const spy = spyReplace(doc);
    t.after(spy.restore);
    const story = selectStory(name => (name === 'director.plan' ? EMPTY : null), { planShown, threadsOn: true });
    assert.match(story.plan.note, /no plan yet/, 'the no-plan line, hidden or shown');
    const tab = storyTab(story, makeCtx());
    assert.deepEqual(spy.seen.filter(n => n === null || n === undefined || typeof n === 'boolean'), [], 'replaceChildren gets nodes only');
    assert.equal(/\bnull\b/.test(tab.textContent), false);
    assert.match(tab.querySelector('[data-note="plan"]').textContent, /no plan yet/);
  });
}

test('with the plan hidden and something planned there is no line and still no "null"', t => {
  const doc = installFakeDom();
  const spy = spyReplace(doc);
  t.after(spy.restore);
  const plan = { ...EMPTY, beats: [{ key: 'Ambush', summary: 'The bridge ambush', fields: {} }] };
  const story = selectStory(name => (name === 'director.plan' ? plan : null), { planShown: false, threadsOn: true });
  assert.equal(story.plan.note, '');
  const tab = storyTab(story, makeCtx());
  assert.deepEqual(spy.seen.filter(n => n === null || n === undefined || typeof n === 'boolean'), []);
  assert.equal(/\bnull\b/.test(tab.textContent), false);
  assert.equal(tab.querySelector('[data-note="plan"]'), null);
});
