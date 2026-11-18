// Generated arcs in the daily step (pure): the plan is copied into the step's state when the slot applies, steps fire on their windows,
// the ending records `arc-ended`, the guardrails refuse a bad plan, a major step holds a realm slot, and a template with no `arc` is unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runDays, makeWs } from '../../../../modules/world/daily/step.js';
import { checkAnswer } from '../../../../modules/world/daily/arc-plan.js';
import { capBlock } from '../../../../modules/world/daily/caps.js';
import { readDefs } from '../../../../modules/world/daily/defs.js';
import { anchorHolds } from '../../../../modules/world/daily/anchors.js';
import { WORLD, answerFor, open } from './open-host.helpers.js';

const STEP = { name: 'Rumours', summary: 'Rumours spread in the market.', people: ['warden'], effects: { set: [{ condition: 'unrest', for: '3 days' }] }, after: 3, within: 3 };
const ENDING = { name: 'Calm', summary: 'The trouble fades.', effects: { fact: 'incident-noted' }, after: 2, within: 2 };
const ARC = { steps: [STEP], ending: ENDING };
const world = (extra = {}) => ({ ...WORLD, templates: [open('arc-t', { arc: { steps: [2, 3] } })], ...extra });
const base = (spec, over = {}) => ({ world: spec, today: 10, seed: 'seed1', draw: () => 0, ...over });
const stored = (key, arc) => ({ outcome: 'ok', answer: JSON.stringify({ ...answerFor(key), ...(arc ? { arc } : {}) }) });

/** The slot rolled on day 10 and its stored answer applied: the state with the arc running. */
function started(arc = ARC, spec = world(), over = {}) {
    const first = runDays({ ...base(spec), ...over, state: over.state ?? null });
    const [slot] = first.daily.pending;
    const done = runDays({ ...base(spec), ...over, state: first.daily, table: first.conditions, settle: true, opens: { results: { [slot.key]: stored(slot.key, arc) } } });
    return { slot, done };
}
const go = (spec, from, today) => runDays({ ...base(spec, { today }), state: from.daily, table: from.conditions });

test('the plan is copied into the state when the slot applies; the opening happening is step 1', () => {
    const { slot, done } = started();
    const arc = done.daily.arcs[slot.key];
    assert.equal(arc.state, 'running');
    assert.equal(arc.next, 0);
    assert.equal(arc.steps.length, 2, 'one later step and the ending');
    assert.equal(arc.steps[1].ending, true);
    assert.equal(done.daily.slots[slot.key].outcome, 'ok');
    assert.ok(done.report.journal.some(row => row.title === 'Border scuffle'), 'the opening was written');
});

test('steps fire on their windows and the ending records arc-ended and its fact', () => {
    const spec = world();
    const { slot, done } = started();
    const early = go(spec, done, 12);
    assert.equal(early.daily.arcs[slot.key].next, 0, 'the window opens 3 days after the start');
    const middle = go(spec, early, 13);
    assert.equal(middle.daily.arcs[slot.key].next, 1);
    assert.ok(middle.report.journal.some(row => row.title === 'Rumours' && row.day === 13));
    const mid2 = go(spec, middle, 14);
    assert.equal(mid2.daily.arcs[slot.key].state, 'running');
    const end = go(spec, mid2, 15);
    assert.equal(end.daily.arcs[slot.key].state, 'ended');
    assert.ok(end.daily.facts['incident-noted'], 'the ending wrote its fact');
    const { ws } = makeWs({ state: end.daily, world: spec, today: 16, seed: 'seed1' });
    assert.equal(anchorHolds(ws, `arc-ended:arc-t@${slot.place}`, 16), true, 'by place');
    assert.equal(anchorHolds(ws, 'arc-ended:arc-t@The March', 16), true, 'by region, any case');
    assert.equal(anchorHolds(ws, 'arc-ended:arc-t@March Realm', 16), true, 'by realm');
    assert.equal(anchorHolds(ws, 'arc-ended:arc-t@elsewhere', 16), false);
    assert.equal(go(spec, mid2, 15).daily.arcs[slot.key].ended, 15);
});

test('an authored event may anchor on arc-ended; it is read as an anchor, not a condition, and is not a condition read', () => {
    const event = { id: 'aftermath', kind: 'one-off', certainty: 'possible', window: { after: 'arc-ended:arc-t@The March', within: '10 days' }, ends_when: 'instant', effects: {} };
    const gated = { ...event, id: 'gated', requires: ['arc-ended:arc-t@The March'], window: undefined };
    const defs = readDefs({ ...world(), events: [event, gated] });
    assert.deepEqual(defs.warnings, []);
    assert.equal(defs.events.length, 2);
    const { ws } = makeWs({ world: { ...world(), events: [event, gated] }, today: 1, seed: 's' });
    assert.equal(ws.reads.conds.has('arc-t'), false);
});

