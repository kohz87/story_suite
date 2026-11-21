// The conditions table as the readers see it (WORLDEV finding 1): an event hold counts only while the step says that event is Active.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { liveTable } from '../../../../modules/world/chronicle/conditions/live-holds.js';

const TABLE = Object.freeze({
    'unrest@Highmark': { name: 'unrest', ref: 'Highmark', fadesAt: null, holds: ['levy'] },
    'fog@Bluewatch': { name: 'fog', ref: 'Bluewatch', fadesAt: 900, holds: ['levy'] },
    'gate@Highmark': { name: 'gate', ref: 'Highmark', fadesAt: null, holds: ['levy'], open: true },
    'dear@Highmark': { name: 'dear', ref: 'Highmark', fadesAt: null, holds: ['levy', 'omen'] },
    'calm@Highmark': { name: 'calm', ref: 'Highmark', fadesAt: 500 },
});

test('dead holds go: an entry held only by an ended event goes; a timer or an open setter keeps it; a live hold stays', () => {
    const live = liveTable(TABLE, { events: { levy: { state: 'ended' }, omen: { state: 'active' } } });
    assert.deepEqual(Object.keys(live).sort(), ['calm@Highmark', 'dear@Highmark', 'fog@Bluewatch', 'gate@Highmark']);
    assert.deepEqual(live['fog@Bluewatch'], { name: 'fog', ref: 'Bluewatch', fadesAt: 900 });
    assert.deepEqual(live['gate@Highmark'], { name: 'gate', ref: 'Highmark', fadesAt: null });
    assert.deepEqual(live['dear@Highmark'].holds, ['omen']);
    assert.equal(live['calm@Highmark'], TABLE['calm@Highmark']);
});

test('nothing changes: every hold live, an id the step does not know, or no step state (the same table back)', () => {
    assert.equal(liveTable(TABLE, { events: { levy: { state: 'active' }, omen: { state: 'active' } } }), TABLE);
    assert.equal(liveTable(TABLE, { events: {} }), TABLE);
    assert.equal(liveTable(TABLE, null), TABLE);
    assert.deepEqual(liveTable(undefined, null), {});
});
