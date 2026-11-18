// Generated arcs on the host: the Director's plan is asked once (one batched call, the arc wording only for an arc slot), stored whole in the
// ledger (an oversized plan too), and replay == live through a swipe and back, edited Re-reads (grown, shrunk), a middle delete, a chat change,
// a reload and a rewind; the arc's steps and ending come from the stored plan, never a second call.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { agrees, dailyOf, fakeModel, ledgerOpen, open, openHost, reply, settle, WORLD, worldOf } from './open-host.helpers.js';

const said = (text, line) => reply(text, [line]);
const filler = 'x'.repeat(280);
const step = (name, extra = {}) => ({ name, summary: `${name}. ${filler}`, people: ['warden'], effects: { set: [{ condition: 'unrest', for: '3 days' }] }, after: 1, within: 1, ...extra });
const ARC = { steps: [step('Rumours'), step('Riot')], ending: { ...step('Calm'), effects: { fact: 'incident-noted' } } };
const world = { ...WORLD, templates: [open('border-incident'), open('night-watch', { needs: ['unrest@place'], arc: { steps: [2, 4] } })] };

async function build(model) {
    const host = await openHost(model, world);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    for (const line of ['One.', 'Two.', 'Three.', 'Four.']) { await host.send(line, said(line, '! time +1h')); await settle(); }
    await host.send('Next day.', said('Dawn.', '! time +1d'));
    return host;
}
const arcOf = host => Object.values(dailyOf(host)?.arcs ?? {})[0];
const days = async (host, count) => { for (let i = 0; i < count; i += 1) { await host.send('Later.', said('Later.', '! time +1d')); await settle(); } };

test('the plan is asked once with the arc wording, stored whole, and run by code; replay == live', async () => {
    const model = fakeModel();
    model.extra = { arc: ARC };
    const host = await build(model);
    try {
        assert.ok(model.prompts.some(prompt => /Arc allowed: 2 to 4 happenings in all/.test(prompt)), 'the slot says an arc is allowed');
        assert.ok(model.requests.some(request => /Write the whole arc/.test(request.system)));
        assert.equal(model.requests.find(request => /Arc allowed/.test(request.prompt)).maxTokens, 2400);
        const stored = Object.values(ledgerOpen(host).results).find(row => /Riot/.test(row.answer));
        assert.ok(stored, 'the whole plan is stored');
        assert.doesNotThrow(() => JSON.parse(stored.answer), 'an oversized plan is not cut mid-JSON');
        assert.equal(arcOf(host).state, 'running');
        const calls = model.calls;
        await days(host, 5);
        assert.equal(arcOf(host).state, 'ended', 'the steps and the ending were run by code');
        assert.equal(model.calls, calls, 'no call per step');
        assert.ok(dailyOf(host).facts['incident-noted']);
        const after = worldOf(host);
        await agrees(host, 'live');
        const arcDay = host.ctx.chat.length - 5;
        await host.swipe(said('Later, grey.', '! time +1d'));
        await host.st.swipeTo(host.ctx.chat.length - 1, 0);
        assert.equal(worldOf(host), after, 'swipe and back');
        await host.st.editMessage(arcDay, said('Later.', '! time +1h'));
        assert.equal((await host.sdk.reread(arcDay)).ok, true);
        await agrees(host, 'shrunk Re-read');
        await host.st.editMessage(arcDay, said('Later.', '! time +3d'));
        assert.equal((await host.sdk.reread(arcDay)).ok, true);
        await agrees(host, 'grown Re-read');
        await host.st.editMessage(arcDay, said('Later.', '! time +1d'));
        assert.equal((await host.sdk.reread(arcDay)).ok, true);
        assert.equal(worldOf(host), after, 'edited back: as it was');
        await host.st.deleteMessage(arcDay);
        assert.deepEqual(host.store.problems(), []);
        await agrees(host, 'middle delete');
        const chat = structuredClone(host.ctx.chat);
        await host.st.loadChat([{ name: 'Other', is_user: false, mes: 'Elsewhere.' }]);
        assert.equal(dailyOf(host), null);
        await host.st.loadChat(chat);
        await agrees(host, 'chat change and back');
        assert.equal(model.calls, calls, 'the plan was never asked again');
        while (host.ctx.chat.length > 2) await host.st.deleteMessage(host.ctx.chat.length - 1);
        await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
        for (const line of ['One.', 'Two.', 'Three.', 'Four.']) { await host.send(line, said(line, '! time +1h')); await settle(); }
        await host.send('Next day.', said('Dawn.', '! time +1d'));
        await settle();
        assert.equal(arcOf(host)?.state, 'running', 'a rewind and the same day crossed again starts the same arc from the stored plan');
        assert.equal(model.calls, calls, 'rewind: reused');
        await agrees(host, 'rewound');
    } finally { host.done(); }
});

test('a reload applies the stored plan and the arc runs on with no call', async () => {
    const model = fakeModel();
    model.extra = { arc: ARC };
    const host = await build(model);
    const chat = structuredClone(host.ctx.chat);
    const live = worldOf(host);
    host.done();
    const quiet = fakeModel();
    const again = await openHost(quiet, world);
    try {
        await again.st.loadChat(chat);
        assert.equal(worldOf(again), live);
        await days(again, 5);
        assert.equal(arcOf(again).state, 'ended');
        assert.equal(quiet.calls, 0, 'the reload asked no one');
    } finally { again.done(); }
});

test('a world with no arc template sends the plain prompt and system text (no arc wording)', async () => {
    const plain = fakeModel();
    const host = await openHost(plain, { ...WORLD, templates: [open('border-incident')] });
    try {
        await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
        for (const line of ['One.', 'Two.', 'Three.', 'Four.']) { await host.send(line, said(line, '! time +1h')); await settle(); }
        await host.send('Next day.', said('Dawn.', '! time +1d'));
        await settle();
        assert.ok(plain.requests.length > 0);
        for (const request of plain.requests) {
            assert.equal(/Arc allowed|whole arc/.test(request.prompt + request.system), false);
            assert.equal(request.maxTokens, 1200);
        }
    } finally { host.done(); }
});
