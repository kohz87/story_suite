// An edit (or a delete) that moves the clock, then replies noted after it: the walk follows the clock as Story Block replays it,
// so each is compared with a fresh telling of the edited (or shortened) chat, and a rebuild from the stored records equals live.
// Sets (a date, a clock face, a skip) are taken as Story Block replays them (stored minute): the known limit, not tested here.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STORY, chronicleOf, editAndReread, reloadSame, replyAt, said, tell } from './note-cursor.helpers.js';
import { heardStamps } from '../../../src/v2/world/known-parts/heard.js';
import { calendarFrom } from '../../../src/v2/world/known-parts/clock.js';

const FIRST = 438445;
const quiet = t => t.mock.method(console, 'warn', () => {});
const strip = value => JSON.parse(JSON.stringify(value, (key, x) => (key === 'revs' || key === 'rev' ? undefined : x)));
const facts = host => Object.entries(chronicleOf(host).dayFacts ?? {}).sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true })).map(([, v]) => strip(v));
const written = host => Object.fromEntries(Object.entries(chronicleOf(host).days ?? {}).map(([day, v]) => [Number(day) - FIRST, (Array.isArray(v) ? v[0] : v)?.line ?? v]));
const dayFacts = host => { const q = host.sdk.query('chronicle.dayFacts', {}); return { days: q.days.map(d => [d.day - FIRST, d.facts.count, d.facts.places]), today: q.today - FIRST }; };
const placesByDay = host => facts(host).map(e => `${e.day - FIRST}:${e.places.join('/')}`);
const today = host => Math.floor(host.head().domains.director.time.minutes / 1440) - FIRST;
// The Journal's "today so far": what the receipts after the last note hold, as the query the screen reads gives it.
const pending = host => {
    const c = chronicleOf(host).noted; const note = Array.isArray(c) ? c.at(-1) : c;
    return host.sdk.query('chronicle.noteFacts', { after: note.rev, through: note.through, minutes: note.minutes, present: note.present }).entries.map(e => [e.day - FIRST, e.entry?.places]);
};
const send = async (host, from, replies) => { for (const [i, lines] of replies.entries()) await host.send('On.', said(`R${from + i}.`, lines)); };
const R3 = ['~ place Frostgate', '~ quest Q | done'];
const LATER = [['~ place Redmoor', '~ quest Z | step: x'], ['~ place Ashford', '~ quest Z | done']];
// Everything of the later replies (R2's own entry, written under the edit, left out) must equal a fresh telling.
const notR2 = list => list.filter(e => !e.places.includes('Old Weir'));

// Probe 10 A: R3 has its own duration, R4 too; the edit adds a day to R2.
test('an edit that adds +1 day, a later reply with its own +1 hour: filed, digested, queried and "today so far" as in a fresh telling', async t => {
    quiet(t);
    const r3 = ['! time +1 hour', '~ place Frostgate', '~ quest Q | done', '+ quest W — a ring | giver: C'];
    const later = [['! time +1 hour', '~ place Redmoor', '~ quest Z | step: x'], ['~ place Ashford', '~ quest Z | done']];
    const edited = [...STORY[2], '! time +1 day'];
    const live = await tell([...STORY.slice(0, 3), r3]);
    assert.equal((await editAndReread(live, 'R2', edited)).ok, true);
    const fresh = await tell([...STORY.slice(0, 2), edited, r3]);
    // R3 is the head: the Journal's "today so far" reads it on the edited clock (Frostgate on day 1, not day 0).
    assert.deepEqual(pending(live).filter(([, places]) => places?.includes('Frostgate')), [[1, ['Frostgate']]]);
    assert.deepEqual(pending(live), pending(fresh));
    await send(live, 4, later); await send(fresh, 4, later);
    assert.deepEqual(notR2(facts(live)), notR2(facts(fresh)));
    assert.deepEqual(placesByDay(live).filter(line => /Frostgate/.test(line)), placesByDay(fresh).filter(line => /Frostgate/.test(line)));
    assert.deepEqual(written(live), written(fresh));
    assert.deepEqual(dayFacts(live), dayFacts(fresh));
    assert.equal(today(live), today(fresh));
    // The last note's time settle jump (the "While away" skip test reads it): the walked clock at the settle before it, → the clock now.
    const noted = host => { const n = chronicleOf(host).noted; return strip(Array.isArray(n) ? n.at(-1) : n).settle; };
    assert.deepEqual(noted(live), noted(fresh));
    assert.equal(reloadSame(live), true);
    // A chat change (SillyTavern reopens the chat from what was saved): the same chronicle.
    const before = JSON.stringify(chronicleOf(live));
    await live.st.loadChat(JSON.parse(JSON.stringify(live.ctx.chat)));
    assert.equal(JSON.stringify(chronicleOf(live)), before);
    assert.deepEqual(dayFacts(live), dayFacts(fresh));
    live.close(); fresh.close();
});

// Probe 9: the edit removes R2's +1 day (alone, or with another clock line in R2).
for (const [name, original, edited] of [
    ['another clock line kept', [...STORY[2], '! time +1 day'], STORY[2]],
    ['the only clock line', ['~ place Old Weir', '~ quest Q | step: two', '! time +1 day'], ['~ place Old Weir', '~ quest Q | step: two']],
]) {
    test(`an edit that removes +1 day (${name}): the later replies are filed on day 0, as in a fresh telling`, async t => {
        quiet(t);
        const live = await tell([...STORY.slice(0, 2), original, R3]);
        assert.equal((await editAndReread(live, 'R2', edited)).ok, true);
        await send(live, 4, LATER);
        const fresh = await tell([...STORY.slice(0, 2), edited, R3, ...LATER]);
        assert.deepEqual(notR2(facts(live)), notR2(facts(fresh)));
        assert.deepEqual(written(live), written(fresh));
        assert.deepEqual(dayFacts(live), dayFacts(fresh));
        assert.equal(today(live), today(fresh));
        assert.equal(reloadSame(live), true);
        live.close(); fresh.close();
    });
}

