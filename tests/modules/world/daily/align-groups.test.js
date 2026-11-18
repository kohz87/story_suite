// WEALIGN, the daily step's side of spec §2 placeStatus (B12) and protected places: a placeStatus on a city covers its districts
// (no templates there, the whole group evacuated to the nearest place outside it), and a template that sets a placeStatus at its
// place is never placed where a protected person lives (test 41, the run-time half; the load half is the pack check's).
import test from 'node:test';
import assert from 'node:assert/strict';
import { drawWith, runner, world } from './helpers.js';

const places = [
    ...world().places,
    { name: 'Shackles City', region: 'Lowfen', kind: 'city', x: 60, y: 0 },
    { name: 'Shackles City / Veil Market', region: 'Lowfen', kind: 'site', x: 61, y: 0 },
    { name: 'Shackles City / Docks', region: 'Lowfen', kind: 'site', x: 59, y: 0 },
];
const ev = (id, extra = {}) => ({ id, kind: 'one-off', certainty: 'set-in-motion', where: ['Lowfen'], window: { after: 'start', within: '1 day' }, ends_when: 'instant', summary: id, ...extra });

test('test 71: fallen@Shackles City masks its districts (no templates) and evacuates every resident of the group to the nearest place outside it', () => {
    const cast = [
        { kind: 'figure', id: 'trader', name: 'Trader', homeBase: 'Shackles City / Veil Market' },
        { kind: 'figure', id: 'docker', name: 'Docker', homeBase: 'Shackles City / Docks' },
        { kind: 'figure', id: 'mayor', name: 'Mayor', homeBase: 'Shackles City' },
    ];
    const riot = { template: 'riot', severity: 'minor', where: { kinds: ['site', 'city'] }, sets: ['unrest@place: 1 day'], chance: '50% per season', summary: 'Riot in {place}.' };
    const w = world({ places, cast, templates: [riot], events: [ev('sack', { effects: { set: ['fallen@Shackles City: until cleared'] } })] });
    // The place draw 0.99 takes the last place in id order: a district (Shackles City / Veil Market) if the mask let one through.
    const run = runner(w, { draw: drawWith({ values: { 'template:riot': day => (day === 2 ? 0 : 0.999999), 'template:riot#place': () => 0.99 } }) }).to(1);
    for (const id of ['trader', 'docker', 'mayor']) assert.equal(run.state.cast[id].displaced.to, 'Fenmouth', `${id}: the nearest place outside the group (Fenmouth), never a sibling district`);
    assert.ok(run.journal().some(entry => /Trader fled Shackles City \/ Veil Market for Fenmouth/.test(entry.text)));
    run.to(2);
    assert.deepEqual(run.log('minor', 'riot').map(entry => entry.place), ['Fenmouth'], 'no district of the fallen city gets a template (only Fenmouth is left of the cities and sites)');
});

test('test 41 (run time): a template that sets a placeStatus at its place skips a place where a protected person lives (or a district of it); an authored event may', () => {
    const cast = [{ kind: 'companion', id: 'sir-lothar', name: 'Sir Lothar', homeBase: 'Shackles City / Veil Market', protected: true }];
    const ruin = { template: 'ruin', severity: 'minor', where: { kinds: ['city'] }, sets: ['fallen@place: 5 days'], chance: '50% per season', summary: '{place} falls.' };
    const w = world({ places, cast, templates: [ruin] });
    // place draw 0.99: the last city in id order (Shackles City) when it may be picked, else Fenmouth.
    const draw = drawWith({ values: { 'template:ruin': day => (day === 1 ? 0 : 0.999999), 'template:ruin#place': () => 0.99 } });
    const run = runner(w, { draw }).to(1);
    assert.deepEqual(run.log('minor', 'ruin').map(entry => entry.place), ['Fenmouth'], 'Shackles City is skipped: Sir Lothar lives in its district');
    assert.equal(run.table['fallen@Shackles City'], undefined);
    const free = runner(world({ places, cast: [], templates: [ruin] }), { draw }).to(1);
    assert.deepEqual(free.log('minor', 'ruin').map(entry => entry.place), ['Shackles City'], 'with nobody protected there it may land');
    const authored = runner(world({ places, cast, events: [ev('sack', { effects: { set: ['fallen@Shackles City: until cleared'] } })] })).to(1);
    assert.equal(authored.state.cast['sir-lothar'].displaced.to, 'Fenmouth', 'an authored event evacuates the protected person too');
});
