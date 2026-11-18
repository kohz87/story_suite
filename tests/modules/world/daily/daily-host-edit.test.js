// An edited Re-read (seam audit E21, spec §9 "Replay and edits"): Re-read re-captures that reply and runs its step again; when the
// step no longer fires what it fired before and later replies exist, the reply's card and Problems say so; the later replies keep
// what they changed (history is not rewritten), and their whole recorded state from the next checkpoint on (perf PB9, pb9-replay.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { agrees, dailyOf, dailyReceipts, newHost, reply, SPEC } from './daily-host.helpers.js';

const at = (id, after, extra = {}) => ({ id, kind: 'one-off', certainty: 'set-in-motion', severity: 'minor', where: ['Highmark'], window: { after, within: '1 day' }, ends_when: 'instant', summary: `${id}.`, ...extra });
// The feast fires on day 2 (the reply that crosses into it); the riot needs it and fires two days later (a later reply).
const EDIT = { ...SPEC, events: [at('feast', 'start + 1 day'), at('riot', 'fired:feast + 2 days', { requires: ['fired:feast'] })] };
const lostOn = (host, index) => host.turn.problems().filter(item => item.index === index && /no longer fired/.test(item.message));

async function play(host) {
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Day.', reply('Dawn.', ['! time +1d']));
    const crossing = host.ctx.chat.length - 1;
    await host.send('Later.', reply('Days pass.', ['! time +3d']));
    return crossing;
}

test('E21: a shrunk edited Re-read that drops the feast warns on that reply; the later riot keeps its record; replay == live', async () => {
    const host = await newHost(true, EDIT);
    const crossing = await play(host);
    assert.deepEqual(dailyReceipts(host).find(entry => entry.index === crossing).receipt.data.fired, ['feast']);
    assert.equal(dailyOf(host).events.riot.state, 'ended', 'the riot fired (and ended) on a later reply');
    const later = JSON.stringify(dailyOf(host));
    await host.st.editMessage(crossing, reply('Dawn.', ['! time +1h']));
    assert.equal((await host.sdk.reread(crossing)).ok, true);
    assert.equal(lostOn(host, crossing).length, 1, 'Problems: the feast no longer fired on this reply');
    assert.match(dailyReceipts(host).find(entry => entry.index === crossing).receipt.summary, /feast no longer fired/, 'and its card');
    // Between checkpoints the later reply's step applies what it changed on the state the edit left: the riot keeps its record and the
    // stepped day; the feast the edit dropped stays dropped until the next checkpoint writes the whole recorded state.
    const now = dailyOf(host), was = JSON.parse(later);
    assert.deepEqual([now.day, now.events.riot.state, now.events.riot.fired], [was.day, 'ended', was.events.riot.fired], 'the later reply keeps what it changed');
    assert.equal(now.events.feast.state, 'dormant', 'the feast the edit dropped is not fired again by the later reply');
    await agrees(host, 'shrunk Re-read');
    await host.st.editMessage(crossing, reply('Dawn, still.', ['! time +2h']));
    assert.equal((await host.sdk.reread(crossing)).ok, true);
    assert.match(dailyReceipts(host).find(entry => entry.index === crossing).receipt.summary, /feast no longer fired/, 'a second Re-read still warns');
    await agrees(host, 'second shrunk Re-read');
    await host.st.editMessage(crossing, reply('Dawn.', ['! time +1d']));
    assert.equal((await host.sdk.reread(crossing)).ok, true);
    const back = dailyReceipts(host).find(entry => entry.index === crossing).receipt;
    assert.deepEqual(back.data.fired, ['feast']);
    assert.doesNotMatch(back.summary, /no longer fired/, 'edited back: the feast fires there again, no warning on its card');
    await agrees(host, 'edited back');
    host.done();
});

test('E21: a grown edited Re-read that still fires the feast, a prose-only edit, and a Re-read of the last reply give no warning', async () => {
    const host = await newHost(true, EDIT);
    const crossing = await play(host);
    await host.st.editMessage(crossing, reply('Dawn, two days.', ['! time +1d', '! time +1h']));
    assert.equal((await host.sdk.reread(crossing)).ok, true);
    await host.st.editMessage(crossing, reply('A grey dawn.', ['! time +1d']));
    assert.equal((await host.sdk.reread(crossing)).ok, true);
    assert.equal(lostOn(host, crossing).length, 0);
    assert.doesNotMatch(dailyReceipts(host).find(entry => entry.index === crossing).receipt.summary, /no longer fired/);
    const last = host.ctx.chat.length - 1;
    await host.st.editMessage(last, reply('Days pass slowly.', ['! time +1h']));
    assert.equal((await host.sdk.reread(last)).ok, true);
    assert.deepEqual(host.turn.problems().filter(item => /no longer fired/.test(item.message)), [], 'nothing after the last reply to warn about');
    await agrees(host, 'no warnings');
    host.done();
});
