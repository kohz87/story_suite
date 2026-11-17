// Seam audit E32 (WEALIGN): the thread kind of a world-event mirror is `world-event`, not `event` (that one is taken: a quest-like
// kind, picked for initiative and offers, listed in News). A saved world-event thread is valid; it is the Director's own; no line
// writes it (it is no capture kind, so the narrator's grammar is unchanged); News lists only `event` threads.
import test from 'node:test';
import assert from 'node:assert/strict';

import { part } from '../../../../modules/time/tracker/index.js';
import { THREAD_KINDS_OWNED, WORLD_EVENT_KIND, ownedKind } from '../../../../modules/time/tracker/threads.js';
import { threadErrors } from '../../../../modules/time/tracker/domain-parts/thread-errors.js';
import { knownNews } from '../../../../modules/world/world/known.js';

const thread = kind => ({
    id: 'th_abcdefgh', kind, key: 'Succession Crisis', summary: 'The regent holds.', fields: { now: 'the regent holds', then: 'outcome decided by the world' },
    status: 'active', rev: 1, track: { created: { time: 100 } },
});

test('E32: a world-event thread is valid and owned, is no capture kind, and stays out of News (an event thread is in it)', () => {
    assert.equal(WORLD_EVENT_KIND, 'world-event');
    const errors = threadErrors('th_abcdefgh', thread(WORLD_EVENT_KIND));
    assert.equal(errors.some(text => /unknown kind/.test(text)), false, errors.join(' '));
    assert.ok(threadErrors('th_abcdefgh', thread('mirror')).some(text => /unknown kind "mirror"/.test(text)));
    assert.equal(ownedKind(WORLD_EVENT_KIND), true);
    assert.ok(THREAD_KINDS_OWNED.includes('event'));
    assert.equal(Object.hasOwn(part.kinds, WORLD_EVENT_KIND), false, 'no line writes it');
    assert.ok(Object.hasOwn(part.kinds, 'event'));
    const news = kind => knownNews({ domains: { director: { threads: { th_abcdefgh: thread(kind) } }, chronicle: { events: {}, factions: {} } } }, { query: () => null });
    assert.deepEqual(news(WORLD_EVENT_KIND), []);
    assert.equal(news('event').length, 1);
});
