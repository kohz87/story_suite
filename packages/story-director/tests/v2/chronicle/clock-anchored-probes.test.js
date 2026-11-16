// Probe 10 B (R3 and later replies with their own clock faces and skips after an edit that adds a day to R2), the Problem a refused face keeps, and the
// day a jump opened (`openDay`): an early `~` face right after a skip that an edit moved.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STORY, chronicleOf, editAndReread, tell } from './note-cursor.helpers.js';
import { equal, quiet, send, snap } from './clock-anchored.helpers.js';

const FIRST = 438445;
const grown = [...STORY[2], '! time +1 day'];
const problems = host => Object.values(host.head().domains.director.problems ?? {}).map(p => p.text).sort();
const events = host => JSON.stringify([0, 1, 2, 3].map(d => host.sdk.query('chronicle.dayEvents', { day: FIRST + d })?.events));
const strip = value => JSON.parse(JSON.stringify(value, (key, x) => (key === 'revs' || key === 'rev' ? undefined : x)));
const facts = host => Object.entries(chronicleOf(host).dayFacts ?? {}).sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true })).map(([, v]) => strip(v));

test('probe 10 B: R3 with `~ time 9:30 pm` and later `! time next morning` and `! time +2h` replies: filed, digested, queried and "today so far" as in a fresh telling', async t => {
    quiet(t);
    const r3 = ['~ time 9:30 pm', '~ place Frostgate', '~ quest Q | done', '+ quest W — a ring | giver: C'];
    const later = [['! time next morning', '~ place Redmoor', '~ quest Z | step: x'], ['! time +2h', '~ place Ashford', '~ quest Z | done']];
    const live = await tell([...STORY.slice(0, 3), r3]);
    assert.equal((await editAndReread(live, 'R2', grown)).ok, true);
    const fresh = await tell([...STORY.slice(0, 2), grown, r3]);
    assert.deepEqual(snap(live), snap(fresh), 'right after the Re-read (R3 is the un-noted head)');
    await send(live, 4, later); await send(fresh, 4, later);
    equal(live, fresh, 'probe 10 B');
    const notR2 = list => list.filter(e => !e.places.includes('Old Weir'));
    assert.deepEqual(notR2(facts(live)), notR2(facts(fresh)), 'every entry but R2\'s own');
    assert.equal(events(live), events(fresh), 'dayEvents');
});

test('a refused `~` face that a change makes land: the clock equals a fresh telling; the Problem it was refused with stays (a fresh telling adds none)', async t => {
    quiet(t);
    const r3 = ['~ time 8:00 am', '~ place Frostgate'];
    const edited = [...STORY[2], '! time +10 hours'];
    const live = await tell([...STORY.slice(0, 3), r3]);
    assert.equal(problems(live).filter(text => /earlier than the story time/.test(text)).length, 1, 'refused when told');
    assert.equal((await editAndReread(live, 'R2', edited)).ok, true);
    const fresh = await tell([...STORY.slice(0, 2), edited, r3]);
    assert.equal(snap(live).at, snap(fresh).at);
    assert.equal(problems(fresh).filter(text => /earlier than the story time/.test(text)).length, 0, 'a fresh telling does not refuse it');
    assert.equal(problems(live).filter(text => /earlier than the story time/.test(text)).length, 1, 'the live Problem stays (stated limit)');
});

test('the day a jump opened (`openDay`) is replayed as stored: a `~` face earlier than the landing face after a skip an edit moved (stated limit)', async t => {
    quiet(t);
    const r3 = ['! time next morning', '~ place Frostgate'];
    const r4 = ['~ time 7:00 am', '~ place Redmoor'];
    const live = await tell([...STORY.slice(0, 3), r3]);
    assert.equal((await editAndReread(live, 'R2', grown)).ok, true);
    await send(live, 4, [r4]);
    const fresh = await tell([...STORY.slice(0, 2), grown, r3, r4]);
    // The skip landed on day 2 but `openDay` still names day 1: the early face is refused (the clock stays at the skip's 9 am) where a fresh telling sets 7 am.
    assert.equal(snap(fresh).at, 'd2@420');
    assert.equal(snap(live).at, 'd2@540', 'known limit: pinned so a fix flips it on purpose');
});
