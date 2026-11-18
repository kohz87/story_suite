// Perf PB9 review (R1): the world's step state after an edit near a 10-day period boundary. The reworked PB9 stored only what each step
// changed, with a whole copy when a step reached a new period of 10 story days; deleting or shrinking the reply right after that crossing
// put the step back at the period's first day (its days stepped again by the next reply), and a later new key was skipped or refused the
// Re-read. Each step now writes its whole state again (L7 is not built), so every case below keeps the state the later replies recorded,
// with no Problems, and a rebuild and a fresh load agree.
// Ersveil, a fake model that answers BUSY, Begin, a 40-day skip, then 16 single days; each case starts from the same saved chat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { agrees, dailyOf, FEATURE, reply } from './daily-host.helpers.js';
import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';
import { fakeFightRunner } from '../../../suite/integration/director/helpers/fake-fight-runner.js';

const ERSVEIL = readFileSync(new URL('../../../../examples/packs/ersveil/pack.json', import.meta.url), 'utf8');
const ERSVEIL_GAME = readFileSync(new URL('../../../../examples/packs/ersveil-game/pack.json', import.meta.url), 'utf8');
const PERIOD = 10;

async function ersveil() {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), feature: id => host?.features.on(id),
        callModel: async () => ({ ok: false, error: 'BUSY', text: '' }), canCallModel: () => true, chat: () => [] } });
    host = await createHost({ modules: [fakeFightRunner(), module], settings: { modules: { 'story-director': { 'tracker.maxJump': 60 } } } });
    host.features.set(FEATURE, true);
    assert.equal((await host.packs.packs.install(ERSVEIL, { origin: 'pack.json' })).ok, true);
    assert.equal((await host.packs.packs.install(ERSVEIL_GAME, { origin: 'pack.json' })).ok, true);
    return host;
}

// Begin, a 40-day skip, then 16 single days; the crossings `{ index, day, was }` in order.
async function build(host) {
    const crossings = [];
    const say = async (text, line) => {
        const was = dailyOf(host)?.day ?? null;
        await host.send(text, reply(text, [line]));
        const day = dailyOf(host)?.day ?? null;
        if (day !== was) crossings.push({ index: host.ctx.chat.length - 1, day, was });
    };
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await say('Skip.', '! time +40d');
    for (let i = 0; i < 16; i += 1) await say(`D${i}.`, '! time +1d');
    return crossings;
}

// The last crossing into a new period with at least three crossings after it (C), and the two after it (C+1, C+2).
function around(crossings) {
    const at = crossings.map((entry, position) => ({ entry, position }))
        .filter(({ entry }) => entry.was !== null && Math.floor(entry.day / PERIOD) !== Math.floor(entry.was / PERIOD))
        .map(({ position }) => position).reverse().find(position => position + 3 < crossings.length);
    assert.notEqual(at, undefined, 'a period crossing with three crossings after it');
    return { C: crossings[at].index, 'C+1': crossings[at + 1].index, 'C+2': crossings[at + 2].index };
}

const CASES = [
    ['delete', 'C+1', host => at => host.st.deleteMessage(at)],
    ['shrunk Re-read', 'C+1', host => async at => { await host.st.editMessage(at, reply('D.', ['! time +1h'])); assert.equal((await host.sdk.reread(at)).ok, true, 'the Re-read goes through'); }],
    ['grown Re-read', 'C+1', host => async at => { await host.st.editMessage(at, reply('D.', ['! time +3d'])); assert.equal((await host.sdk.reread(at)).ok, true, 'the Re-read goes through'); }],
    ['delete', 'C', host => at => host.st.deleteMessage(at)],
    ['shrunk Re-read', 'C', host => async at => { await host.st.editMessage(at, reply('D.', ['! time +1h'])); assert.equal((await host.sdk.reread(at)).ok, true, 'the Re-read goes through'); }],
    ['delete', 'C+2', host => at => host.st.deleteMessage(at)],
];

test('R1: a delete or an edited Re-read of the reply at or after a period crossing keeps the recorded step state and every block', async () => {
    const host = await ersveil();
    try {
        const targets = around(await build(host));
        const saved = structuredClone(host.ctx.chat);
        const recorded = JSON.stringify(dailyOf(host));
        await agrees(host, 'live');
        let chat = 0;
        for (const [how, where, act] of CASES) {
            const label = `${how} of ${where} (message ${targets[where]})`;
            await act(host)(targets[where]);
            assert.deepEqual(host.store.problems().map(problem => `${problem.index}: ${problem.message ?? problem.code}`), [], `${label}: no block is skipped`);
            assert.equal(JSON.stringify(dailyOf(host)), recorded, `${label}: the step state is the one the later replies recorded`);
            await agrees(host, label);
            // Back to the saved chat through a chat change: the recorded state comes back.
            await host.st.loadChat([], `other-${chat}`);
            await host.st.loadChat(structuredClone(saved), `pb9-${chat += 1}`);
            assert.equal(JSON.stringify(dailyOf(host)), recorded, `${label}: the saved chat reloads to the recorded state`);
        }
        // Played on after the last case: one more day steps once.
        const day = dailyOf(host).day;
        await host.send('On.', reply('On.', ['! time +1d']));
        assert.equal(dailyOf(host).day, day + 1);
        await agrees(host, 'played on');
    } finally { host.close(); }
});
