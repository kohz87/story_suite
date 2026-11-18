// Perf PB9: the daily step's state is written as what each step changed, and whole at a checkpoint (a step that reaches a new period of
// CHECKPOINT_DAYS). A chat with a long skip and several day-crossing replies rebuilds to the same state as live after a swipe, edited Re-reads
// (grown and shrunk), a middle delete, a rewind and a reload; and from the first checkpoint after an edited or deleted reply, the later replies'
// recorded world is back exactly.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CHECKPOINT_DAYS } from '../../../../modules/world/chronicle/world-daily/command.js';
import { agrees, chronicle, dailyOf, dailyReceipts, newHost, reply, SPEC } from './daily-host.helpers.js';

const step = (host, text, line) => host.send(text, reply(text, [line]));
const state = host => JSON.stringify(dailyOf(host));
const stored = host => chronicle(host).daily;

// Begin, two single days, a 40-day skip (past at least one checkpoint), then single days on past the next one.
async function build() {
    const host = await newHost(true, SPEC);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await step(host, 'Day.', '! time +1d');
    const early = host.ctx.chat.length - 1;
    await step(host, 'Day two.', '! time +1d');
    const middle = host.ctx.chat.length - 1;
    await step(host, 'The road.', '! time +40d');
    for (let i = 0; i < CHECKPOINT_DAYS + 1; i += 1) await step(host, `On ${i}.`, '! time +1d');
    return { host, early, middle };
}

test('PB9: the step stores what changed between checkpoints, and the whole state at one', async () => {
    const { host } = await build();
    try {
        const crossings = dailyReceipts(host).map(entry => entry.index);
        const ops = index => host.ctx.chat[index].extra.storySuite.ops.filter(op => String(op.path).startsWith('/domains/chronicle/daily'));
        const whole = crossings.filter(index => ops(index).some(op => op.path === '/domains/chronicle/daily'));
        const parts = crossings.filter(index => ops(index).length && ops(index).every(op => op.path.startsWith('/domains/chronicle/daily/')));
        assert.ok(whole.length >= 3, `the first step, the checkpoints and the write after each are whole (${whole.length})`);
        assert.ok(parts.length >= CHECKPOINT_DAYS - 2, `the rest store only what changed (${parts.length})`);
        assert.ok(parts.every(index => ops(index).every(op => op.within)), 'each change inside the state is marked, so a replay after a deleted reply passes it over');
        await agrees(host, 'live');
    } finally { host.done(); }
});

test('PB9: swipe, edited Re-reads, a middle delete, a rewind and a reload agree with live, and the recorded world is back from the next checkpoint', async () => {
    const { host, early, middle } = await build();
    try {
        await agrees(host, 'live');
        const recorded = state(host);
        // A swipe of the last reply with the same line steps the same day the same way; back again keeps it.
        await host.swipe(reply('On, again.', ['! time +1d']));
        assert.equal(state(host), recorded, 'a swipe of the last crossing: the same step');
        await agrees(host, 'swiped');
        await host.swipe(reply(`On ${CHECKPOINT_DAYS}.`, ['! time +1d']));
        await agrees(host, 'swiped back');
        // An edited Re-read of an early crossing, grown then shrunk: replay == live, and the later checkpoint puts the recorded world back.
        await host.st.editMessage(early, reply('Day.', ['! time +3d']));
        assert.equal((await host.sdk.reread(early)).ok, true);
        await agrees(host, 'grown Re-read');
        assert.equal(state(host), recorded, 'grown Re-read: the later replies\' world is back from the checkpoint on');
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
        assert.ok(Array.isArray(stored(host)) || (stored(host) && typeof stored(host) === 'object'), 'the state is there, in either form');
    } finally { host.done(); }
});
