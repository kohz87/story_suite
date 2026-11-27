// World events in words, never ids: the summary fill and the one name helper, an event with no authored summary, the step's card
// against Problems, a faded condition, and a lapse whose offset anchor did happen.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fillSummary, labelOf } from '../../../../modules/world/daily/event-title.js';
import { eventWords } from '../../../../modules/world/daily/event-words.js';
import { writeHappenings } from '../../../../modules/world/chronicle/world-daily/news-entries.js';
import { buildGeo } from '../../../../modules/world/daily/geo.js';
import { dailySummary } from '../../../../modules/world/chronicle/world-daily/summary.js';
import { settleCues } from '../../../../modules/world/daily/cues.js';
import { fireEvent } from '../../../../modules/world/daily/fire.js';
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
        ev('late-muster', { summary: 'The muster is called.', requires: ['grain-dear@Oakhollow'] }),
        ev('bad-set', { summary: 'Bells ring.', effects: { set: ['no-such@Oakhollow'] } }),
    ] })).to(3);
    assert.ok(run.warnings.some(text => /broken-one/.test(text)), 'Problems keeps the pack author\'s id');
    assert.ok(run.warnings.some(text => /^The event "Bells ring": "no-such" is not one of/.test(text)));
    assert.match(cardsOf(run), /Warning: The event "The muster is called" lapsed/);
    assert.doesNotMatch(cardsOf(run), /broken-one|no-such|bad-set|late-muster/);
});

test('a lapse of a branch that never opened names nothing, on the card or in Problems', () => {
    const run = runner(world({ events: [ev('great-cull', { summary: 'The bounty is posted.', requires: ['fact:never'] })] })).to(3);
    assert.deepEqual(run.warnings.filter(text => /lapsed/.test(text)), ['An event lapsed: its window closed.']);
    assert.doesNotMatch(`${run.warnings.join(' ')} ${cardsOf(run)}`, /bounty|great-cull|lapsed.*bounty/);
    assert.doesNotMatch(cardsOf(run), /lapsed/i);
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

test('a death the narrator wrote: a cue with no words for the cause adds no bracket; a stored "dies here: <id>" cue strips as before', () => {
    const journal = text => settleCues({ day: 3, anchors: {}, cast: { mara: { dying: { by: 'x', text, day: 3, rev: 0, replies: 0 } } } }, { rev: 1, dead: new Set(['mara']), names: new Map([['mara', 'Mara']]) }).journal[0].text;
    assert.equal(journal('Mara dies here.'), 'Mara died.');
    assert.equal(journal('Mara dies here: some-id'), 'Mara died (some-id).');
});

test('a recurring event named without its binding takes no place from its where, which is only its pool', () => {
    const geo = buildGeo(world());
    const def = { id: 'wager', title: 'wager', kind: 'recurring', summary: 'A wager is laid with {place}.', where: { refs: ['Oakhollow'] } };
    assert.deepEqual(eventWords(geo, def), { text: '', label: '' });
    assert.equal(eventWords(geo, def, { place: 'Oakhollow' }).label, 'A wager is laid with Oakhollow');
});

test('an event that fires and ends on one day is on the card once; an end on a later day, or one that says more, stays', () => {
    const run = runner(world({ events: [ev('thinning', { summary: 'The Thinning opens.' }), ev('fair', { summary: 'The fair is on.', ends_when: { for: '2 days' } })] })).to(4);
    const card = cardsOf(run);
    assert.equal(card.split('The Thinning opens.').length - 1, 1, card);
    assert.doesNotMatch(card, /Ended: The Thinning/);
    assert.match(card, /Ended: The fair is on\./);
    assert.ok(run.journal().some(entry => entry.ended && entry.by === 'thinning' && entry.text === 'Ended: The Thinning opens.'), 'the journal keeps the end: news is resolved by it');
    const report = { log: [], warnings: [], journal: [{ day: 1, by: 'a', fired: true, text: 'A starts.' }, { day: 1, by: 'a', ended: true, text: 'Ended: A starts. (Mara survived)' }] };
    assert.match(dailySummary(report), /Mara survived/);
});

test('{place} names the town of a sub-place, in the firing, the end and the outcome; what is stored keeps the bound name', () => {
    const sub = 'Oakhollow / Civic Ward';
    const geo = buildGeo(world());
    assert.equal(eventWords(geo, { id: 'x', summary: 'Fire at {place}.' }, { place: sub, regionName: 'Valegard' }).text, 'Fire at Valegard.', 'a town the pack lacks: the region');
    geo.byName.set(sub.toLowerCase(), { name: sub, parent: 'Oakhollow' });
    const ws = { geo, events: { market: {} }, table: {}, anchor: () => {}, anchors: {}, journal: [], log: [], warnings: [], cast: {}, draw: () => 0 };
    const def = { id: 'market', title: 'market', kind: 'recurring', summary: 'Market season fills {place}.', ends: { instant: true }, where: { refs: [] }, outcomes: [{ name: 'busy', weight: 1, summary: 'Stalls crowd {place}.' }], effects: {} };
    const bind = { place: sub, regionName: 'Valegard' };
    fireEvent(ws, def, 1, bind, []);
    assert.deepEqual(ws.journal.map(entry => entry.text), ['Market season fills Oakhollow. Stalls crowd Oakhollow.', 'Ended: Market season fills Oakhollow.']);
    assert.equal(ws.journal[0].place, sub);
    assert.equal(ws.events.market.bind.place, sub);
    assert.deepEqual(Object.keys(ws.events.market.places), [sub]);
    assert.equal(bind.place, sub);
});
