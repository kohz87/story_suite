// World events, the daily step: `from` on moves and deaths, the latest base, named moves before the evacuation (spec v0.14.6-v0.14.9
// §8; rulings 35, 37-40; acceptance tests 111-113, 116, 118-119, 121-128, the step's part). The host's positions are set by hand here
// (`run.positions`: what the cast store says at the tick; the host side is tested in the world-daily host tests).

import test from 'node:test';
import assert from 'node:assert/strict';
import { runner, world } from './helpers.js';

const places = [...world().places, { name: 'Oakhollow / Mill Ward', region: 'Valegard', kind: 'district', x: 10, y: 1 }];
const conditions = [...world().conditions, { name: 'evacuated', scope: 'place', fades: 'until cleared', placeStatus: true }];
const cast = [
    { kind: 'companion', id: 'temiwa', name: 'Temiwa', homeBase: 'Oakhollow', canDieUnmet: true },
    { kind: 'figure', id: 'oren', name: 'Oren', homeBase: 'Oakhollow', canDieUnmet: true },
    { kind: 'figure', id: 'durvald', name: 'Durvald', homeBase: 'Town', canDieUnmet: true },
    { kind: 'figure', id: 'sir-lothar', name: 'Sir Lothar', homeBase: 'Town', protected: true },
];
const ev = (id, effects, extra = {}) => ({ id, kind: 'one-off', certainty: 'set-in-motion', where: ['Oakhollow'], window: { after: 'start', within: '1 day' }, ends_when: { for: '30 days' }, title: id, summary: id, effects, ...extra });
const make = events => runner(world({ places, conditions, placeKinds: { district: 'site' }, cast, events }));
const row = (run, id) => run.state.cast[id] ?? {};
const skipped = (run, id) => run.log('cast-skipped', id);

test('test 111: a move with from applies when they are in that place group (a district counts), with its routine and until', () => {
    const move = { who: 'temiwa', from: 'Oakhollow', location: 'Fenmouth', until: 'cleared:evacuated@Oakhollow', routine: 'tends the refugee camps' };
    const run = make([ev('flight', { set: ['evacuated@Oakhollow: until cleared'], cast: [move] })]);
    run.positions = { temiwa: { at: 'Oakhollow / Mill Ward', base: 'Oakhollow / Mill Ward' } };
    run.to(1);
    assert.deepEqual(row(run, 'temiwa').displaced, { to: 'Fenmouth', by: 'flight', until: 'cleared:evacuated@Oakhollow', since: 1, routine: 'tends the refugee camps' });
    assert.ok(run.reports[0].moves.some(item => item.id === 'temiwa' && item.routine === 'tends the refugee camps'));
});

test('test 112: from elsewhere — not moved, no displacement, logged for the Inspector and not on the Journal; a protected person too', () => {
    const run = make([ev('flight', { cast: [{ who: 'temiwa', from: 'Oakhollow', location: 'Fenmouth' }, { who: 'sir-lothar', from: 'Oakhollow', location: 'Fenmouth' }] })]);
    run.positions = { temiwa: { at: 'Town', base: 'Town' }, 'sir-lothar': { at: 'Town', base: null } };
    run.to(1);
    for (const id of ['temiwa', 'sir-lothar']) {
        assert.equal(row(run, id).displaced, undefined, `${id} not moved`);
        assert.equal(skipped(run, id).length, 1, `${id}: Inspector log`);
    }
    assert.ok(!run.journal().some(entry => /Temiwa|Sir Lothar/.test(entry.text)), 'nothing on the Journal');
});

test('test 113: from is checked again when a deferred move comes due — moved if still in the group, dropped if not', () => {
    const events = [ev('flight', { set: ['evacuated@Oakhollow: until cleared'], cast: [{ who: 'temiwa', from: 'Oakhollow', location: 'Fenmouth', until: 'cleared:evacuated@Oakhollow' }] })];
    for (const [later, moved] of [['Town', false], ['Oakhollow / Mill Ward', true]]) {
        const run = make(events);
        run.positions = { temiwa: { at: 'Oakhollow', base: null } };
        run.withYou = ['temiwa'];
        run.to(1);
        assert.equal(row(run, 'temiwa').deferred.from, 'Oakhollow');
        run.withYou = [];
        run.positions = { temiwa: { at: later, base: later } };
        run.to(2);
        assert.equal(row(run, 'temiwa').deferred, undefined);
        assert.equal(row(run, 'temiwa').displaced?.to, moved ? 'Fenmouth' : undefined, `left You at ${later}`);
        if (!moved) assert.equal(run.log('deferred-dropped', 'temiwa')[0].why, 'not in Oakhollow');
    }
});