test('a plan is refused as a whole: step count, a pick outside the menu, protected cast, a condition an authored event reads, a missing window', () => {
    const readsGates = { id: 'gates-law', kind: 'one-off', requires: ['closed-gates@region'], ends_when: 'instant', effects: {} };
    const { ws } = makeWs({ world: world({ events: [readsGates] }), today: 10, seed: 's' });
    const def = ws.templates.get('arc-t');
    const bind = { place: 'Highmark', region: 'The March', realm: 'March Realm' };
    const answer = arc => ({ ...answerFor('k'), arc });
    const ok = checkAnswer(ws, def, bind, answer(ARC), 10);
    assert.deepEqual(ok.errors, []);
    assert.equal(ok.plan.steps.length, 2);
    const bad = (arc, pattern) => { const out = checkAnswer(ws, def, bind, answer(arc), 10); assert.match(out.errors.join(' '), pattern); assert.equal(out.plan, undefined); };
    bad({ steps: [STEP, STEP], ending: ENDING }, /happenings in all/);
    bad({ steps: [{ ...STEP, effects: { powers: { crown: 50 } } }], ending: ENDING }, /arc step 2/);
    bad({ steps: [{ ...STEP, effects: { set: [{ condition: 'closed-gates', for: '2 days' }] } }], ending: ENDING }, /read by an authored event/);
    bad({ steps: [{ ...STEP, people: ['queen'] }], ending: ENDING }, /may name/);
    bad({ steps: [{ ...STEP, effects: { cast: [{ id: 'queen', to: 'Bluewatch' }] } }], ending: ENDING }, /figure the menu/);
    bad({ steps: [{ ...STEP, after: undefined }], ending: ENDING }, /whole days/);
    bad({ steps: [STEP], ending: { ...ENDING, effects: { fact: 'invented' } } }, /writes_facts/);
    bad({ steps: [STEP] }, /ending/);
});

test('a template with no arc ignores an arc key: the same state as the plain answer', () => {
    const spec = { ...WORLD, templates: [open('plain-t')] };
    const first = runDays({ ...base(spec), state: null });
    const [slot] = first.daily.pending;
    const run = arc => runDays({ ...base(spec), state: first.daily, table: first.conditions, settle: true, opens: { results: { [slot.key]: stored(slot.key, arc) } } });
    assert.equal(JSON.stringify(run(ARC)), JSON.stringify(run(undefined)));
    assert.equal(run(ARC).daily.arcs, undefined);
});

test('a major step holds one realm slot while the arc runs and resets the 45-day timer; a blocked arc falls back', () => {
    const major = { steps: [{ ...STEP, severity: 'major' }], ending: ENDING };
    const { slot, done } = started(major);
    assert.equal(done.daily.arcs[slot.key].major, true);
    assert.equal(done.daily.lastMajor['March Realm'], 10, 'the timer restarts when the arc starts');
    // Within 45 days another major is blocked (the timer); two running major arcs fill the realm.
    const { ws } = makeWs({ state: done.daily, world: world(), today: 20, seed: 'seed1' });
    assert.match(capBlock(ws, ['March Realm'], 20), /less than 45 days/);
    ws.lastMajor = {};
    assert.equal(capBlock(ws, ['March Realm'], 60), '', 'one running arc leaves one slot');
    ws.arcs.second = { ...ws.arcs[slot.key] };
    assert.match(capBlock(ws, ['March Realm'], 60), /already has 2 active major/, 'a running major arc takes a slot like an event');
    ws.arcs[slot.key].state = 'ended';
    ws.arcs.second.state = 'ended';
    assert.equal(capBlock(ws, ['March Realm'], 60), '', 'an ended arc holds nothing');
    // The same plan on a realm that had a major 5 days ago: the arc is not started, the fallback applies.
    const blocked = started(major, world(), { state: { seed: 'seed1', start: 1, day: 9, events: {}, anchors: {}, lastMajor: { 'March Realm': 5 }, cast: {}, standings: {}, facts: {}, masks: {}, minors: [], cooldowns: {} } });
    assert.equal(blocked.done.daily.arcs, undefined);
    assert.equal(blocked.done.daily.slots[blocked.slot.key].outcome, 'fallback');
    assert.match(blocked.done.report.warnings.join(' '), /arc could not start/);
});

test('a step that no longer holds is skipped with a Problems line; the plan is not rewritten; the arc still ends', () => {
    const ladderWorld = world();
    const { slot, done } = started({ steps: [{ ...STEP, effects: { powers: { crown: 3 } } }], ending: ENDING });
    const changed = structuredClone(done);
    changed.daily.arcs[slot.key].steps[0].effects = { powers: { crown: 99 } };
    const out = go(ladderWorld, changed, 13);
    assert.match(out.report.warnings.join(' '), /no longer holds/);
    assert.equal(out.daily.arcs[slot.key].next, 1);
    assert.equal(out.report.journal.some(row => row.title === 'Rumours'), false);
});
