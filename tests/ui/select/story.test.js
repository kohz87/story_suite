import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { STORY_SHAPE } from '../../../ui/contract/story.js';
import { selectStory } from '../../../ui/select/story.js';

// Recorded answers, written from the real query code (the file:line is each query's definition).
// pulse.view: SD/screens/director.js:128 ({ mode, quiet, card, now, recent }); a row is pulseRow (:112).
const PULSE = {
  mode: 'lively', quiet: false, card: true,
  now: { at: 9, die: '14', skipped: false, label: 'Rumour', text: 'A carter talks about men in grey.', effect: 'rumour recorded' },
  recent: [
    { at: 8, die: '9', skipped: false, label: 'Calm', text: 'nothing happened', effect: '' },
    { at: 7, die: '—', skipped: true, label: 'Skipped', text: 'resting', effect: '' },
  ],
};
// director.arc: SD/arc/domain.js:88 ({ current: { key, desc, active, beats: { done, total } }, previous, count }).
const ARC = { current: { id: 'ar_1', key: 'The Grey Toll', desc: 'The bandits are paid from Thousand Sails.', active: true, reason: '', note: '', beats: { done: 1, total: 3 }, ended: null }, previous: null, count: 1 };
// director.plan: SD/screens/queries.js:314; each row is behindThread (:268) { id, key, summary, fields, ended }, an agenda adds steps (agendaSteps :297).
const row = (key, summary, fields = {}, more = {}) => ({ id: `th_${key}`, key, summary, fields, ended: null, ...more });
const PLAN = {
  hooks: [row('A buyer for the crate', 'A clerk offers coin.', { on: 'after the letter' })],
  clocks: [row('Rising river', 'the ford closes', { due: 'Goldwane 16', shown: 'sign' }), row('Red Cord', 'they arrive', { due: 'Goldwane 15' })],
  beats: [row('Temiwa’s request', 'She asks about the debt.', { now: 'with Temiwa', on: 'any day' }), row('Bridge ambush', 'Men stop the party.', { place: 'Auvoth bridge' })],
  agendas: [row('The hunt for Torka', 'Riders follow her trail.', { where: 'coast road', then: 'reach Bluewatch Goldwane 15' }, { steps: { at: 1, of: 3, line: 'step 1 of 3 · since Goldwane 12', place: 'coast road, 30 km out', arriving: false } })],
  secrets: [row('Second ledger', '', {})], problems: [], any: true,
};
// director.cast.counts: SD/cast/queries.js:60 ({ met, total, unmet }, null while the cast is off).
const COUNTS = { met: 2, total: 6, unmet: 4 };
// ripples.sway: SD/ripples/index.js:362 ([{ id, name, sway, reasons }]).
const SWAY = [{ id: 'council', name: 'Council of Sails', sway: 40, reasons: [] }, { id: 'cord', name: 'Red Cord', sway: 35, reasons: [] }];
// dataModules.setup: SB/data-modules/part/factory.js:60 (rows with module, pinned, definition); dataModules.view: views.js:51 ({ chat: { field: value } }).
const SETUP = [
  { module: 'debt', pinned: true, definition: { name: 'Chapel debt', scope: 'chat', show: { card: true }, schema: { owed: { type: 'int', min: 0, max: 120 }, mood: { type: 'int', min: 0, max: 3, names: { 2: 'steady' } } } } },
  { module: 'stores', pinned: true, definition: { name: 'Ship’s stores', scope: 'chat', schema: {} } },
  { module: 'party', pinned: true, definition: { name: 'Per person', scope: 'character' } },
  { module: 'idle', pinned: false, definition: { name: 'Not pinned', scope: 'chat' } },
];
const VIEWS = { debt: { chat: { owed: 100, mood: 2, note: 'Due Goldwane 30' } }, stores: { chat: { rations: 14 } }, party: { characters: [] } };

function recorded(overrides = {}) {
  const answers = { 'pulse.view': PULSE, 'director.arc': ARC, 'director.plan': PLAN, 'director.cast.counts': COUNTS, 'ripples.sway': SWAY, 'dataModules.setup': SETUP, ...overrides };
  return (name, args) => (name === 'dataModules.view' ? VIEWS[args.module] ?? null : answers[name] ?? null);
}

