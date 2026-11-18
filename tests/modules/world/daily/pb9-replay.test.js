// Perf PB9 (L1 only; L7, writing what each step changed, is not built): a chat with a long skip and several day-crossing replies keeps the
// state the later replies recorded, and rebuilds to the same state as live, after a swipe, a swipe back, edited Re-reads (grown and shrunk), a
// middle delete, a rewind and a reload. Each step writes its whole state (a slot), so the recorded world is back at once after any edit.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { agrees, chronicle, dailyOf, newHost, reply, SPEC } from './daily-host.helpers.js';

const step = (host, text, line) => host.send(text, reply(text, [line]));
const state = host => JSON.stringify(dailyOf(host));
const stored = host => chronicle(host).daily;
const SINGLE_DAYS = 11;

// Begin, two single days, a 40-day skip, then eleven single days.
async function build() {
    const host = await newHost(true, SPEC);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await step(host, 'Day.', '! time +1d');
    const early = host.ctx.chat.length - 1;
    await step(host, 'Day two.', '! time +1d');
    const middle = host.ctx.chat.length - 1;
    await step(host, 'The road.', '! time +40d');
    for (let i = 0; i < SINGLE_DAYS; i += 1) await step(host, `On ${i}.`, '! time +1d');
    return { host, early, middle };
}

test('PB9: swipe, swipe back, edited Re-reads, a middle delete, a rewind and a reload keep the recorded world and agree with live', async () => {
    const { host, early, middle } = await build();
    try {
        await agrees(host, 'live');
        const recorded = state(host);
        // A swipe of the last reply with the same line steps the same day the same way; back again keeps it.
        await host.swipe(reply('On, again.', ['! time +1d']));
        assert.equal(state(host), recorded, 'a swipe of the last crossing: the same step');
        await agrees(host, 'swiped');
        await host.swipe(reply(`On ${SINGLE_DAYS}.`, ['! time +1d']));
        await agrees(host, 'swiped again');
        // A swipe back to the first swipe (the reader's own arrow, not a new reply): its recorded step comes back.
        await host.st.swipeTo(host.ctx.chat.length - 1, 0);
        assert.equal(state(host), recorded, 'swiped back to the first swipe: its step');
        await agrees(host, 'swiped back');
        // An edited Re-read of an early crossing, grown then shrunk: replay == live, and the later replies' recorded world stays.
        await host.st.editMessage(early, reply('Day.', ['! time +3d']));
        assert.equal((await host.sdk.reread(early)).ok, true);
        await agrees(host, 'grown Re-read');
        assert.equal(state(host), recorded, 'grown Re-read: the later replies\' recorded world');
        await host.st.editMessage(early, reply('Day.', ['! time +1h']));
        assert.equal((await host.sdk.reread(early)).ok, true);
        await agrees(host, 'shrunk Re-read');
        assert.equal(state(host), recorded, 'shrunk Re-read: the same');
        // A middle delete of a crossing before the skip.
        await host.st.deleteMessage(middle);
        await agrees(host, 'middle delete');
        assert.equal(state(host), recorded, 'middle delete: the same');
        // A rewind past the last two crossings, then playing on.
        const last = host.ctx.chat.length - 1;
        await host.st.deleteMessage(last);
        await host.st.deleteMessage(last - 1);
        await agrees(host, 'rewind');
        await step(host, 'Again.', '! time +1d');
        await agrees(host, 'played on after the rewind');
        assert.ok(Array.isArray(stored(host)) && stored(host).length === 1, 'the state is a slot, written whole by each step');
    } finally { host.done(); }
});
