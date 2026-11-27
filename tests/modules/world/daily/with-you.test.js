// World events, the daily step: people with You (spec v0.14.5 §8 With You, rulings 33-34; acceptance tests 104-110, the step's part).

import test from 'node:test';
import assert from 'node:assert/strict';
import { runner, world } from './helpers.js';
import { pendingCues, settleCues } from '../../../../modules/world/daily/cues.js';

const ev = (id, extra = {}) => ({ id, kind: 'one-off', certainty: 'set-in-motion', where: ['Oakhollow'], window: { after: 'start', within: '1 day' }, ends_when: { for: '30 days' }, title: 'Oakhollow falls', summary: 'Oakhollow falls to the raiders.', ...extra });
const cast = [
    { kind: 'companion', id: 'temiwa', name: 'Temiwa', homeBase: 'Oakhollow', canDieUnmet: true },
    { kind: 'figure', id: 'oren', name: 'Oren', homeBase: 'Oakhollow', canDieUnmet: true },
];
const fall = (extra = {}) => ev('fall', { effects: { set: ['fallen@Oakhollow: until cleared'], cast: [{ who: 'temiwa', location: 'Fenmouth', until: 'cleared:fallen@Oakhollow' }] }, ...extra });
const row = (run, id) => run.state.cast[id] ?? {};

test('test 104: a person with You is not moved — the Journal logs it and a deferred displacement { to, by, until } is kept', () => {
    const run = runner(world({ cast, events: [fall()] }));
    run.withYou = ['temiwa'];
    run.to(1);
    assert.equal(row(run, 'temiwa').displaced, undefined, 'not moved');
    assert.deepEqual(row(run, 'temiwa').deferred, { to: 'Fenmouth', by: 'fall', until: 'cleared:fallen@Oakhollow', title: 'Oakhollow falls' });
    assert.ok(run.journal().some(entry => entry.text === 'Temiwa stays with You — Oakhollow falls'));
    assert.ok(!run.journal().some(entry => /Temiwa left/.test(entry.text)), 'no departure trace while she stays');
    assert.equal(run.state.anchors['departed:temiwa'], undefined);
});

test('test 105: the deferred move applies on the first tick after she leaves You, while the condition holds — not earlier, not later', () => {
    const run = runner(world({ cast, events: [fall()] }));
    run.withYou = ['temiwa'];
    run.to(2);
    assert.ok(row(run, 'temiwa').deferred, 'day 2: still with You, still deferred');
    run.withYou = [];
    run.to(3);
    assert.equal(row(run, 'temiwa').deferred, undefined);
    assert.deepEqual([row(run, 'temiwa').displaced.to, row(run, 'temiwa').displaced.since], ['Fenmouth', 3], 'moved on day 3, the first tick after she left');
    assert.deepEqual(run.state.anchors['departed:temiwa'], [3]);
    assert.ok(run.reports.at(-1).moves.some(move => move.id === 'temiwa' && move.to === 'Fenmouth'), 'reported for the host to mirror');
});

test('test 106: lapsed before she left — the condition cleared first: no move, the deferred record is dropped (Inspector log)', () => {
    const run = runner(world({ cast, events: [fall()] }));
    run.withYou = ['temiwa'];
    run.to(2);
    run.clear('fallen', 'Oakhollow');
    run.withYou = [];
    run.to(3);
    assert.equal(row(run, 'temiwa').deferred, undefined);
    assert.equal(row(run, 'temiwa').displaced, undefined, 'nothing happens');
    assert.equal(run.log('deferred-dropped', 'temiwa').length, 1);
    // until "end": the event ended before she left → dropped too.
    const ended = runner(world({ cast, events: [ev('call', { ends_when: { for: '2 days' }, effects: { cast: [{ who: 'temiwa', location: 'Town' }] } })] }));
    ended.withYou = ['temiwa'];
    ended.to(4);
    ended.withYou = [];
    ended.to(5);
    assert.equal(row(ended, 'temiwa').displaced, undefined);
    assert.equal(ended.log('deferred-dropped', 'temiwa').length, 1);
});

test('test 107: the evacuation skips people with You (logged, deferred to the nearest suitable place) and moves the others', () => {
    const run = runner(world({ cast, events: [ev('sack', { effects: { set: ['fallen@Oakhollow: until cleared'] } })] }));
    run.withYou = ['temiwa'];
    run.to(1);
    assert.equal(row(run, 'oren').displaced.to, 'Town', 'Oren fled to the nearest suitable place');
    assert.deepEqual(row(run, 'temiwa').deferred, { to: 'Town', by: 'sack', until: 'cleared:fallen@Oakhollow', title: 'Oakhollow falls' });
    assert.ok(run.journal().some(entry => entry.text === 'Temiwa stays with You — Oakhollow falls'));
    run.withYou = [];
    run.to(2);
    assert.equal(row(run, 'temiwa').displaced.to, 'Town', 'applied after she leaves, while fallen holds');
});

