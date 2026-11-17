// World events daily step: placement, minor templates and named cast (acceptance tests 13, 15, 18, 21, 23, 31, 33, 34, 41).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { seededDraw } from '../../../../modules/world/daily/chance.js';
import { buildGeo } from '../../../../modules/world/daily/geo.js';
import { placesFor, weightedPick } from '../../../../modules/world/daily/placement.js';
import { drawWith, runner, world } from './helpers.js';

const ev = (id, extra = {}) => ({ id, kind: 'one-off', certainty: 'set-in-motion', where: ['Valegard'], window: { after: 'start', within: '1 day' }, ends_when: 'instant', summary: id, ...extra });
const cast = [
    { kind: 'figure', id: 'old-miller', name: 'Old Miller', homeBase: 'Oakhollow', canDieUnmet: true },
    { kind: 'figure', id: 'sir-lothar', name: 'Sir Lothar', homeBase: 'Oakhollow', protected: true, canDieUnmet: false },
    { kind: 'figure', id: 'reeve', name: 'The Reeve', homeBase: 'Town', canDieUnmet: false },
];

test('test 18: placeholders bind to the picked place — famine picks in the region where harvest-failed holds and sets there', () => {
    const famine = { id: 'famine', kind: 'recurring', certainty: 'possible', where: 'where conditions fit', requires: ['harvest-failed@region'], chance: '30% per season', cooldown: '1 season per place', effects: { set: ['grain-dear@region: 1 season', 'refugees@region: 20 days'] }, ends_when: { for: '30 days' }, summary: 'Famine grips {region}.', severity: 'minor' };
    const run = runner(world({ events: [famine] }), { draw: drawWith({ values: { famine: () => 0, 'famine#place': () => 0.5 } }) }).set('harvest-failed', 'Lowfen', 1, 'region').to(1);
    assert.deepEqual(run.row('famine').bind, { place: 'Fenmouth', region: 'Lowfen', realm: 'River Realm' });
    assert.ok(run.table['grain-dear@Lowfen'] && run.table['refugees@Lowfen']);
    assert.deepEqual(Object.keys(run.table).filter(key => key.startsWith('grain-dear')), ['grain-dear@Lowfen']);
    assert.equal(run.journal().find(entry => entry.fired).text, 'Famine grips Lowfen.');
});

test('test 31: minor size weighting, density cap and ties — capital/city > town > village > outpost; site as outpost; zero weights equal', () => {
    const geo = buildGeo({ places: [
        { name: 'Cap', region: 'R', kind: 'capital' }, { name: 'Cit', region: 'R', kind: 'city' }, { name: 'Tow', region: 'R', kind: 'town' },
        { name: 'Vil', region: 'R', kind: 'village' }, { name: 'Out', region: 'R', kind: 'outpost' }, { name: 'Sit', region: 'R', kind: 'site' }, { name: 'Sea', region: 'R', kind: 'sea' },
    ], placeKinds: { sea: 'none' } });
    const ws = { geo, declared: new Map(), table: {} };
    const list = placesFor(ws, null, 1, { template: true });
    assert.ok(!list.some(({ place }) => place.name === 'Sea'), 'class none is never picked generically');
    const counts = {};
    for (let day = 1; day <= 10000; day += 1) { const place = weightedPick(list, seededDraw('s', day, 'pick')); counts[place.name] = (counts[place.name] ?? 0) + 1; }
    assert.ok(counts.Cap > counts.Tow && counts.Cit > counts.Tow && counts.Tow > counts.Vil && counts.Vil > counts.Out, JSON.stringify(counts));
    assert.ok(Math.abs(counts.Sit - counts.Out) < 120, 'a site weighs like an outpost');
    const zero = list.map(item => ({ ...item, weight: 0 }));
    assert.equal(weightedPick(zero, 0).name, zero[0].place.name, 'all zero → equal, ties in place id order');
    assert.equal(weightedPick([], 0.5), null, 'no eligible place → nothing');
    const riot = { template: 'riot', severity: 'minor', where: { kinds: ['town'] }, sets: ['unrest@place: 2 days'], chance: '100% per season', summary: 'Riot in {place}.', cooldown: '3 days per place' };
    const run = runner(world({ templates: [riot] }), { draw: drawWith({ values: { 'template:riot': () => 0, 'template:riot#place': day => (day % 2 ? 0.1 : 0.9) } }) }).to(9);
    const placed = run.log('minor', 'riot').map(entry => `${entry.day}:${entry.place}`);
    assert.deepEqual(placed, ['1:Oakhollow', '2:Town', '8:Town', '9:Oakhollow'], 'two a week in Valegard; the third success is blocked until the oldest leaves the window');
    assert.ok(run.log('density', 'riot').some(entry => entry.day === 4), 'day 3: both places cooling; day 4: blocked by density');
    const none = runner(world({ templates: [{ ...riot, where: { kinds: ['harbour'] } }] }), { draw: () => 0 }).to(3);
    assert.equal(none.reports.flatMap(report => report.log).length, 0, 'no eligible place → nothing fires and nothing is recorded');
});

