// LAB2-2 (spec §5 "A long skip makes at most one batched call"): the open slots a reply's skip rolls inside its days wait from the
// skip's last day, are asked in ONE batched call after the reply (in the background), wait one reply, and are applied from the stored
// answers; replay reuses them (swipe and back, edited Re-reads grown and shrunk, a middle delete, a chat change, a reload, a rewind).
// Before the fix each slot ran out three days after its own day inside the skip, so the Director was never asked.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { agrees, chronicle, dailyOf, fakeModel, ledgerOpen, open, openHost, reply, settle, slotRows, WORLD, worldOf } from './open-host.helpers.js';

const said = (text, line) => reply(text, [line]);
// Three towns and two templates that may each roll once per place per week: a two-week skip rolls several slots on several days.
const world = {
    ...WORLD,
    places: [...WORLD.places, { name: 'Stonegate', region: 'The March', x: 9, y: 9, kind: 'town' }],
    templates: [open('border-incident', { per: 'place per 7 days' }), open('night-watch', { per: 'place per 7 days' })],
};
const slotsOf = prompt => [...String(prompt).matchAll(/^Slot (\S+)$/gm)].map(match => match[1]);

// Begin, let the first day's slots settle (asked and stored over two short replies), then the skip.
async function build(model) {
    const host = await openHost(model, world);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    for (const text of ['One.', 'Two.']) { await host.send(text, said(text, '! time +1h')); await settle(); }
    const before = { calls: host.model.calls, day: dailyOf(host).day, rows: slotRows(host).length };
    await host.send('Skip.', said('Two weeks on the road.', '! time +14d'));
    await settle();
    return { host, before, skip: host.ctx.chat.length - 1 };
}

test('LAB2-2: a skip\'s open slots wait from its last day and are asked in one batched call; the next reply stores them, the one after applies them', async () => {
    const { host, before } = await build();
    try {
        const rolled = slotRows(host).slice(before.rows).filter(row => row.day > before.day && row.day <= dailyOf(host).day);
        const days = new Set(rolled.map(row => row.day));
        assert.ok(rolled.length >= 2 && days.size >= 2, `the skip rolled slots on several days (${JSON.stringify(rolled.map(row => [row.day, row.template]))})`);
        assert.ok(rolled.every(row => row.outcome === 'waiting'), 'none ran out inside the skip that rolled it');
        assert.ok(dailyOf(host).pending.every(slot => slot.wait === dailyOf(host).day), 'each waits from the skip\'s last day');
        assert.equal(host.model.calls, before.calls + 1, 'one call for the skip');
        const asked = slotsOf(host.model.prompts.at(-1));
        assert.equal(asked.length, Math.min(4, rolled.length), 'that one call carries the skip\'s slots (at most four)');
        assert.ok(new Set(asked.map(key => key.split('|')[1])).size >= 2, 'slots of several days in the one call');
        assert.equal(host.model.requests.at(-1).role, 'quick');
        await host.send('Arrive.', said('The gate.', '! time +1h'));
        await settle();
        assert.ok(asked.every(key => key in ledgerOpen(host).results), 'the answers are stored in the message before the next reply');
        await host.send('Settle.', said('A bunk.', '! time +1h'));
        await settle();
        assert.ok(asked.every(key => dailyOf(host).slots[key].outcome === 'ok'), JSON.stringify(asked.map(key => dailyOf(host).slots[key])));
        assert.ok(chronicle(host).conditions['unrest@Highmark'] || chronicle(host).conditions['unrest@Stonegate'], 'the answers\' condition is set');
        assert.equal(host.model.calls, before.calls + 1, 'stored once: no further call for them');
        await agrees(host, 'applied');
    } finally { host.done(); }
});

test('LAB2-2: a busy model after a skip is no answer: the skip\'s slots keep waiting (no fallback at once) and are answered later', async () => {
    const model = fakeModel();
    const host = await openHost(model, world);
    try {
        await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
        for (const text of ['One.', 'Two.']) { await host.send(text, said(text, '! time +1h')); await settle(); }
        const day = dailyOf(host).day;
        model.mode = 'busy';
        await host.send('Skip.', said('Two weeks on the road.', '! time +14d'));
        await settle();
        await host.send('Arrive.', said('The gate.', '! time +1h'));
        await settle();
        const waiting = (dailyOf(host).pending ?? []).filter(slot => slot.day > day);
        assert.ok(waiting.length >= 2, 'the skip\'s slots still wait after a busy call');
        assert.ok(slotRows(host).every(row => row.outcome !== 'fallback' || row.day <= day), 'none of the skip\'s slots fell back');
        model.mode = 'good';
        for (const text of ['Later.', 'Later still.', 'Later again.']) { await host.send(text, said(text, '! time +1h')); await settle(); }
        assert.ok(waiting.every(slot => dailyOf(host).slots[slot.key].outcome === 'ok'), 'answered once the model is free');
    } finally { host.done(); }
});

test('LAB2-2 replay == live over the skip: swipe and back, edited Re-reads (grown, shrunk), middle delete, chat change, reload, rewind; never asked again', async () => {
    const { host, skip } = await build();
    try {
        const calls = host.model.calls;
        await agrees(host, 'live');
        await host.swipe(said('Two weeks, more rain.', '! time +14d'));
        await settle();
        await agrees(host, 'swipe');
        await host.st.swipeTo(skip, 0);
        await agrees(host, 'swipe back');
        for (const text of ['Arrive.', 'Settle.']) { await host.send(text, said(text, '! time +1h')); await settle(); }
        const live = worldOf(host);
        await host.st.editMessage(skip, said('Three weeks on the road.', '! time +21d'));
        assert.equal((await host.sdk.reread(skip)).ok, true);
        await agrees(host, 'grown Re-read');
        await host.st.editMessage(skip, said('An hour on the road.', '! time +1h'));
        assert.equal((await host.sdk.reread(skip)).ok, true);
        await agrees(host, 'shrunk Re-read');
        await host.st.editMessage(skip, said('Two weeks on the road.', '! time +14d'));
        assert.equal((await host.sdk.reread(skip)).ok, true);
        await agrees(host, 'edited back');
        assert.equal(worldOf(host), live, 'edited back: as it was');
        await host.st.deleteMessage(skip + 1);
        await agrees(host, 'middle delete');
        const chat = structuredClone(host.ctx.chat);
        await host.st.loadChat([{ name: 'Other', is_user: false, mes: 'Elsewhere.' }]);
        assert.equal(chronicle(host).daily, undefined, 'another chat: none of it');
        await host.st.loadChat(chat);
        await agrees(host, 'chat change and back');
        while (host.ctx.chat.length > skip) await host.st.deleteMessage(host.ctx.chat.length - 1);
        await agrees(host, 'rewind to before the skip');
        await host.send('Skip.', said('Two weeks on the road.', '! time +14d'));
        await settle();
        await agrees(host, 'the skip again');
        assert.equal(host.model.calls, calls, 'the stored answers are reused, never asked again');
        const reload = fakeModel();
        const again = await openHost(reload, world);
        try {
            await again.st.loadChat(structuredClone(host.ctx.chat));
            assert.equal(worldOf(again), worldOf(host), 'a reload gives the same world');
            await settle();
            assert.equal(reload.calls, 0, 'a reload asks no one');
        } finally { again.close(); }
    } finally { host.done(); }
});
