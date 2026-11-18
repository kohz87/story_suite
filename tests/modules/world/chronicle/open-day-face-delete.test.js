// Soak W4: an earlier `~` clock face on the day a jump landed on (`! time +2 days` then `~ time 6:30 am`) is an anchored set (roll `day`), so
// deleting, swiping or editing an earlier reply that moved the clock moves the face with the day, as a fresh telling does; the chronicle agrees.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { editAndReread, reloadSame, said, tell } from './note-cursor.helpers.js';
import { equal, quiet, reopened, snap } from './clock-anchored.helpers.js';

const START = ['~ time June 3, 1200, 11:00 pm', '~ place Harrow'];
const JUMP = ['! time +2 days', '~ time 6:30 am', '~ place Old Weir'];
const LATER = ['! time +1h', '~ place Bluewatch'];
const clock = host => host.sdk.query('director.time').text;
// Replies are told as user + reply pairs after the greeting: R<i> is at 2i + 2, its user message at 2i + 1.
async function deletePair(host, i) {
    await host.st.deleteMessage(2 * i + 2);
    await host.st.deleteMessage(2 * i + 1);
    await host.turn.onChatChanged();
}

test('W4 repro: deleting the 3-week skip before `! time +2 days` + `~ time 6:30 am` moves later time back 3 weeks', async t => {
    quiet(t);
    const live = await tell([START, ['! time +3 weeks'], JUMP, LATER]);
    assert.equal(clock(live), 'June 26, 1200, 07:30 am');
    const fresh = await tell([START, JUMP, LATER]);
    assert.equal(clock(fresh), 'June 5, 1200, 07:30 am');
    await deletePair(live, 1);
    assert.equal(clock(live), 'June 5, 1200, 07:30 am');
    // The head clock, the chronicle's day facts and "today so far" equal a fresh telling, and a rebuild equals live. (Not compared: the day
    // digests written before the delete, which any deleted multi-day jump leaves behind, faces or not: the notes follow-up limit.)
    assert.deepEqual(snap(live), snap(fresh), 'after the delete');
    assert.equal(reloadSame(live), true, 'a rebuild after the delete');
    await reopened(live, 'after the delete');
});

test('W4: deleting an earlier `! time +5h` keeps the face at 6:30 am on the landing day (not shifted by 5 hours)', async t => {
    quiet(t);
    const start = ['~ time June 3, 1200, 05:30 pm', '~ place Harrow'];
    const live = await tell([start, ['! time +5h'], JUMP, LATER]);
    assert.equal(clock(live), 'June 5, 1200, 07:30 am');
    await deletePair(live, 1);
    const fresh = await tell([start, JUMP, LATER]);
    assert.equal(clock(live), 'June 5, 1200, 07:30 am');
    equal(live, fresh, 'after the delete');
});

test('W4: an edited Re-read of the skip (grown by a day, shrunk to a day) moves the face with it', async t => {
    quiet(t);
    const live = await tell([START, ['! time +3 weeks'], JUMP, LATER]);
    for (const [name, lines] of [['grown', ['! time +3 weeks', '! time +1 day']], ['shrunk', ['! time +1 day']]]) {
        assert.equal((await editAndReread(live, 'R1', lines)).ok, true);
        const fresh = await tell([START, lines, JUMP, LATER]);
        equal(live, fresh, `Re-read ${name}`);
    }
    assert.equal(clock(live), 'June 6, 1200, 07:30 am');
});

test('W4: an edited Re-read of the face reply (face taken out, put back) and a swipe and back replay the same', async t => {
    quiet(t);
    const live = await tell([START, ['! time +3 weeks'], JUMP]);
    assert.equal(clock(live), 'June 26, 1200, 06:30 am');
    assert.equal((await editAndReread(live, 'R2', ['! time +2 days', '~ place Old Weir'])).ok, true);
    assert.equal(clock(live), 'June 26, 1200, 11:00 pm');
    assert.equal((await editAndReread(live, 'R2', JUMP)).ok, true);
    assert.equal(clock(live), 'June 26, 1200, 06:30 am');
    const fresh = await tell([START, ['! time +3 weeks'], JUMP]);
    equal(live, fresh, 'Re-read back');
    await live.swipe(said('R2.', ['! time +2 days', '~ time 7:00 am', '~ place Old Weir']));
    assert.equal(clock(live), 'June 26, 1200, 07:00 am');
    await live.st.swipeTo(live.ctx.chat.length - 1, 0);
    assert.equal(clock(live), 'June 26, 1200, 06:30 am');
    equal(live, fresh, 'swipe back');
    await deletePair(live, 1);
    assert.equal(clock(live), 'June 5, 1200, 06:30 am');
    assert.equal(snap(live).at, snap(await tell([START, JUMP])).at, 'delete after the swipe');
});

test('W4: the receipt says `day`, and a rewind to before the later reply equals a reload', async t => {
    quiet(t);
    const live = await tell([START, ['! time +3 weeks'], JUMP, LATER]);
    const face = live.store.receipts().filter(entry => entry.index === 6 && entry.receipt.type === 'capture.time').map(entry => entry.receipt.data.kind);
    assert.deepEqual(face, ['move', 'day']);
    await deletePair(live, 1);
    const later = live.store.receipts().find(entry => entry.index === 6 && entry.receipt.type === 'capture.time');
    assert.equal((await live.sdk.rewind({ index: later.index, beforeRev: later.receipt.rev })).ok, true);
    assert.equal(clock(live), 'June 5, 1200, 06:30 am');
    const now = JSON.stringify(live.head());
    live.store.rebuild();
    assert.equal(JSON.stringify(live.head()), now, 'a rebuild after the rewind');
});

test('W4 stated limit: the jump in one reply, the early face in the next, then the jump deleted: the face keeps its day offset (a fresh telling refuses it)', async t => {
    quiet(t);
    const live = await tell([START, ['! time +2 days', '~ place Old Weir'], ['~ time 6:30 am', '~ place Bluewatch']]);
    assert.equal(clock(live), 'June 5, 1200, 06:30 am');
    await deletePair(live, 1);
    const fresh = await tell([START, ['~ time 6:30 am', '~ place Bluewatch']]);
    assert.equal(clock(fresh), 'June 3, 1200, 11:00 pm', 'a fresh telling refuses the face (no jump opened the day)');
    assert.equal(clock(live), 'June 3, 1200, 06:30 am', 'known limit: pinned so a fix flips it on purpose');
    assert.equal(reloadSame(live), true);
});
