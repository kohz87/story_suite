// LAB-5: the words the reader sees use the pack's region names (`content.regions`), never the ids: the {region} of an open template's
// fallback line, the arc brief's event line, the region a hidden place's news is named by, and the query the World tab reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { arcBrief } from '../../../../modules/world/chronicle/world-daily/arc-brief.js';
import { runDays } from '../../../../modules/world/daily/step.js';
import { shownPlace } from '../../../../modules/world/world/news-reach.js';
import { WORLD, open } from '../open/open-host.helpers.js';
import { newHost, SPEC } from './daily-host.helpers.js';

const REGIONS = [{ id: 'bluewatch-reach', name: 'Bluewatch Reach', aliases: ['the reach'] }];

test('LAB-5: an open template\'s fallback line says the region\'s name, not its id', () => {
    const world = {
        ...WORLD, regions: REGIONS, realms: [{ name: 'March Realm', regions: ['bluewatch-reach'] }],
        places: WORLD.places.map(place => ({ ...place, region: 'bluewatch-reach' })),
        templates: [open('border-incident', { summary: 'Trouble in {region}.' })],
    };
    const first = runDays({ world, today: 10, seed: 'seed1', draw: () => 0, state: null });
    const aged = runDays({ world, today: 14, seed: 'seed1', draw: () => 0, state: first.daily, table: first.conditions });
    const lines = aged.report.journal.map(entry => entry.text).join('|');
    assert.match(lines, /Trouble in Bluewatch Reach\./, lines);
    assert.doesNotMatch(lines, /bluewatch-reach/);
});

test('LAB-5: the arc brief names the region of a running event, not its id', () => {
    const world = { ...SPEC, places: [{ name: 'Highmark', region: 'The March' }], events: [{ ...SPEC.events[0], summary: 'Unrest in {region}.' }] };
    const row = { state: 'active', bind: { place: 'Highmark', region: 'bluewatch-reach', regionName: 'Bluewatch Reach' } };
    assert.equal(arcBrief({ daily: { events: { levy: row } }, world, place: 'Highmark' }).threads[0].now, 'Unrest in Bluewatch Reach.');
    const bare = { ...row, bind: { place: 'Highmark', region: 'bluewatch-reach' } };
    assert.equal(arcBrief({ daily: { events: { levy: bare } }, world, place: 'Highmark' }).threads[0].now, 'Unrest in bluewatch-reach.', 'a pack that names no region: the id is the last resort');
});

test('LAB-5: news of a hidden place the atlas does not show is named by its region\'s name', () => {
    const origin = { name: 'Hidden Vale', region: 'bluewatch-reach', regionName: 'Bluewatch Reach', hidden: true };
    assert.equal(shownPlace(origin, { query: () => [] }, 'Hidden Vale'), 'Bluewatch Reach');
    assert.equal(shownPlace({ ...origin, regionName: undefined }, { query: () => [] }, 'Hidden Vale'), 'bluewatch-reach', 'no name: the id');
});

test('LAB-5: chronicle.regionNames answers the names by id, name and alias with World events on, and nothing with it off', async () => {
    const on = await newHost(true, { ...SPEC, regions: REGIONS });
    assert.deepEqual(on.sdk.query('chronicle.regionNames', {}), { 'bluewatch-reach': 'Bluewatch Reach', 'bluewatch reach': 'Bluewatch Reach', 'the reach': 'Bluewatch Reach' });
    on.done();
    const off = await newHost(false, { ...SPEC, regions: REGIONS });
    assert.equal(off.sdk.query('chronicle.regionNames', {}) ?? null, null);
    off.done();
});
