// Settings › Director calls this game year (`chronicle.directorCalls`): the open templates' calls (the ledger's open.yearCalls, of the year they were made in) plus the arc judge's
// calls (kept on each arc, by the year it began in). The query used to read a field the ledger never wrote, so it always said 0.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { directorCallsQuery } from '../../../../modules/world/chronicle/conditions/director-calls.js';
import { storeOpen, validateLedger } from '../../../../modules/world/chronicle/conditions/ledger.js';
import { PRESETS, makeCalendar } from '../../../../modules/time/calendar.js';
import { toSlot } from '../../../../modules/rpg/slot.js';
import { ledgerOpen, openHost, reply, settle } from './open-host.helpers.js';
import { slotValue } from '../../../../modules/rpg/slot.js';

const YEAR = 525600 * 1200;
const NOW = makeCalendar(PRESETS.gregorian).fromAbs(YEAR + 1000).year;
const stateWith = ({ open = null, arcs = {}, clock = true } = {}) => ({ domains: { chronicle: { ledger: open ? toSlot({ anchors: {}, open }) : undefined }, arc: { arcs, ends: {} }, director: { time: { minutes: clock ? YEAR + 1000 : null } } } });
const ask = (state, minutes = YEAR + 1000) => directorCallsQuery(state, {}, { query: name => (name === 'director.time' ? { minutes } : null) });

test('the open templates\' calls reach the counter, the year they were made in', async () => {
    const host = await openHost();
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await settle();
    await host.send('Hours pass.', reply('Hours pass.', ['! time +1h']));
    await settle();
    await host.send('More.', reply('More.', ['! time +1h']));
    await settle();
    assert.equal(ledgerOpen(host).calls, 1);
    assert.equal(ledgerOpen(host).year, 1200);
    assert.equal(ledgerOpen(host).yearCalls, 1);
    assert.deepEqual(host.sdk.query('chronicle.directorCalls', {}), { count: 1 }, 'the settings row used to show 0');
    host.done();
});

test('the count is this game year\'s: open calls of an earlier year and arcs of an earlier year are not in it; judge calls add', () => {
    const arcs = { a: { minutes: YEAR + 5, judge: { calls: 2 } }, b: { minutes: YEAR - 525600 * 2, judge: { calls: 9 } }, c: { minutes: YEAR + 9 } };
    assert.deepEqual(ask(stateWith({ open: { results: {}, calls: 7, year: NOW, yearCalls: 3 }, arcs })), { count: 5 });
    assert.deepEqual(ask(stateWith({ open: { results: {}, calls: 7, year: NOW - 1, yearCalls: 3 }, arcs })), { count: 2 }, 'the open calls were made last year');
    assert.deepEqual(ask(stateWith({ open: { results: {}, calls: 7 } })), { count: 0 }, 'no year kept: none counted');
    assert.deepEqual(ask(stateWith({})), { count: 0 });
    assert.deepEqual(ask(stateWith({ arcs, clock: false }), null), { count: 0 }, 'no clock: no year');
});

test('storeOpen counts a year\'s calls and starts again in the next year; the ledger validates the new fields', () => {
    const chronicle = {};
    storeOpen(chronicle, { calls: 2, year: 1200 });
    storeOpen(chronicle, { calls: 1, year: 1200 });
    assert.deepEqual(slotValue(chronicle.ledger).open, { results: {}, calls: 3, year: 1200, yearCalls: 3 });
    storeOpen(chronicle, { calls: 1, year: 1201 });
    assert.deepEqual(slotValue(chronicle.ledger).open, { results: {}, calls: 4, year: 1201, yearCalls: 1 });
    storeOpen(chronicle, { calls: 1 });
    assert.deepEqual(slotValue(chronicle.ledger).open, { results: {}, calls: 5 }, 'a call with no year known keeps no year');
    assert.deepEqual(validateLedger(chronicle.ledger), []);
    assert.equal(validateLedger([{ anchors: {}, open: { results: {}, calls: 1, year: 1200 } }]).length, 1, 'a year with no tally is refused');
});
