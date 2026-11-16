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

const edit = async (extra, r3 = R3, later = LATER, unedited = false) => {
    const edited = [...STORY[2], ...extra];
    const live = await tell([...STORY.slice(0, 3), r3]);
    assert.equal((await editAndReread(live, 'R2', edited)).ok, true);
    for (const [i, lines] of later.entries()) await live.send('On.', said(`R${4 + i}.`, lines));
    const fresh = await tell([...STORY.slice(0, 2), edited, r3, ...later]);
    return { live, fresh, ...(unedited ? { unedited: await tell([...STORY.slice(0, 3), r3, ...later]) } : {}) };
};
const dayOf = (host, place) => Object.values(chronicleOf(host).dayFacts ?? {}).find(entry => entry.places.includes(place))?.day - FIRST;

// The later reply leaves Mira, whom the edit put in the scene. The "Mira leaves." line is Story Block's own replay of the
// present line, so these assertions pin the host's replay, not the chronicle's scene start (the next test pins that).
test("an edited Re-read of the cursor's reply that adds a scene change: the next reply is filed as in a fresh telling", async t => {
    quiet(t);
    const { live, fresh, unedited } = await edit(['+ present Mira'], ['~ quest Q | done'], [['~ quest Z — x | giver: B', '- present Mira'], ['~ place Redmoor']], true);
    // The later reply's entry: where a fresh telling of the edited chat has "Mira leaves." (the same place in each chat's list).
    const at = entries(fresh).findIndex(entry => JSON.stringify(entry).includes('Mira leaves'));
    assert.ok(at >= 0);
    const next = host => entries(host)[at];
    assert.deepEqual(next(live), next(fresh));
    assert.notDeepEqual(next(live), next(unedited));
    assert.doesNotMatch(JSON.stringify(next(unedited)), /Mira leaves/);
    assert.equal(reloadSame(live), true);
    live.close(); fresh.close(); unedited.close();
});

// What the chronicle itself records from its walk start (receipts.js sceneOf): the later replies do not touch the scene, so the
// next note's stored present is the scene the walk started from, which the edited Re-read put Mira into.
test("an edited Re-read that adds a scene change: the next note's stored present is the edited scene, as in a fresh telling", async t => {
    quiet(t);
    const { live, fresh, unedited } = await edit(['+ present Mira'], ['~ quest Q | done'], [['+ quest W — find the ring | giver: B'], ['~ place Ashford']], true);
    const present = host => chronicleOf(host).noted.at(-1)?.present;
    assert.deepEqual(present(live), ['Mira']);
    assert.deepEqual(present(live), present(fresh));
    assert.equal(present(unedited), undefined);
    assert.equal(reloadSame(live), true);
    live.close(); fresh.close(); unedited.close();
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
