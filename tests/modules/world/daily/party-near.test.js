// World events that know where the party is: neighbouring regions from routes, the in: / near: terms (and @region), and waits_for.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildGeo } from '../../../../modules/world/daily/geo.js';
import { neighbourRegions, regionKey, termHolds } from '../../../../modules/world/daily/near.js';
import { partyTerm } from '../../../../modules/world/daily/grammar.js';
import { dailyChance } from '../../../../modules/world/daily/chance.js';
import { runner } from './helpers.js';
import { runDays } from '../../../../modules/world/daily/step.js';
import { MAP } from './party-map.helpers.js';

const world = extra => ({ ...MAP, events: [], templates: [], ...extra });
const ev = (id, extra = {}) => ({ id, kind: 'one-off', certainty: 'set-in-motion', where: ['Westport'], window: { after: 'start', within: '10 days' }, ends_when: 'instant', summary: id, ...extra });
const at = (run, party, day) => { run.party = party; return run.to(day); };

test('adjacency: two regions are neighbours when a route joins a place in one to a place in the other', () => {
    const geo = buildGeo(MAP);
    const map = neighbourRegions(geo);
    assert.deepEqual([...map.get('west')], ['mid']);
    assert.deepEqual([...map.get('mid')].sort(), ['far', 'west']);
    assert.deepEqual([...map.get('far')], ['mid']);
    assert.equal(map.get('isle'), undefined, 'a route to an unknown place joins nothing; a route inside one region neither');
    assert.equal(neighbourRegions(geo), map, 'worked out once per map');
    assert.deepEqual([regionKey(geo, 'The Westlands'), regionKey(geo, 'the west'), regionKey(geo, 'WEST'), regionKey(geo, 'nowhere'), regionKey(geo, '')], ['west', 'west', 'west', null, null]);
});

test('in: and near: against the party region; every term is false with no party region', () => {
    const ws = party => ({ geo: buildGeo(MAP), party });
    const holds = (party, text, def, bind) => termHolds(ws(party), partyTerm(text), def, bind);
    const row = party => ['in:west', 'near:west'].map(text => holds(party, text));
    assert.deepEqual(row('west'), [true, true]);
    assert.deepEqual(row('mid'), [false, true]);
    assert.deepEqual(row('far'), [false, false]);
    assert.deepEqual(row(null), [false, false]);
    assert.equal(holds('west', 'in:The Westlands'), true, 'a region by its name');
    assert.equal(holds('west', 'near:nowhere'), false);
    // @region: the bound pick's region, else the regions of the event's where list (a place, a region, a realm).
    assert.equal(holds('far', 'in:@region', { where: { refs: ['Westport'] } }, { place: 'Farhaven', region: 'far' }), true);
    assert.equal(holds('mid', 'near:@region', { where: { refs: ['Westport'] } }), true);
    assert.equal(holds('far', 'near:@region', { where: { refs: ['Westport', 'far'] } }), true);
    assert.equal(holds('west', 'in:@region', { where: { refs: ['Old Realm'] } }), true);
    assert.equal(holds('west', 'in:@region', { where: { fit: true } }), false);
});

test('requires and requires_any read the terms; a recurring event with near:@region only picks places near the party', () => {
    const w = world({ events: [
        ev('there', { window: { after: 'start', within: '20 days' }, requires: ['in:far'] }),
        ev('either', { window: { after: 'start', within: '20 days' }, requires_any: ['in:isle', 'near:far'] }),
        { id: 'fair', kind: 'recurring', certainty: 'possible', chance: '100% per season', cooldown: '1 day', where: ['west', 'far', 'isle'], requires: ['near:@region'], ends_when: 'instant', summary: '{place}' },
    ] });
    const run = at(runner(w, { draw: () => 0 }), 'west', 3);
    assert.equal(run.row('there').state, 'dormant');
    assert.equal(run.row('either').state, 'dormant');
    const picked = run.journal().filter(entry => entry.by === 'fair' && entry.fired).map(entry => entry.place);
    assert.ok(picked.length && picked.every(place => place.startsWith('Westport')), `only a place near the party: ${picked}`);
    at(run, 'far', 4);
    assert.equal(run.row('there').fired, 4);
    assert.equal(run.row('either').fired, 4);
});

