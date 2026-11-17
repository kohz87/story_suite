// Replay == live for open templates: a swipe and back, a swipe, edited Re-reads (grown, shrunk), a middle delete, a chat change, a reload and a
// rewind over a reply that crossed a day with an answered slot. The stored answer is reused every time: the fake model's call count never moves.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { openAsker } from '../../../../modules/world/chronicle/world-daily/open-ask.js';
import { agrees, chronicle, dailyOf, ledgerOpen, open, openHost, reply, settle, slotRows, WORLD, worldOf, fakeModel } from './open-host.helpers.js';

const said = (text, line) => reply(text, [line]);
const world = { ...WORLD, templates: [open('border-incident'), open('night-watch', { needs: ['unrest@place'] })] };

async function build(model) {
    const host = await openHost(model, world);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    for (const text of ['One.', 'Two.', 'Three.', 'Four.']) { await host.send(text, said(text, '! time +1h')); await settle(); }
    await host.send('Next day.', said('Dawn.', '! time +1d'));
    return host;
}

test('replay == live: swipe and back, edited Re-reads, middle delete, chat change, reload, rewind; never a second call', async () => {
    const host = await build();
    try {
        const crossing = host.ctx.chat.length - 1;
        assert.equal(slotRows(host).find(row => row.template === 'night-watch')?.outcome, 'ok', 'the crossing reply applied its stored slot');
        const calls = host.model.calls;
        const before = worldOf(host);
        await agrees(host, 'live');
        await host.swipe(said('Dawn, grey.', '! time +1d'));
        assert.equal(worldOf(host), before, 'a swipe: the same world, the stored answer reused');
        await host.st.swipeTo(crossing, 0);
        assert.equal(worldOf(host), before, 'swipe back');
        await agrees(host, 'swipe back');
        await host.send('Noon.', said('Noon.', '! time +2h'));
        const later = worldOf(host);
        await host.st.editMessage(crossing, said('Dawn.', '! time +1h'));
        assert.equal((await host.sdk.reread(crossing)).ok, true);
        await agrees(host, 'shrunk Re-read');
        await host.st.editMessage(crossing, said('Dawn.', '! time +3d'));
        assert.equal((await host.sdk.reread(crossing)).ok, true);
        await agrees(host, 'grown Re-read');
        await host.st.editMessage(crossing, said('Dawn.', '! time +1d'));
        assert.equal((await host.sdk.reread(crossing)).ok, true);
        assert.equal(worldOf(host), later, 'edited back: as it was');
        await host.st.deleteMessage(crossing);
        assert.deepEqual(host.store.problems(), []);
        await agrees(host, 'middle delete');
        assert.equal(host.model.calls, calls, 'no second call through all of it');
        const chat = structuredClone(host.ctx.chat);
        await host.st.loadChat([{ name: 'Other', is_user: false, mes: 'Elsewhere.' }]);
        assert.equal(chronicle(host).daily, undefined, 'another chat: no open results');
        await host.st.loadChat(chat);
        await agrees(host, 'chat change and back');
        assert.equal(host.model.calls, calls, 'no call for the chat change');
        assert.ok(ledgerOpen(host).results, 'the stored answers came back with the chat');
        // A rewind to the start and the same day crossed again: reused from the answers kept in memory this session.
        while (host.ctx.chat.length > 2) await host.st.deleteMessage(host.ctx.chat.length - 1);
        // The rewound chat has no clock (since 0.1.0 a date-less line would start it at the calendar's default, a day of no stored answer): the same date first.
        await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
        for (const text of ['One.', 'Two.', 'Three.', 'Four.']) { await host.send(text, said(text, '! time +1h')); await settle(); }
        await host.send('Next day.', said('Dawn.', '! time +1d'));
        await settle();
        assert.equal(slotRows(host).find(row => row.template === 'night-watch')?.outcome, 'ok', 'the day was crossed again, so the reuse is real');
        assert.equal(host.model.calls, calls, 'rewind and cross again: the answers are reused, not asked again');
        await agrees(host, 'rewound and crossed again');
    } finally { host.done(); }
});

test('a reload (a fresh host loading the chat) applies the stored result and asks nothing', async () => {
    const host = await build();
    const chat = structuredClone(host.ctx.chat);
    const live = worldOf(host);
    host.done();
    const model = fakeModel();
    const again = await openHost(model, world);
    try {
        await again.st.loadChat(chat);
        assert.equal(worldOf(again), live, 'the same world after the reload');
        await settle();
        assert.equal(model.calls, 0, 'a reload asks no one');
        await again.send('Noon.', said('Noon.', '! time +2h'));
        await settle();
        assert.equal(model.calls, 0, 'nor does the next reply (the slots are stored)');
        assert.equal(dailyOf(again).slots !== undefined, true);
    } finally { again.done(); }
    openAsker.clear();
});
