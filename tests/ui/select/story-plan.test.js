import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSelectors } from '../../../ui/select/build.js';
import { PREFS_KEY } from '../../../ui/port/prefs-key.js';
import { selectStory } from '../../../ui/select/story.js';

const PLAN = { beats: [{ id: 'b1', key: 'Ambush', summary: 'The bridge ambush', fields: {} }], clocks: [], hooks: [], agendas: [], secrets: [] };
const EMPTY = { beats: [], clocks: [], hooks: [], agendas: [], secrets: [] };
const readOf = plan => name => (name === 'director.plan' ? plan : null);

describe('Story: Show the plan, through the real selector map', () => {
  const storyOf = (meta, plan, features = []) => buildSelectors(() => ({ chatMetadata: meta }), { features: () => features }).story(readOf(plan));

  it('the chat pref the Show the plan button writes opens the plan (it stayed hidden before)', () => {
    assert.equal(storyOf({}, PLAN).beats.items.length, 0);
    const shown = storyOf({ [PREFS_KEY]: { plan: true } }, PLAN);
    assert.equal(shown.plan.shown, true);
    assert.equal(shown.beats.items.length, 1);
    assert.equal(shown.plan.note, '');
  });

  it('a reload or another chat reads its own pref: no pref, hidden', () => {
    assert.equal(storyOf({ [PREFS_KEY]: { plan: false } }, PLAN).plan.shown, false);
    assert.equal(storyOf({ [PREFS_KEY]: { scene: true } }, PLAN).plan.shown, false);
  });

  it('no plan yet says so in one line, shown or hidden (owner, drop 2); an arc or a counted thread is a plan, so no line', () => {
    assert.match(storyOf({ [PREFS_KEY]: { plan: true } }, EMPTY).plan.note, /no plan yet/);
    assert.match(storyOf({}, EMPTY).plan.note, /no plan yet/);
    assert.equal(storyOf({}, PLAN).plan.note, '', 'hidden with a beat: its count shows, no line');
    const arc = name => (name === 'director.plan' ? EMPTY : name === 'director.arc' ? { current: { key: 'The flood', desc: 'x', beats: { done: 0, total: 0 } } } : null);
    assert.equal(selectStory(arc, { planShown: false }).plan.note, '');
    assert.equal(selectStory(arc, { planShown: true }).plan.note, '');
  });

  it('shown with the Threads switch off names the switch', () => {
    const off = storyOf({ [PREFS_KEY]: { plan: true } }, EMPTY, [{ id: 'story-director.threads', on: false }]);
    assert.match(off.plan.note, /Threads switch in Settings/);
    assert.equal(storyOf({}, EMPTY, [{ id: 'story-director.threads', on: false }]).plan.note, '', 'hidden: the Threads line waits for Show the plan');
    assert.equal(selectStory(readOf(EMPTY), { planShown: true, threadsOn: true }).plan.note.includes('Threads'), false);
  });
});

describe('Story: Story Director off (soak bug #4)', () => {
  const feature = on => ({ id: 'story-director.threads', moduleId: 'story-director', on });
  const off = features => buildSelectors(() => ({ chatMetadata: {} }), { features: () => features }).story(readOf(PLAN)).plan.off;
  it('the view says off only while every Story Director switch is off', () => {
    assert.equal(off([feature(false), { ...feature(false), id: 'story-director.pulse' }]), true);
    assert.equal(off([feature(false), { ...feature(true), id: 'story-director.pulse' }]), false);
    assert.equal(off([{ id: 'story-block.x', moduleId: 'story-block', on: true }]), false, 'no Director switches listed: not off');
    assert.equal(off([]), false);
  });
});