describe('selectStory', () => {
  it('fits the contract shape with the plan shown or hidden', () => {
    for (const planShown of [false, true]) {
      assert.deepEqual(checkShape(selectStory(recorded(), { planShown }), STORY_SHAPE), [], String(planShown));
    }
  });

  it('keeps the counts but no items while the plan is hidden', () => {
    const vm = selectStory(recorded());
    assert.equal(vm.plan.shown, false);
    for (const key of ['beats', 'clocks', 'hooks', 'agendas', 'secrets', 'ripples']) assert.deepEqual(vm[key].items, [], key);
    assert.deepEqual([vm.beats.count, vm.clocks.count, vm.hooks.count, vm.agendas.count, vm.secrets.count, vm.ripples.count], [2, 2, 1, 1, 1, 2]);
    assert.deepEqual(vm.arc, { accepted: null, plan: null });
  });

  it('hides what a roll was and caused while the plan is hidden', () => {
    const { pulse } = selectStory(recorded());
    assert.deepEqual(pulse.latest, { roll: 14, kind: null, cause: null });
    assert.deepEqual(pulse.recent[0], { skipped: false, roll: '9', kind: 'Rolled', text: '', effect: null });
    assert.deepEqual(pulse.recent[1], { skipped: true, roll: null, kind: 'Skipped', text: 'resting', effect: null });
  });

  it('shows the roll, its kind and its effect with the plan', () => {
    const { pulse } = selectStory(recorded(), { planShown: true });
    assert.deepEqual(pulse.latest, { roll: 14, kind: 'Rumour', cause: 'rumour recorded' });
    assert.deepEqual(pulse.recent[0], { skipped: false, roll: '9', kind: 'Calm', text: 'nothing happened', effect: null });
  });

  it('reports a quiet scene with no latest roll', () => {
    const { pulse } = selectStory(recorded({ 'pulse.view': { ...PULSE, quiet: true } }));
    assert.deepEqual([pulse.quiet, pulse.latest], [true, null]);
  });

  it('reads the pulse as off while pulse.view is absent', () => {
    assert.deepEqual(selectStory(recorded({ 'pulse.view': null })).pulse, { mode: 'off', quiet: false, latest: null, recent: [] });
  });

  it('shows the arc plan with the plan', () => {
    assert.deepEqual(selectStory(recorded(), { planShown: true }).arc, { accepted: null, plan: { title: 'The Grey Toll', text: 'The bandits are paid from Thousand Sails.', summary: '1 of 3 beats' } });
    assert.deepEqual(selectStory(recorded({ 'director.arc': { current: null, previous: null, count: 0 } }), { planShown: true }).arc, { accepted: null, plan: null });
  });

  it('maps beats, clocks and hooks', () => {
    const vm = selectStory(recorded(), { planShown: true });
    assert.deepEqual(vm.beats.items.map(b => [b.state, b.when]), [['ready', 'any day'], ['wait', 'Auvoth bridge']]);
    assert.deepEqual(vm.clocks.items.map(c => [c.due, c.shown]), [['Goldwane 16', 'sign'], ['Goldwane 15', 'none']]);
    assert.deepEqual(vm.hooks.items[0], { title: 'A buyer for the crate', text: 'A clerk offers coin.', when: 'after the letter' });
  });

  it('maps an agenda with its step line and leaves the owner and told flag empty', () => {
    const [a] = selectStory(recorded(), { planShown: true }).agendas.items;
    assert.deepEqual([a.step, a.of, a.since, a.place, a.next], [1, 3, 'Goldwane 12', 'coast road, 30 km out', 'reach Bluewatch Goldwane 15']);
    assert.deepEqual([a.who, a.whoId, a.toldThisReply], ['', null, false]);
  });

  it('names a secret and nothing more', () => {
    assert.deepEqual(selectStory(recorded(), { planShown: true }).secrets.items, [{ title: 'Second ledger', text: '', state: 'held', personId: null }]);
  });

  it('counts the cast and has no last-moved line', () => {
    assert.deepEqual(selectStory(recorded()).cast, { total: 6, met: 2, unmet: 4, lastMoved: null });
    assert.deepEqual(selectStory(recorded({ 'director.cast.counts': null })).cast, { total: 0, met: 0, unmet: 0, lastMoved: null });
  });

  it('lists ripples with their sway', () => {
    assert.deepEqual(selectStory(recorded(), { planShown: true }).ripples.items, [{ name: 'Council of Sails', sway: 40 }, { name: 'Red Cord', sway: 35 }]);
  });

  it('builds trackers from pinned chat modules: bars for bounded numbers, text, and the hidden count', () => {
    const vm = selectStory(recorded());
    assert.deepEqual(vm.trackers.map(t => [t.id, t.name, t.showOnNow]), [['debt', 'Chapel debt', true], ['stores', 'Ship’s stores', false]]);
    assert.deepEqual(vm.trackers[0].fields, [
      { label: 'owed', value: '100', kind: 'bar', pct: 83 },
      { label: 'mood', value: 'steady', kind: 'bar', pct: 67 },
      { label: 'note', value: 'Due Goldwane 30', kind: 'text' },
    ]);
    assert.deepEqual(vm.trackers[1].fields, [{ label: 'rations', value: '14', kind: 'number' }]);
    assert.equal(vm.trackersHidden, 1);
  });

  it('returns the empty Story when every query is absent', () => {
    const vm = selectStory(() => null);
    assert.deepEqual(checkShape(vm, STORY_SHAPE), []);
    assert.deepEqual([vm.pulse.mode, vm.cast.total, vm.trackers, vm.trackersHidden, vm.beats.count], ['off', 0, [], 0, 0]);
  });
});