test('test 13 and 33: off-screen death — an unmet canDieUnmet person dies (died: + rumour); canDieUnmet false is skipped with a warning; templates never kill', () => {
    const w = world({ cast, events: [ev('plague-year', { requires: ['fallen@Highmark Capital'], effects: { cast: [{ who: 'old-miller', died: true }, { who: 'reeve', died: true }] } })] });
    const run = runner(w).set('fallen', 'Highmark Capital', 1, 'place').to(1);
    assert.equal(run.state.cast['old-miller'].died, 1);
    assert.deepEqual(run.state.anchors['died:old-miller'], [1]);
    assert.ok(run.journal().some(entry => entry.rumour && entry.place === 'Oakhollow' && /Old Miller died/.test(entry.text)));
    assert.equal(run.state.cast.reeve, undefined, 'canDieUnmet false: untouched');
    assert.ok(run.warnings.some(text => /reeve.*cannot die before you meet them/.test(text)));
    const met = runner(w, { met: ['reeve'] }).set('fallen', 'Highmark Capital', 1, 'place').to(1);
    assert.equal(met.state.cast.reeve.died, 1, 'met: the authored event may kill them');
});

test('test 21 and 34: protected cast — an authored event naming them moves them (departed: + Journal + rumour); a template naming people is refused', () => {
    const w = world({ cast, events: [
        ev('summons', { effects: { cast: [{ who: 'sir-lothar', location: 'Highmark Capital', until: 'end', routine: 'attends the regent' }] }, ends_when: { for: '5 days' } }),
        ev('after-summons', { certainty: 'likely', requires: ['departed:sir-lothar'], window: { after: 'start', within: '30 days' }, ends_when: 'instant' }),
    ] });
    const run = runner(w).to(1);
    assert.deepEqual(run.state.cast['sir-lothar'].displaced, { to: 'Highmark Capital', by: 'summons', until: 'end', routine: 'attends the regent' });
    assert.deepEqual(run.state.anchors['departed:sir-lothar'], [1]);
    assert.ok(run.journal().some(entry => entry.rumour && entry.place === 'Oakhollow'));
    assert.equal(run.row('after-summons').state, 'eligible', 'a requires departed:<id> becomes Eligible that day');
    run.to(6);
    assert.equal(run.state.cast['sir-lothar'].displaced, undefined, 'until "end": released when the event ends');
    const untouched = runner(world({ cast, events: [ev('quiet', { effects: { set: ['unrest@Oakhollow: 5 days'] } })] })).to(1);
    assert.equal(untouched.state.cast['sir-lothar'], undefined, 'an authored event that does not name them leaves them untouched');
});

test('test 15, 23 and 41 (the daily part): fallen evacuates residents to the nearest suitable place; no ordinary templates there; reconstruction clears it', () => {
    const reconstruction = { template: 'reconstruction', severity: 'minor', where: { kinds: ['town'] }, needs: ['fallen@place'], clears: ['fallen@place'], sets: ['peace@place: 10 days'], chance: '50% per season', summary: '{place} is rebuilt.' };
    const riot = { template: 'riot', severity: 'minor', where: { kinds: ['town'] }, sets: ['unrest@place: 1 day'], chance: '50% per season', summary: 'Riot in {place}.' };
    const w = world({ cast, templates: [reconstruction, riot], events: [ev('sack', { where: ['Oakhollow'], effects: { set: ['fallen@Oakhollow: until cleared'] } })] });
    const draw = drawWith({ values: { 'template:reconstruction': day => (day >= 3 ? 0 : 0.999999), 'template:riot': day => (day === 2 ? 0 : 0.999999), 'template:riot#place': () => 0 } });
    const run = runner(w, { draw }).to(1);
    assert.equal(run.state.cast['old-miller'].displaced.to, 'Town', 'nearest suitable place (Town, 2 away)');
    assert.equal(run.state.cast['sir-lothar'].displaced.to, 'Town', 'an authored event evacuates protected people too');
    assert.equal(run.state.cast['old-miller'].displaced.until, 'cleared:fallen@Oakhollow');
    assert.ok(run.journal().some(entry => /fled Oakhollow for Town/.test(entry.text)));
    run.to(2);
    assert.deepEqual(run.log('minor', 'riot').map(entry => entry.place), ['Town'], 'a fallen place gets no ordinary templates (Oakhollow would come first)');
    run.to(3);
    assert.deepEqual(run.log('minor', 'reconstruction').map(entry => `${entry.day}:${entry.place}`), ['3:Oakhollow']);
    assert.equal(run.table['fallen@Oakhollow'], undefined, 'the template that needs fallen@place clears it on the tick it fires');
    run.to(4);
    assert.equal(run.state.cast['old-miller'].displaced, undefined, 'residents may return: the displacement lapses at the next day');
});