test('test 116: a stays base matching from is moved (the record is replaced by the displacement); an unnamed evacuation moves her too', () => {
    const run = make([ev('raid', { cast: [{ who: 'temiwa', from: 'Town', location: 'Fenmouth' }] })]);
    run.positions = { temiwa: { at: 'Town', base: 'Town' } };
    run.to(1);
    assert.equal(row(run, 'temiwa').displaced.to, 'Fenmouth');
    const sack = make([ev('sack', { set: ['fallen@Town: until cleared'] }, { where: ['Town'] })]);
    sack.positions = { temiwa: { at: 'Town', base: 'Town' } };
    sack.to(1);
    assert.equal(row(sack, 'temiwa').displaced.until, 'cleared:fallen@Town', 'evacuated, with no routine of her own');
    assert.match(sack.reports[0].moves.find(item => item.id === 'temiwa').routine, /^staying at /);
});

test('test 118: a named move without from skips someone the story moved (Inspector log); moves someone still at their start group (a district counts)', () => {
    const events = [ev('levy', { cast: [{ who: 'durvald', location: 'Fenmouth' }, { who: 'oren', location: 'Fenmouth' }] })];
    const run = make(events);
    run.positions = { durvald: { at: 'Highmark Capital', base: 'Highmark Capital' }, oren: { at: 'Oakhollow / Mill Ward', base: 'Oakhollow / Mill Ward' } };
    run.to(1);
    assert.equal(row(run, 'durvald').displaced, undefined, 'the story moved Durvald: skipped');
    assert.equal(skipped(run, 'durvald')[0].why, 'moved from their start since');
    assert.ok(!run.journal().some(entry => /Durvald/.test(entry.text)));
    assert.equal(row(run, 'oren').displaced.to, 'Fenmouth', 'Oren at a district of his start counts as at his start group');
    const still = make(events);
    still.positions = { durvald: { at: 'Town', base: null } };
    still.to(1);
    assert.equal(row(still, 'durvald').displaced.to, 'Fenmouth', 'nothing moved him: the move applies');
});

test('test 119: from "anywhere" moves them wherever they are (deferred when with You); a matching place moves, another place skips', () => {
    for (const [from, withYou, expect] of [['anywhere', [], 'moved'], ['anywhere', ['durvald'], 'deferred'], ['Highmark Capital', [], 'moved'], ['Town', [], 'skipped']]) {
        const run = make([ev('summons', { cast: [{ who: 'durvald', from, location: 'Fenmouth' }] })]);
        run.positions = { durvald: { at: 'Highmark Capital', base: 'Highmark Capital' } };
        run.withYou = withYou;
        run.to(1);
        const got = row(run, 'durvald').displaced ? 'moved' : row(run, 'durvald').deferred ? 'deferred' : 'skipped';
        assert.equal(got, expect, `from ${from}, with You ${withYou.length > 0}`);
    }
});

test('tests 121-122: a named move into the evacuated group keeps her there — named moves first, the evacuation skips her, others go', () => {
    const fall = ev('fall', { set: ['fallen@Oakhollow: until cleared'], cast: [{ who: 'temiwa', from: 'Oakhollow', location: 'Oakhollow / Mill Ward', routine: 'searches the records' }] });
    const run = make([fall]);
    run.to(1);
    assert.equal(row(run, 'temiwa').displaced.to, 'Oakhollow / Mill Ward', 'placed in the group by the named move');
    assert.equal(row(run, 'oren').displaced.to, 'Town', 'every other resident is evacuated');
    run.positions = { temiwa: { at: 'Oakhollow / Mill Ward', base: 'Oakhollow / Mill Ward' }, oren: { at: 'Town', base: 'Town' } };
    run.to(12);
    assert.equal(row(run, 'temiwa').displaced.to, 'Oakhollow / Mill Ward', 'later ticks leave her while fallen holds');
});

test('test 123: another event that evacuates the same place without her name moves her; naming her keeps her', () => {
    const fall = ev('fall', { set: ['fallen@Oakhollow: until cleared'], cast: [{ who: 'temiwa', from: 'Oakhollow', location: 'Oakhollow / Mill Ward' }] });
    const siege = ev('siege', { set: ['evacuated@Oakhollow: until cleared'] }, { window: { after: 'fired:fall + 2 days', within: '1 day' } });
    const run = make([fall, siege]);
    run.to(4);
    assert.equal(row(run, 'temiwa').displaced.by, 'siege', 'moved out by the second event');
    assert.equal(row(run, 'temiwa').displaced.to, 'Town');
    const named = ev('siege', { set: ['evacuated@Oakhollow: until cleared'], cast: [{ who: 'temiwa', from: 'Oakhollow', location: 'Oakhollow / Mill Ward' }] }, { window: { after: 'fired:fall + 2 days', within: '1 day' } });
    const kept = make([fall, named]);
    kept.to(4);
    assert.deepEqual([row(kept, 'temiwa').displaced.by, row(kept, 'temiwa').displaced.to], ['siege', 'Oakhollow / Mill Ward']);
});

