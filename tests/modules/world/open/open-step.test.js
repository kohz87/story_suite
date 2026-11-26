// The daily step with open templates (pure): slots rolled are recorded with their budget; the 5th and later slots of one step use their
// fallback (one batched call of at most 4); a waiting slot is settled when its answer is stored and falls back after 3 days; a world with no
// open template steps exactly as before; a stored answer that no longer holds falls back.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runDays } from '../../../../modules/world/daily/step.js';
import { slotKey } from '../../../../modules/world/daily/open-slot.js';
import { WORLD, answerFor, open } from './open-host.helpers.js';

const regions = ['A', 'B', 'C', 'D', 'E', 'F'];
const many = {
    ...WORLD,
    realms: [{ name: 'Realm', regions }],
    places: regions.map((region, index) => ({ id: `p${index}`, name: `Town ${region}`, region, x: index, y: 0, kind: 'town' })),
    templates: [open('border-incident')],
};
const base = world => ({ world, today: 10, seed: 'seed1', draw: () => 0 });
const stored = (key, over = {}) => ({ outcome: 'ok', answer: JSON.stringify(answerFor(key, over)) });

test('six regions, six slots in one step: the first four wait for the Director, the rest use the fallback at once', () => {
    // one template, one slot per region per season: six regions → six places picked? the template picks one place a day; step three days of six to roll many
    const spec = { ...many, templates: regions.map((region, index) => open(`t${index}`, { where: { kinds: ['town'] }, chance: '100% per season' })) };
    // density: at most 2 minors per region per week, so each template lands where the draw puts it; count the slots recorded
    const spread = (day, key) => { const m = /template:t(\d)#place/.exec(key); return m ? (Number(m[1]) + 0.5) / 6 : 0; };
    const out = runDays({ ...base(spec), state: null, today: 3, draw: spread });
    const slots = Object.values(out.daily.slots);
    assert.ok(slots.length >= 5, `enough slots rolled (${slots.length})`);
    const waiting = slots.filter(row => row.outcome === 'waiting').length;
    assert.equal(waiting, 4, 'at most four wait for the one batched call');
    assert.equal(out.daily.pending.length, 4);
    assert.ok(slots.filter(row => row.outcome === 'fallback').length >= 1, 'the rest use their fallback');
});

test('a slot waits with no stored answer and is applied by a settle step once the answer is stored; the step reads only state', () => {
    const first = runDays({ ...base(many), state: null });
    const [slot] = first.daily.pending;
    assert.ok(slot, 'rolled and waiting');
    assert.equal(first.conditions[`unrest@${slot.place}`], undefined);
    const nothing = runDays({ ...base(many), state: first.daily, table: first.conditions, settle: true });
    assert.equal(nothing.daily.pending.length, 1, 'a settle with no stored answer leaves the slot waiting');
    assert.deepEqual(nothing.conditions, first.conditions);
    const done = runDays({ ...base(many), state: first.daily, table: first.conditions, settle: true, opens: { results: { [slot.key]: stored(slot.key, { effects: { set: [{ condition: 'unrest', for: '3 days' }] } }) } } });
    assert.equal(done.daily.pending, undefined);
    assert.equal(done.daily.slots[slot.key].outcome, 'ok');
    assert.ok(done.conditions[`unrest@${slot.place}`], 'the answer\'s condition is set');
    assert.equal(slot.key, slotKey('seed1', 10, 'border-incident', 'p0'), 'the slot key: seed, day, template id, place id');
});

test('a waiting slot older than three days uses its fallback; a stored answer that no longer holds does too', () => {
    const first = runDays({ ...base(many), state: null });
    const aged = runDays({ ...base(many), state: first.daily, table: first.conditions, today: 14 });
    assert.equal(Object.values(aged.daily.slots).find(row => row.day === 10).outcome, 'fallback');
    assert.match(aged.report.warnings.join(' '), /no answer came in time/);
    const [slot] = first.daily.pending;
    const refused = runDays({ ...base(many), state: first.daily, table: first.conditions, settle: true, opens: { results: { [slot.key]: stored(slot.key, { effects: { powers: { crown: 50 } } }) } } });
    assert.equal(refused.daily.slots[slot.key].outcome, 'fallback');
    assert.match(refused.report.warnings.join(' '), /no longer holds/);
});

test('the per budget: one slot per region per season; the same step run twice gives the same slots', () => {
    const a = runDays({ ...base(many), state: null, today: 12, draw: () => 0.3 });
    const keys = Object.keys(a.daily.slots);
    const perRegion = new Set(Object.values(a.daily.slots).map(row => row.region));
    assert.equal(keys.length, perRegion.size, 'at most one slot per region in the season');
    const b = runDays({ ...base(many), state: null, today: 12, draw: () => 0.3 });
    assert.deepEqual(a.daily, b.daily);
});

test('a world with no open template steps exactly as before: no slots, no pending, no new keys', () => {
    const plain = { ...WORLD, templates: [{ template: 'riot', scope: 'place', severity: 'minor', chance: '100% per season', where: { kinds: ['town'] }, sets: ['unrest@place: 3 days'], summary: 'Riot at {place}.' }] };
    const out = runDays({ ...base(plain), state: null });
    assert.equal(out.daily.slots, undefined);
    assert.equal(out.daily.pending, undefined);
    assert.ok(out.conditions['unrest@Highmark']);
    assert.deepEqual(Object.keys(out.daily).sort(), ['anchors', 'cast', 'cooldowns', 'day', 'events', 'facts', 'lastMajor', 'masks', 'minors', 'seed', 'standings', 'start']);
});

test('LAB2-2: a happening placed at a sub-place ("Highmark / Guild Office") names its town in its text; its place stays the sub-place', () => {
    const places = [{ id: 'hm', name: 'Highmark', region: 'The March', x: 0, y: 0, kind: 'village' }, { id: 'hm-go', name: 'Highmark / Guild Office', region: 'The March', x: 0, y: 0, kind: 'town' }];
    const spec = { ...WORLD, places, templates: [open('border-incident')] };
    const first = runDays({ ...base(spec), state: null });
    const [slot] = first.daily.pending;
    assert.equal(slot.place, 'Highmark / Guild Office');
    const fell = runDays({ ...base(spec), state: first.daily, table: first.conditions, settle: true, opens: { results: { [slot.key]: { outcome: 'fallback', why: 'the Director did not answer' } } } });
    const [line] = fell.report.journal;
    assert.equal(line.text, 'A border-incident near Highmark.', 'the fallback names the town, not the guild office');
    assert.equal(line.place, 'Highmark / Guild Office', 'the news still starts at the sub-place');
    const plain = { ...spec, templates: [{ template: 'riot', scope: 'place', severity: 'minor', chance: '100% per season', where: { kinds: ['town'] }, sets: ['unrest@place: 3 days'], summary: 'Riot at {place}.' }] };
    assert.equal(runDays({ ...base(plain), state: null }).report.journal[0].text, 'Riot at Highmark.', 'a code-written template names the town too');
});