test('likelier_if near:@region multiplies the odds of a recurring event and a minor template picked near the party', () => {
    const w = world({
        events: [{ id: 'brawl', kind: 'recurring', certainty: 'possible', chance: '30% per season', cooldown: '1 day', where: ['Westport'], likelier_if: { 'near:@region': '×3' }, ends_when: 'instant', summary: 'x' }],
        templates: [{ template: 'quarrel', chance: '30% per season', where: { kinds: ['village'] }, likelier_if: { 'near:@region': '×3' }, sets: ['unrest@place'], summary: 'y' }],
    });
    const base = dailyChance({ certainty: 'possible', chance: { percent: 30, per: 'season' } }, { days: 90, left: 1 }).p;
    const tripled = dailyChance({ certainty: 'possible', chance: { percent: 30, per: 'season' } }, { days: 90, left: 1, m: 3 }).p;
    assert.ok(tripled > base * 2.5);
    const p = party => at(runner(w), party, 1).log('roll', 'brawl')[0].p;
    assert.equal(p('mid'), Number(tripled.toFixed(6)));
    assert.equal(p('far'), Number(base.toFixed(6)));
    assert.equal(p(''), Number(base.toFixed(6)));
    // The template: a draw between the two odds hits only near the party (the villages are Midmoor and Islet; draw 0 picks the first by id).
    const draw = (day, key) => (key.endsWith('#place') ? 0 : (base + tripled) / 2);
    assert.equal(at(runner(w, { draw }), 'far', 1).log('minor', 'quarrel').length, 0, 'Islet sorts first and is picked: far is not near it, the plain odds miss');
    const islandless = { ...w, places: MAP.places.filter(place => place.name !== 'Islet') };
    assert.equal(at(runner(islandless, { draw }), 'far', 1).log('minor', 'quarrel').length, 1, 'near Midmoor: the tripled odds hit');
    assert.equal(at(runner(islandless, { draw }), 'isle', 1).log('minor', 'quarrel').length, 0, 'away: the plain odds miss');
});

test('waits_for: a set-in-motion beat waits while the party is away and fires the day it arrives', () => {
    for (const [waits, arrive] of [['near', 'mid'], ['in', 'west'], [{ near: ['west'] }, 'mid'], [{ in: ['far'] }, 'far']]) {
        const run = at(runner(world({ events: [ev('beat', { waits_for: waits })] }), { draw: () => 0 }), 'isle', 4);
        assert.deepEqual([run.row('beat').state, run.log('roll', 'beat').length, run.log('waits', 'beat').length], ['eligible', 0, 4], JSON.stringify(waits));
        at(run, arrive, 5);
        assert.equal(run.row('beat').fired, 5, JSON.stringify(waits));
    }
    const run = at(runner(world({ events: [ev('beat', { waits_for: 'in' })] }), { draw: () => 0 }), 'mid', 6);
    assert.equal(run.row('beat').state, 'eligible', '"in" is not met next door');
});

test('waits_for: the party never comes, so it fires on the last day of its window', () => {
    const run = at(runner(world({ events: [ev('beat', { waits_for: 'near' })] })), 'isle', 9);
    assert.equal(run.row('beat').state, 'eligible');
    at(run, 'isle', 10);
    assert.equal(run.row('beat').fired, 10);
    assert.match(run.journal().map(entry => entry.text).join(), /beat/, 'it reaches the party as news like any event');
    const unknown = at(runner(world({ events: [ev('beat', { waits_for: 'near' })] })), '', 10);
    assert.equal(unknown.row('beat').fired, 10, 'no known place: only the last day');
});