test('test 124: with You — the named move and the evacuation both skip her; the Journal logs it once per decision', () => {
    const fall = ev('fall', { set: ['fallen@Oakhollow: until cleared'], cast: [{ who: 'temiwa', from: 'Oakhollow', location: 'Oakhollow / Mill Ward' }] }, { title: 'Auvoth falls' });
    const run = make([fall]);
    run.withYou = ['temiwa'];
    run.to(1);
    assert.equal(row(run, 'temiwa').displaced, undefined);
    assert.equal(row(run, 'temiwa').deferred.by, 'fall');
    assert.deepEqual(run.journal().filter(entry => entry.withYou).map(entry => entry.text), ['Temiwa stays with You — Auvoth falls']);
});

test('tests 125-128: died with from — kills there, skips elsewhere; without from (or anywhere) kills anywhere; with You refused, never deferred', () => {
    const at = (id, place) => ({ [id]: { at: place, base: place } });
    const kill = from => ev('fall', { cast: [{ who: 'oren', died: true, ...(from ? { from } : {}) }] });
    const there = make([kill('Oakhollow')]);
    there.positions = at('oren', 'Oakhollow / Mill Ward');
    there.to(1);
    assert.equal(row(there, 'oren').died, 1, '125: at a district of Auvoth: dies');
    assert.ok(there.journal().some(entry => entry.rumour && /Oren died/.test(entry.text)), '125: the rumour where he was');
    const elsewhere = make([kill('Oakhollow')]);
    elsewhere.positions = at('oren', 'Town');
    elsewhere.to(1);
    assert.equal(row(elsewhere, 'oren').died, undefined, '126: elsewhere: skipped');
    assert.equal(skipped(elsewhere, 'oren').length, 1);
    assert.ok(!elsewhere.journal().some(entry => /Oren/.test(entry.text)), '126: not on the Journal');
    for (const from of [null, 'anywhere']) {
        const any = make([kill(from)]);
        any.positions = at('oren', 'Town');
        any.to(1);
        assert.equal(row(any, 'oren').died, 1, `127: from ${from}: dies anywhere`);
    }
    const party = make([kill('Oakhollow')]);
    party.positions = at('oren', 'Oakhollow');
    party.withYou = ['oren'];
    party.to(1);
    party.withYou = [];
    party.to(5);
    assert.equal(row(party, 'oren').died, undefined, '128: refused, and no later tick applies it');
    assert.equal(row(party, 'oren').deferred, undefined);
    const cue = make([ev('fall', { cast: [{ who: 'oren', died: true, from: 'Oakhollow' }] }, { even_in_party: true })]);
    cue.positions = at('oren', 'Town');
    cue.withYou = ['oren'];
    cue.to(1);
    assert.equal(row(cue, 'oren').dying, undefined, '128: with even_in_party, from is checked at the tick');
});

test('test 122 with an instant event: a named move into the group of the status it sets (no until) holds while the status holds, after the event is over', () => {
    const fall = ev('fall', { set: ['fallen@Oakhollow: until cleared'], cast: [{ who: 'temiwa', from: 'Oakhollow', location: 'Oakhollow / Mill Ward', routine: 'searches the records' }] }, { ends_when: 'instant' });
    const run = make([fall]);
    run.to(1);
    assert.equal(run.row('fall').state, 'ended', 'the event is over on its day');
    assert.deepEqual([row(run, 'temiwa').displaced.to, row(run, 'temiwa').displaced.until], ['Oakhollow / Mill Ward', 'cleared:fallen@Oakhollow'], 'tied to the status, not to the event');
    run.to(6);
    assert.equal(row(run, 'temiwa').displaced.to, 'Oakhollow / Mill Ward', 'still there while fallen holds');
    run.clear('fallen', 'Oakhollow');
    run.to(7);
    assert.equal(row(run, 'temiwa').displaced, undefined, 'released when the status clears');
    assert.ok(run.reports.at(-1).released.some(item => item.id === 'temiwa'), 'reported for the host (the base it set is cleared)');
});
