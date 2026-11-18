// Perf PB9, measured on the host: a long skip steps each world day once (L1: the look-ahead for open templates no longer dry-runs the skip's
// days before the step runs them). L7 (a day-crossing reply storing only what its step changed) is not built: each step still writes its whole
// state, as on next; the chat growth per crossing is printed for comparison.
// The numbers are printed (node --test shows them); the asserts hold the shape, not the machine's speed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';
import { fakeFightRunner } from '../../../suite/integration/director/helpers/fake-fight-runner.js';
import { stepTally } from '../../../../modules/world/daily/step.js';
import { slotValue } from '../../../../modules/rpg/slot.js';
import { FEATURE, newHost, reply } from './daily-host.helpers.js';
import { WORLD } from '../open/open-host.helpers.js';

const said = (text, line) => reply(text, [line]);
const tick = async () => { for (let i = 0; i < 6; i += 1) await new Promise(resolve => setTimeout(resolve, 0)); };
const dayOf = host => slotValue(host.head().domains.chronicle.daily)?.day ?? null;
const recordSize = (host, index) => JSON.stringify(host.ctx.chat[index].extra.storySuite).length;
const ERSVEIL = readFileSync(new URL('../../../../examples/packs/ersveil-world/pack.json', import.meta.url), 'utf8');

test('L1: a one-year skip in a world with open templates steps each world day once (the look-ahead runs one day, after the step)', async () => {
    const host = await newHost(true, WORLD, { modules: { 'story-director': { 'tracker.maxJump': 365 } } });
    try {
        await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
        await host.send('One.', said('One.', '! time +1h'));
        await tick();
        const from = dayOf(host), before = stepTally.days, started = performance.now();
        await host.send('Skip.', said('A year on the road.', '! time +365d'));
        await tick();
        const stepped = dayOf(host) - from, runs = stepTally.days - before;
        console.log(`PB9 L1: ${stepped} world days stepped, ${runs} world-day runs, ${Math.round(performance.now() - started)} ms`);
        assert.equal(stepped, 365);
        assert.ok(runs <= stepped + 2, `each day once, plus at most two one-day look-aheads (was 2 × the skip): ${runs} runs`);
    } finally { host.done(); }
});

// The real Ersveil world (103 events, 31 people, 15 powers, 10 templates): its step state is about 7 KB.
async function ersveil() {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), feature: id => host?.features.on(id),
        callModel: async () => ({ ok: false, error: 'BUSY', text: '' }), canCallModel: () => true, chat: () => [] } });
    host = await createHost({ modules: [fakeFightRunner(), module], settings: { modules: { 'story-director': { 'tracker.maxJump': 60 } } } });
    host.features.set(FEATURE, true);
    const installed = await host.packs.packs.install(ERSVEIL, { origin: 'pack.json' });
    assert.equal(installed.ok, true);
    return host;
}

test('chat growth: 30 day-crossing replies on Ersveil each store the whole step state (L7 not built)', async () => {
    const host = await ersveil();
    try {
        await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
        await host.send('One.', said('One.', '! time +1h'));
        await tick();
        const start = JSON.stringify(host.ctx.chat).length;
        const crossings = [];
        for (let i = 0; i < 30; i += 1) {
            await host.send(`Day ${i}.`, said(`Day ${i}.`, '! time +1d'));
            await tick();
            crossings.push(recordSize(host, host.ctx.chat.length - 1));
        }
        const grown = JSON.stringify(host.ctx.chat).length - start;
        // The smallest of three replies that cross no day: one of them now and then carries something else of about 27 KB (seen on next too).
        const hours = [];
        for (let i = 0; i < 3; i += 1) {
            await host.send(`Hour ${i}.`, said(`Hour ${i}.`, '! time +1h'));
            await tick();
            hours.push(recordSize(host, host.ctx.chat.length - 1));
        }
        const plain = Math.min(...hours);
        const state = JSON.stringify(slotValue(host.head().domains.chronicle.daily)).length;
        const average = crossings.reduce((sum, size) => sum + size, 0) / crossings.length;
        const smallest = Math.min(...crossings);
        console.log(`PB9 growth: chat +${Math.round(grown / 30)} B per day-crossing reply; record ${Math.round(average)} B on average (smallest ${smallest} B), a reply that crosses no day ${plain} B; the step state ${state} B`);
        assert.ok(smallest - plain > state / 2, `each crossing stores the whole state (${smallest - plain} B over a plain reply; the state is ${state} B)`);
    } finally { host.close(); }
});
