// Host helpers for the tests of the Director judge on tomorrow's daily roll: a small world, a fake roll judge, and the replay check.
import assert from 'node:assert/strict';

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';
import { overrideWorld } from '../../../../modules/world/chronicle/world-daily/read-world.js';
import { rollAsker } from '../../../../modules/arc/judge/roll-ask.js';
import { fakeFightRunner } from '../../../suite/integration/director/helpers/fake-fight-runner.js';
import { FEATURE, reply, settle } from './judge-host.helpers.js';

const PACK = JSON.stringify({ id: 'roll-world', version: '1.0.0', name: 'Roll world', format: 4, kind: 'world', requires: { suite: '^0.1' }, content: { places: [{ name: 'Highmark', region: 'The March', x: 0, y: 0, kind: 'town' }] } });
export const event = (id, chance) => ({ id, kind: 'one-off', certainty: 'possible', chance, where: ['Highmark'], window: { after: 'start + 1 day', within: '20 days' }, ends_when: 'instant', title: `The ${id}`, summary: `A ${id} in Highmark.` });
export const SPEC = { realms: [{ name: 'March Realm', regions: ['The March'] }], events: [event('riot', '100% over the window')] };
const SETTINGS = extra => ({ modules: { 'story-director': { 'tracker.maxJump': 60, ...extra } } });

export function rollModel(answers) {
    const model = { calls: 0, prompts: [], async callModel(request) {
        if (request.module !== 'story-director roll judge') return { ok: false, error: 'FAILED', text: '' };
        model.calls += 1;
        model.prompts.push(request);
        return { ok: true, text: answers[Math.min(model.calls, answers.length) - 1], error: null };
    } };
    return model;
}

export async function rollHost(model, settings, spec = SPEC) {
    const undo = overrideWorld(world => ({ ...world, ...spec }));
    rollAsker.clear();
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), feature: id => host?.features.on(id), callModel: request => model.callModel(request), canCallModel: () => true, chat: () => [] } });
    host = await createHost({ modules: [fakeFightRunner(), module], settings: SETTINGS(settings) });
    host.features.set(FEATURE, true);
    assert.equal((await host.packs.packs.install(PACK, { origin: 'pack.json' })).ok, true);
    host.done = () => { host.close(); undo(); rollAsker.clear(); };
    host.spec = spec;
    host.settingsGiven = settings;
    return host;
}

export const daily = host => host.head().domains.chronicle.daily?.[0] ?? null;
export const marks = host => host.head().domains.chronicle.ledger?.[0]?.marks ?? {};
export async function day(host, text) {
    await settle();
    await host.send(text, reply(text, ['! time +1d']));
}

export async function agrees(host, label) {
    const live = JSON.stringify(host.head().domains);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains), live, `${label}: rebuild equals live`);
    const undo = overrideWorld(world => ({ ...world, ...host.spec }));
    const again = await createHost({ modules: [fakeFightRunner(), createModule()], settings: SETTINGS(host.settingsGiven) });
    try {
        again.features.set(FEATURE, true);
        await again.packs.packs.install(PACK, { origin: 'pack.json' });
        await again.st.loadChat(structuredClone(host.ctx.chat));
        assert.equal(JSON.stringify(again.head().domains.chronicle), JSON.stringify(host.head().domains.chronicle), `${label}: a fresh load agrees`);
    } finally { again.close(); undo(); }
}
