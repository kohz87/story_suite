// The chronicle's note cursor follows an edit's clock and scene change: a Re-read of the reply that carries the cursor note
// (R2) that adds `! time +1 day` or a scene line moves the clock and scene the next replies start from, so their facts are
// filed under the day (and with the people) a fresh telling of the edited chat gives. Only the edited reply's own entry
// differs (the known limit: its added facts are not noted).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STORY, chronicleOf, editAndReread, reloadSame, said, tell } from './note-cursor.helpers.js';

const quiet = t => t.mock.method(console, 'warn', () => {});
const strip = value => JSON.parse(JSON.stringify(value, (key, x) => (key === 'revs' || key === 'rev' ? undefined : x)));
const entries = host => Object.entries(chronicleOf(host).dayFacts ?? {}).sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true })).map(([, v]) => strip(v));
// The day facts after the edited reply: its own entries (days 0 of the first three replies' notes) left out.
const FIRST = 438445;
const written = host => Object.fromEntries(Object.entries(chronicleOf(host).days ?? {}).map(([day, v]) => [Number(day) - FIRST, (Array.isArray(v) ? v[0] : v)?.line ?? v]));
// R3 is noted by R4's turn, after the edit: it and every later reply are filed on the edited chat's clock and scene.
const R3 = ['~ place Frostgate', '~ quest Q | done'];
const LATER = [['~ place Redmoor', '~ quest Z | step: x'], ['~ place Ashford', '~ quest Z | done']];

for (const [name, extra, scene] of [['a clock change', ['! time +1 day'], false], ['a scene change', ['+ present Mira'], true]]) {
    test(`an edited Re-read of the cursor's reply that adds ${name}: the next replies are filed as in a fresh telling`, async t => {
        quiet(t);
        const edited = [...STORY[2], ...extra];
        const live = await tell([...STORY.slice(0, 3), R3]);
        const res = await editAndReread(live, 'R2', edited);
        assert.equal(res.ok, true);
        for (const [i, lines] of LATER.entries()) await live.send('On.', said(`R${4 + i}.`, lines));
        const fresh = await tell([...STORY.slice(0, 2), edited, R3, ...LATER]);
        const mine = entries(live);
        const theirs = entries(fresh);
        // The replies after the edit: the same entries, on the same days, with the same people.
        const tail = list => list.filter(entry => entry.places.some(place => ['Frostgate', 'Redmoor'].includes(place)));
        assert.equal(tail(mine).length, 2);
        assert.deepEqual(tail(mine), tail(theirs));
        // R3 and the later replies: the same entries on the same days; only R2's own entry may differ.
        assert.equal(mine.length, theirs.length);
        assert.deepEqual(mine.filter(entry => !entry.places.includes('Old Weir')), theirs.filter(entry => !entry.places.includes('Old Weir')));
        // The written digest of the edit's day (June 3) as in a fresh telling: it holds neither R3's Frostgate nor the later replies.
        if (!scene) {
            assert.deepEqual(written(live), written(fresh));
            assert.doesNotMatch(written(live)[0] ?? '', /Frostgate|Redmoor/);
            assert.match(written(live)[0] ?? '', /Old Weir/);
        }
        assert.equal(reloadSame(live), true);
        live.close(); fresh.close();
    });
}
