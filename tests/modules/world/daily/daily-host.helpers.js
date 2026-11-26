// Host helpers for the world daily step: a Director host with a pack (places + conditions, which real packs can carry), the spec's
// kinds handed in through the test-only world override, and the replay checks (rebuild, fresh load).
import assert from 'node:assert/strict';

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';
import { overrideWorld } from '../../../../modules/world/chronicle/world-daily/read-world.js';
import { fakeFightRunner } from '../../../suite/integration/director/helpers/fake-fight-runner.js';

export const FEATURE = 'story-director.world-events';
export const reply = (text, lines = []) => (lines.length ? `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);

const PACK = JSON.stringify({
    id: 'world-daily', version: '1.0.0', name: 'World daily', format: 4, kind: 'world', requires: { suite: '^0.1' },
    content: {
        places: [{ name: 'Highmark', region: 'The March', x: 0, y: 0, kind: 'town' }, { name: 'Bluewatch', region: 'The March', x: 5, y: 5, kind: 'village' }],
        conditions: [
            { name: 'unrest', scope: 'place', fades: '10 days', means: 'Crowds in the streets.' },
            { name: 'grain-dear', scope: 'region', fades: '2 days', means: 'Bread costs more.' },
        ],
    },
});

/** The spec's kinds the packs cannot carry yet: realms and events (an omen rolled each day, a set-in-motion levy on day 2). */
export const SPEC = Object.freeze({
    realms: [{ name: 'March Realm', regions: ['The March'] }],
    events: [
        { id: 'levy', kind: 'one-off', certainty: 'set-in-motion', where: ['Highmark'], window: { after: 'start', within: '2 days' }, ends_when: { for: '3 days' }, effects: { set: ['unrest@Highmark'] }, summary: 'The lord calls a levy.' },
        { id: 'omen', kind: 'one-off', certainty: 'possible', chance: '60% over the window', where: ['Bluewatch'], window: { after: 'start', within: '20 days' }, ends_when: 'instant', effects: { set: ['grain-dear@The March: 5 days'] }, outcomes: [{ name: 'bright', weight: 1 }, { name: 'dark', weight: 1 }], summary: 'An omen over Bluewatch: {outcome}.' },
    ],
});

/** A host with the pack installed and the spec's kinds added (jumps of up to 60 days); `on` turns the switch on. Call `host.done()` to close and undo. */
export async function newHost(on = true, spec = SPEC, settings = { modules: { 'story-director': { 'tracker.maxJump': 60 } } }, pack = PACK) {
    const undo = overrideWorld(world => ({ ...world, ...spec }));
    let host = null;
    // `feature`: the world part's queries (world.heardHere) read the switch through the module's host.
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), feature: id => host?.features.on(id) } });
    host = await createHost({ modules: [fakeFightRunner(), module], settings });
    if (on) host.features.set(FEATURE, true);
    const installed = await host.packs.packs.install(pack, { origin: 'pack.json' });
    assert.equal(installed.ok, true, JSON.stringify(installed.errors));
    host.done = () => { host.close(); undo(); };
    return host;
}

export const chronicle = host => host.head().domains.chronicle;
/** The daily step's state (kept as a slot, `[state]`), or null. */
export const dailyOf = host => chronicle(host).daily?.[0] ?? null;
export const world = host => JSON.stringify({ daily: chronicle(host).daily ?? null, conditions: chronicle(host).conditions ?? null, time: host.head().domains.director?.time?.minutes ?? null });
export const dailyReceipts = host => host.sdk.receipts().filter(entry => entry.receipt.type === 'chronicle.world.daily');

/** Rebuild equals live, and a fresh host loading the same chat agrees. */
export async function agrees(host, label, on = true) {
    const live = JSON.stringify(host.head().domains);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains), live, `${label}: rebuild equals live`);
    const again = await createHost({ modules: [fakeFightRunner(), createModule()], settings: { modules: { 'story-director': { 'tracker.maxJump': 60 } } } });
    try {
        if (on) again.features.set(FEATURE, true);
        await again.st.loadChat(structuredClone(host.ctx.chat));
        assert.equal(world(again), world(host), `${label}: a fresh load agrees`);
    } finally { again.close(); }
}
