// The chronicle's note cursor follows a scene change an edit adds: a Re-read of the reply that carries the cursor note (R2)
// that adds a scene line moves the scene the next replies start from, so their facts are filed with the people a fresh
// telling of the edited chat gives. A clock change an edit adds is NOT followed (known limit, option A): a reply told before
// the edit keeps its pre-edit time, so it is filed under the day before the edit. The clock case below pins that on purpose.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STORY, chronicleOf, editAndReread, reloadSame, said, tell } from './note-cursor.helpers.js';

const quiet = t => t.mock.method(console, 'warn', () => {});
const strip = value => JSON.parse(JSON.stringify(value, (key, x) => (key === 'revs' || key === 'rev' ? undefined : x)));
const entries = host => Object.entries(chronicleOf(host).dayFacts ?? {}).sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true })).map(([, v]) => strip(v));
// The day facts after the edited reply: its own entries (days 0 of the first three replies' notes) left out.
const FIRST = 438445;
const written = host => Object.fromEntries(Object.entries(chronicleOf(host).days ?? {}).map(([day, v]) => [Number(day) - FIRST, (Array.isArray(v) ? v[0] : v)?.line ?? v]));
// R3 is noted before the edit (its entry stays as noted); the replies sent after the edit are filed on the edited chat's clock and scene.
const R3 = ['~ place Frostgate', '~ quest Q | done'];
const LATER = [['~ place Redmoor', '~ quest Z | step: x'], ['~ place Ashford', '~ quest Z | done']];

const edit = async extra => {
    const edited = [...STORY[2], ...extra];
    const live = await tell([...STORY.slice(0, 3), R3]);
    assert.equal((await editAndReread(live, 'R2', edited)).ok, true);
    for (const [i, lines] of LATER.entries()) await live.send('On.', said(`R${4 + i}.`, lines));
    const fresh = await tell([...STORY.slice(0, 2), edited, R3, ...LATER]);
    return { live, fresh };
};
const dayOf = (host, place) => Object.values(chronicleOf(host).dayFacts ?? {}).find(entry => entry.places.includes(place))?.day - FIRST;

test("an edited Re-read of the cursor's reply that adds a scene change: the next replies are filed as in a fresh telling", async t => {
    quiet(t);
    const { live, fresh } = await edit(['+ present Mira']);
    const tail = list => list.filter(entry => entry.places.includes('Redmoor'));
    assert.equal(tail(entries(live)).length, 1);
    assert.deepEqual(tail(entries(live)), tail(entries(fresh)));
    assert.equal(reloadSame(live), true);
    live.close(); fresh.close();
});

// KNOWN LIMIT (option A, planned follow-up): the cursor does not follow a clock change an edit adds. R3 was told before the
// edit, so its receipts keep the pre-edit time and its place is filed under June 3, and that day's written digest keeps it;
// a fresh telling files it under June 4. If a later fix makes this equal a fresh telling, flip these assertions on purpose.
test('an edited Re-read that adds a clock change: a reply told before the edit stays on the day before it (known limit)', async t => {
    quiet(t);
    const { live, fresh } = await edit(['! time +1 day']);
    assert.equal(dayOf(live, 'Frostgate'), 0);
    assert.equal(dayOf(fresh, 'Frostgate'), 1);
    assert.match(written(live)[0] ?? '', /Frostgate/);
    assert.doesNotMatch(written(fresh)[0] ?? '', /Frostgate/);
    assert.equal(reloadSame(live), true);
    live.close(); fresh.close();
});