// Probe-del, the move case: the middle reply that added a day is deleted (with its message), then one more reply.
test('a middle delete of a reply that moved the clock: the next reply (its own +1 hour) is filed on the shortened chat\'s clock', async t => {
    quiet(t);
    const r2 = [...STORY[2], '! time +1 day'];
    const r3 = ['! time +1 hour', '~ place Frostgate'];
    const r4 = ['~ place Redmoor'];
    const live = await tell([...STORY.slice(0, 2), r2, r3]);
    const at = replyAt(live, 'R2');
    await live.st.deleteMessage(at); await live.st.deleteMessage(at - 1);
    await send(live, 4, [r4]);
    const fresh = await tell([...STORY.slice(0, 2), r3, r4]);
    assert.deepEqual(placesByDay(live).filter(line => /Frostgate/.test(line)), placesByDay(fresh).filter(line => /Frostgate/.test(line)));
    assert.deepEqual(dayFacts(live).today, dayFacts(fresh).today);
    assert.equal(today(live), today(fresh));
    assert.equal(reloadSame(live), true);
    live.close(); fresh.close();
});

// A swipe of the head, and rewinding to before the edit and telling on: the same walk.
test('a swipe of the head after the edit, and a swipe back, leaves the chronicle as a fresh telling', async t => {
    quiet(t);
    const edited = [...STORY[2], '! time +1 day'];
    const r3 = ['! time +1 hour', '~ place Frostgate'];
    const live = await tell([...STORY.slice(0, 3), r3]);
    assert.equal((await editAndReread(live, 'R2', edited)).ok, true);
    await send(live, 4, [['~ place Redmoor']]);
    const places = host => dayFacts(host).days.map(([day, , list]) => `${day}:${list.join('/')}`);
    const head = replyAt(live, 'R4');
    await live.swipe(said('R4.', ['~ place Ashford']));
    const other = await tell([...STORY.slice(0, 2), edited, r3, ['~ place Ashford']]);
    assert.deepEqual(places(live), places(other));
    await live.st.swipeTo(head, 0);
    const fresh = await tell([...STORY.slice(0, 2), edited, r3, ['~ place Redmoor']]);
    assert.deepEqual(places(live), places(fresh));
    assert.equal(today(live), today(fresh));
    assert.equal(reloadSame(live), true);
    live.close(); fresh.close(); other.close();
});

// The World screen's "heard" stamps walk the same receipts: the date a world line was told on follows the edit.
test('"heard": the date a world line told before an edit that adds a day is stamped on is the edited one', async t => {
    quiet(t);
    const r3 = ['! time +1 hour', '~ place Frostgate', '+ world Border Unrest — raids along the river'];
    const edited = [...STORY[2], '! time +1 day'];
    const live = await tell([...STORY.slice(0, 3), r3]);
    const before = [...heardStamps({ receipts: () => live.store.receipts() }, calendarFrom(null)).values()].flat().map(s => s.when);
    assert.equal((await editAndReread(live, 'R2', edited)).ok, true);
    const fresh = await tell([...STORY.slice(0, 2), edited, r3]);
    const stamps = host => [...heardStamps({ receipts: () => host.store.receipts() }, calendarFrom(null)).values()].flat().map(s => `${s.where}|${s.when}`);
    assert.equal(stamps(live).length, 1);
    assert.deepEqual(stamps(live), stamps(fresh));
    assert.notDeepEqual(stamps(live).map(s => s.split('|')[1]), before, 'the stamp moved with the edit');
    live.close(); fresh.close();
});

// An edit grown then shrunk again (R2 gets +1 day, then loses it), and a rewind of the newest replies: the walk equals a fresh telling each time.
test('an edit grown then shrunk, then a rewind of the newest reply and a new one: filed as in a fresh telling', async t => {
    quiet(t);
    const grown = [...STORY[2], '! time +1 day'];
    const r3 = ['! time +1 hour', '~ place Frostgate'];
    const live = await tell([...STORY.slice(0, 3), r3]);
    assert.equal((await editAndReread(live, 'R2', grown)).ok, true);
    await send(live, 4, [['~ place Redmoor']]);
    assert.equal((await editAndReread(live, 'R2', STORY[2])).ok, true);
    const places = host => dayFacts(host).days.map(([day, , list]) => `${day}:${list.join('/')}`);
    const flat = await tell([...STORY.slice(0, 3), r3, ['~ place Redmoor']]);
    assert.deepEqual(places(live), places(flat));
    assert.equal(today(live), today(flat));
    const at = replyAt(live, 'R4');
    await live.st.deleteMessage(at); await live.st.deleteMessage(at - 1);
    await send(live, 4, [['~ place Ashford']]);
    const fresh = await tell([...STORY.slice(0, 3), r3, ['~ place Ashford']]);
    assert.deepEqual(places(live), places(fresh));
    assert.equal(today(live), today(fresh));
    assert.equal(reloadSame(live), true);
    live.close(); fresh.close(); flat.close();
});