test('waits_for: a likely or possible beat rolls its ordinary chance near the party, and fires anyway on its last day', () => {
    const daily = Number((1 - 0.3 ** 0.1).toFixed(6));
    const likely = ev('beat', { certainty: 'likely', chance: '70% over the window', waits_for: 'near' });
    const never = at(runner(world({ events: [likely] })), 'isle', 10);
    assert.deepEqual(never.log('roll', 'beat').map(entry => [entry.day, entry.p]), [[10, 1]]);
    assert.equal(never.row('beat').fired, 10);
    const arrive = at(at(runner(world({ events: [likely] })), 'isle', 4), 'mid', 6);
    assert.deepEqual(arrive.log('roll', 'beat').map(entry => [entry.day, entry.p]), [[5, daily], [6, daily]]);
    const possible = at(runner(world({ events: [ev('beat', { certainty: 'possible', waits_for: 'near' })] })), 'west', 10);
    assert.equal(possible.row('beat').fired, 10);
    assert.deepEqual(Object.keys(arrive.row('beat')).sort(), ['start', 'state'], 'waiting stores nothing of its own');
});

test('waits_for: the forced last day fires over the caps and past a Director veto, as a deadline does', () => {
    const majors = ['a', 'b'].map(id => ev(id, { window: { after: 'start', within: '1 day' }, ends_when: { for: '60 days' } }));
    const late = ev('late', { certainty: 'likely', waits_for: 'near' });
    const run = at(runner(world({ events: [...majors, late] })), 'isle', 10);
    assert.equal(run.row('late').fired, 10, 'the realm already holds two active majors');
    assert.equal(run.log('cap', 'late').length, 0);
    const vetoed = day => runDays({ world: world({ events: [late] }), today: day, seed: 's', partyRegion: 'west', marks: { marks: { [`late|${day}`]: { veto: 'not now' } } }, state: runDays({ world: world({ events: [late] }), today: 1, seed: 's', draw: () => 0.999999 }).daily, draw: () => 0 }).daily.events.late;
    assert.equal(vetoed(10).state, 'ended');
});

test('waits_for: a window that ends inside a skip fires on that day; earlier days of a skip have no party region', () => {
    const w = world({ events: [ev('short', { waits_for: 'near', window: { after: 'start', within: '3 days' } }), ev('long', { waits_for: 'near' })] });
    const run = at(runner(w), 'isle', 1);
    run.party = 'west';
    run.to(6, { jump: true });
    assert.equal(run.row('short').fired, 3);
    assert.equal(run.row('long').fired, 6, 'only the day the story is on knows where the party is');
});

test('waits_for with ×0 stays blocked (a likely beat lapses; a set-in-motion one fires on its last day); a waits_for the step cannot read leaves the event out with a warning', () => {
    const blocked = at(runner(world({ events: [ev('beat', { waits_for: 'near', less_if: { 'near:west': '×0' } })] })), 'west', 9);
    assert.equal(blocked.row('beat').state, 'eligible');
    assert.equal(at(blocked, 'west', 10).row('beat').fired, 10);
    const never = at(runner(world({ events: [ev('beat', { certainty: 'likely', waits_for: 'near', less_if: { 'near:west': '×0' } })] })), 'west', 11);
    assert.equal(never.row('beat').state, 'lapsed');
    for (const extra of [{ waits_for: 'soon' }, { waits_for: { near: [] } }, { waits_for: { near: ['west'], in: ['far'] } }, { waits_for: 'near', window: undefined }]) {
        const run = at(runner(world({ events: [ev('beat', extra)] })), 'west', 1);
        assert.match(run.warnings.join(), /"beat" is not run by the world: waits_for/, JSON.stringify(extra));
    }
});

test('a pack with none of the new terms steps the same wherever the party is', () => {
    const w = world({
        events: [ev('plain', { certainty: 'likely' }), { id: 'rec', kind: 'recurring', certainty: 'possible', chance: '60% per season', cooldown: '2 days', ends_when: 'instant', summary: 'r' }],
        templates: [{ template: 'minor', chance: '90% per season', sets: ['unrest@place'], summary: 's' }],
    });
    const steps = party => { const run = runner(w, { draw: (day, key) => ((day * 7 + key.length) % 10) / 400 }); run.party = party; run.to(30); return JSON.stringify([run.state, run.table, run.reports]); };
    assert.equal(steps('west'), steps(''));
    assert.equal(steps('far'), steps(''));
});