test('test 108: died on someone with You is refused (Problems) without even_in_party; the same death of someone not with You applies', () => {
    const plague = ev('plague', { effects: { cast: [{ who: 'temiwa', died: true }, { who: 'oren', died: true }] } });
    const run = runner(world({ cast, events: [plague] }));
    run.withYou = ['temiwa'];
    run.to(1);
    assert.equal(row(run, 'temiwa').died, undefined, 'she stays alive');
    assert.equal(row(run, 'temiwa').dying, undefined, 'no cue without even_in_party');
    assert.ok(run.warnings.some(text => /would kill temiwa, who is with You; refused/.test(text)));
    assert.equal(row(run, 'oren').died, 1);
    run.withYou = [];
    run.to(10);
    assert.equal(row(run, 'temiwa').died, undefined, 'never deferred: no later tick applies it (test 128)');
});

test('test 109: even_in_party → a must-happen cue; applied when the narrator writes it, else by code after 3 replies (Journal + Problems)', () => {
    const run = runner(world({ cast, events: [ev('duel', { even_in_party: true, summary: 'The duel at Oakhollow.', effects: { cast: [{ who: 'temiwa', died: true }] } })] }));
    run.withYou = ['temiwa'];
    run.to(1);
    assert.equal(row(run, 'temiwa').died, undefined, 'not applied at the tick');
    assert.deepEqual(pendingCues(run.state), [{ id: 'temiwa', text: 'Temiwa dies here: The duel at Oakhollow.', by: 'duel' }]);
    const names = new Map([['temiwa', 'Temiwa']]);
    assert.equal(settleCues(run.state, { rev: 0, names }), null, 'the reply that made the cue does not count');
    const written = settleCues(run.state, { rev: 1, dead: new Set(['temiwa']), names });
    assert.deepEqual(written.applied, [{ id: 'temiwa', how: 'written' }]);
    assert.equal(written.daily.cast.temiwa.died, 1);
    assert.deepEqual(written.daily.anchors['died:temiwa'], [1]);
    assert.equal(written.problem, '');
    let daily = run.state;
    for (const rev of [1, 2]) {
        const out = settleCues(daily, { rev, names });
        assert.deepEqual(out.applied, [], `reply ${rev}: counted, not applied`);
        daily = out.daily;
    }
    const late = settleCues(daily, { rev: 3, names });
    assert.deepEqual(late.applied, [{ id: 'temiwa', how: 'fallback' }], 'the third reply without it: code applies it');
    assert.match(late.journal[0].text, /Temiwa died: the story did not show it within 3 replies/);
    assert.match(late.problem, /Temiwa died off-screen/);
    assert.deepEqual(pendingCues(late.daily), []);
});

test('test 110: the step decides the same way on every run — the skip, the log, the deferral, the cue and the later move are recorded, never re-decided', () => {
    const events = [fall(), ev('duel', { even_in_party: true, effects: { cast: [{ who: 'oren', died: true }] } })];
    const play = () => {
        const run = runner(world({ cast, events }));
        run.withYou = ['temiwa', 'oren'];
        run.to(2);
        run.withYou = ['oren'];
        run.to(4);
        return run;
    };
    const a = play();
    const b = play();
    assert.deepEqual(a.state, b.state);
    assert.deepEqual(a.reports, b.reports);
    assert.equal(a.state.cast.temiwa.displaced.since, 3);
    assert.ok(a.state.cast.oren.dying);
    // Replaying a recorded state: a step that has nothing to do changes nothing (the host writes the recorded slot back on replay).
    const again = runner(world({ cast, events }));
    again.state = structuredClone(a.state);
    again.table = structuredClone(a.table);
    again.withYou = [];
    again.to(4);
    assert.deepEqual(again.state, a.state, 'today was stepped: nothing is decided again');
});

test('an event with no title: the Journal lines and the routine go without a bracket, never with the event id (owner, 27 Nov)', () => {
    const untitled = (id, effects) => { const def = ev(id, { effects }); delete def.title; return def; };
    const run = runner(world({ cast, events: [untitled('raid', { cast: [{ who: 'temiwa', location: 'Fenmouth' }, { who: 'oren', died: true }] })] }));
    run.to(1);
    const lines = run.journal().filter(entry => !entry.rumour && !entry.fired).map(entry => entry.text);
    assert.ok(lines.includes('Temiwa left Oakhollow for Fenmouth.'), lines.join(' | '));
    assert.ok(lines.includes('Oren died.'), lines.join(' | '));
    assert.ok(!run.journal().some(entry => /\braid\b/.test(entry.text)), 'the id is never shown');
    assert.equal(run.reports.at(-1).moves.find(move => move.id === 'temiwa').routine, 'staying at Fenmouth');
    const kept = runner(world({ cast, events: [untitled('raid', { cast: [{ who: 'temiwa', location: 'Fenmouth' }] })] }));
    kept.withYou = ['temiwa'];
    kept.to(1);
    assert.ok(kept.journal().some(entry => entry.text === 'Temiwa stays with You'));
    const sack = runner(world({ cast, events: [untitled('sack', { set: ['fallen@Oakhollow: until cleared'] })] }));
    sack.withYou = ['temiwa'];
    sack.to(1);
    assert.ok(sack.journal().some(entry => entry.text === 'Temiwa stays with You'), 'the evacuation too');
});
