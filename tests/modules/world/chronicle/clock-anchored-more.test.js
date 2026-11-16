// Clock faces and skips after an edit that moves the clock by less than a day (a refused face that a fresh telling accepts, and the other way round),
// and after a swipe, a swipe back, a rewind and a unchanged Re-read: each equals a fresh telling of the chat as it now is.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STORY, editAndReread, replyAt, said, tell } from './note-cursor.helpers.js';
import { equal, quiet, reopened, send, snap } from './clock-anchored.helpers.js';

const grown = [...STORY[2], '! time +1 day'];

// R3 told at 7 pm: "8:00 am" is earlier, so it was refused and the clock stayed. R2 then gains +10 hours, which puts the clock at 5 am the next day: a fresh telling takes 8 am.
test('a refused `~` clock face keeps its mark: an edit that moves the clock before it makes it land, as in a fresh telling', async t => {
    quiet(t);
    const r3 = ['~ time 8:00 am', '~ place Frostgate'];
    const edited = [...STORY[2], '! time +10 hours'];
    const live = await tell([...STORY.slice(0, 3), r3]);
    const told = snap(live).minutes;
    assert.equal((await editAndReread(live, 'R2', edited)).ok, true);
    await send(live, 4, [['~ place Redmoor']]);
    const fresh = await tell([...STORY.slice(0, 2), edited, r3, ['~ place Redmoor']]);
    assert.equal(snap(fresh).at, snap(live).at);
    assert.ok(snap(live).minutes > told + 600, 'the clock moved on with the edit (the refused face landed on the new day)');
    equal(live, fresh, '~ time 8:00 am');
});

// R3 told at 7 pm: 9:30 pm is accepted. R2 then gains +4 hours (11 pm): a fresh telling refuses it and the clock stays at 11 pm.
test('an accepted `~` clock face the edit moves the clock past stays at the clock, as a refused face in a fresh telling does', async t => {
    quiet(t);
    const r3 = ['~ time 9:30 pm', '~ place Frostgate'];
    const edited = [...STORY[2], '! time +4 hours'];
    const live = await tell([...STORY.slice(0, 3), r3]);
    assert.equal((await editAndReread(live, 'R2', edited)).ok, true);
    await send(live, 4, [['~ place Redmoor']]);
    const fresh = await tell([...STORY.slice(0, 2), edited, r3, ['~ place Redmoor']]);
    equal(live, fresh, '~ time 9:30 pm');
});

test('a Re-read that changes nothing, a swipe of the last reply and a swipe back, and a rewind, equal a fresh telling', async t => {
    quiet(t);
    const r3 = ['! time next morning', '~ place Frostgate'];
    const live = await tell([...STORY.slice(0, 3), r3]);
    assert.equal((await editAndReread(live, 'R2', grown)).ok, true);
    assert.equal((await editAndReread(live, 'R2', grown)).ok, true, 'a second, unchanged Re-read');
    await send(live, 4, [['~ time 9:30 pm', '~ place Redmoor']]);
    equal(live, await tell([...STORY.slice(0, 2), grown, r3, ['~ time 9:30 pm', '~ place Redmoor']]), 'after the Re-reads');
    const last = live.ctx.chat.length - 1;
    await live.swipe(said('R4.', ['! time tomorrow evening', '~ place Ashford']));
    equal(live, await tell([...STORY.slice(0, 2), grown, r3, ['! time tomorrow evening', '~ place Ashford']]), 'swiped');
    await live.st.swipeTo(last, 0);
    equal(live, await tell([...STORY.slice(0, 2), grown, r3, ['~ time 9:30 pm', '~ place Redmoor']]), 'swiped back');
    await live.st.deleteMessage(last);
    await live.st.deleteMessage(last - 1);
    // A rewind leaves what the notes kept for the replies it removed (not this fix's); the clock and the queries equal a fresh telling.
    const fresh = await tell([...STORY.slice(0, 2), grown, r3]);
    const view = host => ({ at: snap(host).at, dayFacts: snap(host).dayFacts });   // "today so far" reads the notes the rewind left
    assert.deepEqual(view(live), view(fresh), 'rewound: head clock, dayFacts');
    assert.ok(replyAt(live, 'R3') > 0);
});

test('a joined line (a date and a skip on one line) writes plain sets and is read as before an edit', async t => {
    quiet(t);
    const r3 = ['~ time June 4, 1200, 10:00 pm · ! time next morning', '~ place Frostgate'];
    const live = await tell([...STORY.slice(0, 3), r3]);
    assert.equal((await editAndReread(live, 'R2', grown)).ok, true);
    const fresh = await tell([...STORY.slice(0, 2), grown, r3]);
    // A date and a skip on one line are one stored set: the clock is the one the line said, unchanged by the edit (a stated limit).
    assert.equal(snap(live).minutes % 1440, snap(fresh).minutes % 1440);
});

test('the receipt says what the op is: a face is "same" (a refused one keeps the face it asked for), a skip and a bare `!` time are "after", a date is a set, a duration a move', async t => {
    quiet(t);
    const kinds = async line => {
        const host = await tell([STORY[0], [line]]);
        const receipt = host.store.receipts().map(entry => entry.receipt).filter(r => r.type === 'capture.time').at(-1);
        return { kind: receipt.data.kind, to: receipt.data.to, op: host.ctx.chat[replyAt(host, 'R1')].extra.storySuite.ops.find(o => o.path === '/domains/director/time/minutes') };
    };
    assert.equal((await kinds('~ time 9:30 pm')).kind, 'same');
    assert.equal((await kinds('! time next morning')).kind, 'after');
    assert.equal((await kinds('! time 9:30 pm')).kind, 'after');
    assert.equal((await kinds('~ time June 4, 1200, 9:30 pm')).kind, 'set');
    assert.equal((await kinds('! time +1 hour')).kind, 'move');
    const refused = await kinds('~ time 8:00 am');
    assert.equal(refused.kind, 'same');
    assert.equal(refused.to % 1440, 480, 'the face it asked for');
    assert.deepEqual([refused.op.period, refused.op.roll, refused.op.to === refused.to], [1440, 'same', true], 'the op carries the mark');
});
