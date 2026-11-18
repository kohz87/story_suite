// WEALIGN, seam audit E33/E34 unit side: the daily step's journal as chronicle entries. One entry per occurrence with a fixed id
// (the same happening written twice is one entry), a unique dated name, its reach and place (a region-wide event's seat), resolved on
// its end; a full chronicle (60 under way) takes no more, and the chronicle stays valid.
import test from 'node:test';
import assert from 'node:assert/strict';

import { writeHappenings } from '../../../../modules/world/chronicle/world-daily/news-entries.js';
import { validateChronicle } from '../../../../modules/world/chronicle/domain.js';
import { part } from '../../../../modules/world/chronicle/index.js';
import { buildGeo } from '../../../../modules/world/daily/geo.js';
import { world } from './helpers.js';

const DAY = 1440;
const ctx = { ifThere: () => {} };
const geo = buildGeo(world());
const fresh = () => part.domains.chronicle.initial();
const levy = (day, extra = {}) => ({ day, text: 'The lord calls a levy.', by: 'levy', fired: true, reach: 'realm', where: ['Highmark March'], ...extra });

test('E33: one entry per occurrence, a fixed id and a dated unique name; the same happening written again is the same entry', () => {
    const chronicle = fresh();
    const { written } = writeHappenings(ctx, chronicle, [levy(5)], { geo, rev: 3, dateOf: day => `day ${day}` });
    assert.equal(written.length, 1);
    const entry = chronicle.events[written[0]];
    assert.deepEqual([entry.name, entry.state, entry.since, entry.reach, entry.place, entry.by], ['The lord calls a levy · day 5', 'ongoing', 5 * DAY, 'realm', 'Highmark Capital', 'event:world.levy'], 'a region-wide event comes from its seat');
    assert.deepEqual(writeHappenings(ctx, chronicle, [levy(5)], { geo, rev: 4, dateOf: day => `day ${day}` }).written, [], 'written again: unchanged, not a second');
    const again = writeHappenings(ctx, chronicle, [levy(9)], { geo, rev: 5, dateOf: () => 'day 5' });
    assert.notEqual(again.written[0], written[0], 'another day is another occurrence');
    assert.equal(chronicle.events[again.written[0]].name, 'The lord calls a levy · day 5 (2)', 'its name is unique');
    writeHappenings(ctx, chronicle, [{ day: 12, text: 'Ended: The lord calls a levy.', by: 'levy', ended: true }], { geo, rev: 6 });
    assert.deepEqual(Object.values(chronicle.events).map(event => [event.since, event.state, event.updated]).sort((a, b) => a[0] - b[0]), [[5 * DAY, 'ongoing', 5 * DAY], [9 * DAY, 'resolved', 12 * DAY]], 'the end resolves the newest open one');
    assert.deepEqual(validateChronicle(chronicle), []);
    // A minor template's happening is local, resolved at once, and named by its template.
    const minor = fresh();
    const out = writeHappenings(ctx, minor, [{ day: 2, text: 'Riot in Town.', by: 'template:riot', place: 'Town', reach: 'local' }], { geo, rev: 1 });
    assert.deepEqual(['state', 'by', 'reach', 'place'].map(key => minor.events[out.written[0]][key]), ['resolved', 'event:world.template.riot', 'local', 'Town']);
});

test('E33: a chronicle already holding 60 events under way takes no more (the happening is reported as skipped); it stays valid', () => {
    const chronicle = fresh();
    for (let i = 0; i < 60; i += 1) {
        const id = `ev_${String(i).padStart(8, '0')}`;
        chronicle.events[id] = { id, name: `Trouble ${i}`, summary: '', state: 'ongoing', since: 0, updated: 0, place: '', factions: [], aka: [], rev: 1 };
    }
    assert.deepEqual(validateChronicle(chronicle), []);
    const out = writeHappenings(ctx, chronicle, [levy(5)], { geo, rev: 2 });
    assert.deepEqual([out.written, out.skipped], [[], ['The lord calls a levy.']]);
    assert.deepEqual(validateChronicle(chronicle), []);
});