test('test 52: explicit kinds beat the none class — generic placement skips dungeons; an event with where.kinds picks one; none in the pack → nothing', () => {
    const places = [...world().places, { name: 'Deep Hole', region: 'Valegard', kind: 'dungeon', x: 11, y: 0 }, { name: 'Old Pit', region: 'Lowfen', kind: 'dungeon', x: 41, y: 0, weight: 0 }];
    const breakout = { id: 'dungeon-break', kind: 'recurring', certainty: 'likely', where: { kinds: ['dungeon'] }, cooldown: '1 season per place', ends_when: 'instant', severity: 'minor', summary: 'Something climbs out of {place}.' };
    const riot = { template: 'riot', severity: 'minor', sets: ['unrest@place: 1 day'], chance: '100% per season', summary: 'Riot.' };
    const w = world({ places, placeKinds: { dungeon: 'none' }, events: [breakout], templates: [riot] });
    const run = runner(w, { draw: drawWith({ values: { 'dungeon-break': () => 0, 'dungeon-break#place': () => 0.99 } }) }).to(30);
    assert.ok(run.log('minor', 'riot').every(entry => !['Deep Hole', 'Old Pit'].includes(entry.place)), 'generic placement never picks a dungeon');
    assert.deepEqual(run.journal().filter(entry => entry.fired).map(entry => entry.place).slice(0, 1), ['Deep Hole'], 'the event finds a dungeon (Old Pit weighs 0)');
    const none = runner(world({ events: [breakout] }), { draw: () => 0 }).to(3);
    assert.deepEqual(none.journal(), [], 'no dungeon in the pack: nothing fires and nothing is recorded');
});

test('test 53 (the daily part): a displaced record lapses when its event ends (on_end.cast moves them home), with its condition, or never (permanent)', () => {
    const move = (id, entry, extra = {}) => ev(id, { effects: { cast: [{ who: 'sir-lothar', location: 'Highmark Capital', ...entry }] }, ends_when: { for: '2 days' }, ...extra });
    const home = runner(world({ cast, events: [move('summons', { until: 'end', routine: 'attends the regent' }, { effects: { cast: [{ who: 'sir-lothar', location: 'Highmark Capital', until: 'end' }], on_end: { cast: [{ who: 'sir-lothar', location: 'Oakhollow', until: 'permanent' }] } } })] })).to(3);
    assert.deepEqual(home.state.cast['sir-lothar'].displaced, { to: 'Oakhollow', by: 'summons', until: 'permanent' }, 'case A: on_end.cast moves him home on the tick it ends');
    const cleared = runner(world({ cast, events: [move('siege', { until: 'cleared:unrest@Town' }, { effects: { set: ['unrest@Town: 3 days'], cast: [{ who: 'sir-lothar', location: 'Highmark Capital', until: 'cleared:unrest@Town' }] } })] })).to(3);
    assert.equal(cleared.state.cast['sir-lothar'].displaced.until, 'cleared:unrest@Town', 'held while the condition holds, past the event');
    cleared.to(4);
    assert.equal(cleared.state.cast['sir-lothar'].displaced, undefined, 'lapses once the condition is gone');
    const forever = runner(world({ cast, events: [move('exile', { until: 'permanent' })] })).to(10);
    assert.deepEqual([forever.state.cast['sir-lothar'].displaced.until, forever.state.cast['sir-lothar'].home], ['permanent', 'Highmark Capital']);
});
