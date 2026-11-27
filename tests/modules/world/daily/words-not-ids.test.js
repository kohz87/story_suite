// World events in words, never ids: the summary fill and the one name helper, an event with no authored summary, the step's card
// against Problems, a faded condition, and a lapse whose offset anchor did happen.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fillSummary, labelOf } from '../../../../modules/world/daily/event-title.js';
import { eventWords } from '../../../../modules/world/daily/event-words.js';
import { writeHappenings } from '../../../../modules/world/chronicle/world-daily/news-entries.js';
import { buildGeo } from '../../../../modules/world/daily/geo.js';
import { dailySummary } from '../../../../modules/world/chronicle/world-daily/summary.js';
import { drawWith, runner, world } from './helpers.js';

const ev = (id, extra = {}) => ({ id, kind: 'one-off', certainty: 'set-in-motion', where: ['Oakhollow'], window: { after: 'start', within: '1 day' }, ends_when: 'instant', ...extra });
const cardsOf = run => run.reports.map(report => dailySummary(report)).filter(Boolean).join(' ');

test('an empty place goes with its preposition, an empty outcome with its clause: no gap is left', () => {
    assert.equal(fillSummary("Factors tighten the collars at {place}, {region}, while the Chain counts its losses."), 'Factors tighten the collars, while the Chain counts its losses.');
    assert.equal(fillSummary('The dead walk in {place}; the pyres refuse them.'), 'The dead walk; the pyres refuse them.');
    assert.equal(fillSummary('The council votes: {outcome} at {place}, {region}.'), 'The council votes');
    assert.equal(fillSummary('The council votes: {outcome} at {place}.', null, 'no'), 'The council votes: no.');
    assert.equal(fillSummary('A convoy crosses {place}, {region}, under escort.'), '', 'nothing stands without the place');
    assert.equal(fillSummary('Talks between {place} and the coast.'), '');
    assert.equal(fillSummary('Fire at {place}, {region}.', { region: 'The March' }), 'Fire at The March.');
    assert.equal(fillSummary('Word reaches {place}, {region}.', { place: 'The March' }), 'Word reaches The March.', 'one name is not said twice');
});

test('labelOf: the title, else the summary in words, else nothing; a summary that is only the id is none', () => {
    assert.equal(labelOf({ id: 'a', title: 'The Toll War', summary: 'Tolls.' }), 'The Toll War');
    assert.equal(labelOf({ id: 'a', title: 'a', summary: 'Riots at {place}.' }), 'Riots');
    assert.equal(labelOf({ id: 'a', title: 'a', summary: 'Riots at {place}.' }, { place: 'Town' }), 'Riots at Town');
    assert.equal(labelOf({ id: 'a-b', title: 'a-b', summary: 'a-b' }), '');
});

test('an event that cannot be said without a place takes it from its own where', () => {
    const geo = buildGeo(world());
    const def = { id: 'convoy', title: 'convoy', summary: 'A convoy crosses {place}, {region}, under escort.', where: { refs: ['Oakhollow'] } };
    assert.deepEqual(eventWords(geo, def), { text: 'A convoy crosses Oakhollow, Valegard, under escort.', label: 'A convoy crosses Oakhollow, Valegard, under escort' });
    const run = runner(world({ events: [ev('convoy', { summary: def.summary })] })).to(1);
    assert.equal(run.journal().find(entry => entry.fired).text, 'A convoy crosses Oakhollow, Valegard, under escort.');
});

test('an event with no authored summary writes no id: its outcome alone, no "Ended:" line, and its firing is still recorded', () => {
    const run = runner(world({ events: [
        ev('bare-end', { ends_when: { for: '2 days' } }),
        ev('bare-out', { outcomes: [{ name: 'win', weight: 1, summary: 'The guild wins.' }], ends_when: { for: '2 days' } }),
    ] })).to(4);
    const fired = run.journal().filter(entry => entry.fired);
    assert.deepEqual(fired.map(entry => [entry.by, entry.text]).sort(), [['bare-end', ''], ['bare-out', 'The guild wins.']]);
    assert.deepEqual(run.journal().filter(entry => entry.ended).map(entry => entry.text), ['', '']);
    assert.equal(cardsOf(run), 'World: The guild wins.');
});

test('a pack note stays in Problems; a play warning is on the card in words', () => {
    const run = runner(world({ events: [
        { id: 'broken-one' , ends_when: 'never' },
        ev('late-muster', { summary: 'The muster is called.', requires: ['fact:never'] }),
        ev('bad-set', { summary: 'Bells ring.', effects: { set: ['no-such@Oakhollow'] } }),
    ] })).to(3);
    assert.ok(run.warnings.some(text => /broken-one/.test(text)), 'Problems keeps the pack author\'s id');
    assert.ok(run.warnings.some(text => /^The event "Bells ring": "no-such" is not one of/.test(text)));
    assert.match(cardsOf(run), /Warning: The event "The muster is called" lapsed/);
    assert.doesNotMatch(cardsOf(run), /broken-one|no-such|bad-set|late-muster/);
});

test('a faded condition is said in words', () => {
    const run = runner(world()).set('grain-dear', 'Valegard', 1, 'region');
    run.table['grain-dear@Valegard'].fadesAt = 2 * 1440;
    run.to(3);
    assert.match(cardsOf(run), /Faded: grain dear on Valegard\./);
});

test('a lapse whose offset anchor did happen is told: the branch opened, its wait had not passed', () => {
    const run = runner(world({ events: [
        ev('first', { certainty: 'likely', summary: 'The first.', window: { after: 'start + 2 days', within: '1 day' } }),
        ev('next', { certainty: 'likely', title: 'The next', requires: ['fired:first + 90 days'], window: { after: 'start', within: '5 days' } }),
        ev('never', { certainty: 'likely', title: 'The never', requires: ['fired:missing + 90 days'], window: { after: 'start', within: '5 days' } }),
    ] }), { draw: drawWith({ hits: { first: [3] } }) }).to(8);
    assert.equal(run.log('lapsed', 'next')[0].unopened, undefined);
    assert.equal(run.log('lapsed', 'never')[0].unopened, true);
    assert.match(cardsOf(run), /Lapsed: The next\./);
    assert.doesNotMatch(cardsOf(run), /The never/);
});

test('news: a firing with no words is no entry; an end with no words resolves the entry and keeps what it said', () => {
    const chronicle = { events: {} };
    const where = { geo: buildGeo(world()), rev: 1 };
    const fired = text => ({ day: 1, text, by: 'x', fired: true, where: ['Oakhollow'] });
    assert.deepEqual(writeHappenings({}, chronicle, [fired('')], where).written, []);
    writeHappenings({}, chronicle, [fired('The guild wins.')], where);
    writeHappenings({}, chronicle, [{ day: 2, text: '', by: 'x', ended: true }], where);
    assert.deepEqual(Object.values(chronicle.events).map(event => [event.state, event.summary]), [['resolved', 'The guild wins.']]);
});
