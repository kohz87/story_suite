// LA-3: the open menu shown to the Director offers only what code accepts at the slot: no ladder direction without a rung, no clear of a condition that does not hold.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeWs } from '../../../../modules/world/daily/step.js';
import { shownMenu } from '../../../../modules/world/chronicle/world-daily/open-menu.js';
import { slotView } from '../../../../modules/world/chronicle/world-daily/open-context.js';
import { slotBlock } from '../../../../modules/world/chronicle/world-daily/open-prompt.js';
import { WORLD } from './open-host.helpers.js';

const world = { ...WORLD, conditions: [...WORLD.conditions, { name: 'riots', scope: 'place', fades: '5 days', open: true }, { name: 'uprising', scope: 'place', fades: '5 days', open: true }] };
const slot = { key: 's1', place: 'Highmark', region: 'The March', realm: 'March Realm' };
const ladder = direction => ({ ladder: { of: ['unrest', 'riots', 'uprising'], step: 1, direction } });
const clear = { clear: { pick: 1, of: ['unrest', 'riots'] } };
// A ws where `held` names are active at Highmark.
function wsWith(held) {
    const { ws } = makeWs({ world, today: 5, seed: 'abc' });
    for (const name of held) ws.table[`${name}@Highmark`] = { name, scope: 'place', ref: 'Highmark', since: 0, fadesAt: null };
    return ws;
}

test('a ladder with no rung down from the bottom is not offered; either becomes up; a clear of an absent condition is not offered', () => {
    const none = wsWith([]);
    assert.equal(shownMenu(none, ladder('down'), slot).ladder, undefined, 'down with nothing held');
    assert.equal(shownMenu(wsWith(['unrest']), ladder('down'), slot).ladder, undefined, 'down from the lowest rung');
    assert.equal(shownMenu(none, ladder('either'), slot).ladder.direction, 'up');
    assert.equal(shownMenu(wsWith(['unrest', 'riots']), ladder('either'), slot).ladder.direction, 'either');
    assert.equal(shownMenu(wsWith(['unrest', 'riots', 'uprising']), ladder('either'), slot).ladder.direction, 'down', 'the top rung only goes down');
    assert.equal(shownMenu(wsWith(['uprising']), ladder('up'), slot).ladder, undefined, 'up from the top');
    assert.equal(shownMenu(none, clear, slot).clear, undefined);
    assert.deepEqual(shownMenu(wsWith(['riots']), clear, slot).clear.of, ['riots']);
    const view = { name: 'n', summary: 's', menu: shownMenu(none, { ...ladder('down'), ...clear }, slot), facts: [], conditions: [], figures: [] };
    assert.match(slotBlock(slot, view), /nothing \(write only the name and summary\)/);
});

// LF4-8 rest: the helper is told the region's name, never its id, in the Where line and in the conditions held there.
test('the open helper prompt shows the region by name, not by id (LF4-8 rest)', () => {
    const named = { ...world, regions: [{ id: 'the-march', name: 'The March' }], places: world.places.map(place => ({ ...place, region: 'the-march' })), realms: [{ name: 'March Realm', regions: ['the-march'] }] };
    const { ws } = makeWs({ world: named, today: 5, seed: 'abc' });
    ws.table['unrest@the-march'] = { name: 'unrest', scope: 'region', ref: 'the-march', since: 0, fadesAt: null };
    const there = { key: 's1', place: 'Highmark', region: 'the-march', regionName: 'The March', realm: 'March Realm' };
    const view = slotView(ws, ws.templates.get('border-incident'), there, named);
    const block = slotBlock(there, view);
    assert.match(block, /Where: Highmark \(region The March, realm March Realm\)/);
    assert.doesNotMatch(block, /the-march/);
    assert.match(block, /unrest at The March/);
    // A slot saved before regionName existed still reads the name from the pack's regions.
    const old = slotBlock({ ...there, regionName: undefined }, slotView(ws, ws.templates.get('border-incident'), { ...there, regionName: undefined }, named));
    assert.match(old, /unrest at The March/);
    assert.match(old, /Where: Highmark \(region The March,/);
});
