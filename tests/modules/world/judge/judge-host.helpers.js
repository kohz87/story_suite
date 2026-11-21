// Host helpers for the Director judge on the story's new world lines (switch story-director.world-events, chronicle setting `judge`): a host
// with a small world pack and a fake model call that answers the world judge with the test's text (`model.answer`) and counts its calls.
import assert from 'node:assert/strict';

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';
import { worldJudgeAsker } from '../../../../modules/arc/judge/world-ask.js';
import { fakeFightRunner } from '../../../suite/integration/director/helpers/fake-fight-runner.js';

export const FEATURE = 'story-director.world-events';
export const reply = (text, lines = []) => (lines.length ? `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
const PACK = JSON.stringify({
    id: 'judge-world', version: '1.0.0', name: 'Judge world', format: 4, kind: 'world', requires: { suite: '^0.1' },
    content: {
        places: [{ name: 'Highmark', region: 'The March', x: 0, y: 0 }, { name: 'Bluewatch', region: 'The March', x: 5, y: 5 }],
        conditions: [{ name: 'unrest', scope: 'place', fades: 'until cleared', means: 'Crowds in the streets.' }],
    },
});
export const RIOT = '+ world Bread Riots — crowds fill the square | state: ongoing | place: Highmark | conditions: +unrest';
export const FIRE = '+ world Mill Fire — the old mill burns | state: ongoing | place: Highmark';

/** The fake model: `calls` counts the world judge's requests (other callers are answered "no"); `answer(prompt)` is its text; `error` a failure code. */
export function fakeModel(answer = () => '1: accept') {
    const model = {
        calls: 0, prompts: [], answer, error: null,
        async callModel(request) {
            if (request.module !== 'story-director world judge') return { ok: false, error: 'FAILED', text: '' };
            model.calls += 1;
            model.prompts.push(request);
            if (model.error) return { ok: false, error: model.error, text: '' };
            return { ok: true, text: model.answer(request.prompt), error: null };
        },
    };
    return model;
}

/** A host with the switch `on`, the chronicle setting `judge` (`judge`) and `model` as its model call. `host.done()` closes it. */
export async function judgeHost({ on = true, judge = true, model = fakeModel() } = {}) {
    worldJudgeAsker.clear();
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), feature: id => host?.features.on(id), callModel: request => model.callModel(request), canCallModel: () => true, chat: () => [] } });
    host = await createHost({ modules: [fakeFightRunner(), module], settings: { modules: { 'story-director': { 'chronicle.judge': judge } } } });
    if (on) host.features.set(FEATURE, true);
    const installed = await host.packs.packs.install(PACK, { origin: 'pack.json' });
    assert.equal(installed.ok, true, JSON.stringify(installed.errors));
    host.model = model;
    host.done = () => { host.close(); worldJudgeAsker.clear(); };
    return host;
}

/** Lets the background call finish. */
export const settle = async () => { for (let i = 0; i < 6; i += 1) await new Promise(resolve => setTimeout(resolve, 0)); };
export const entry = (host, name) => Object.values(host.head().domains.chronicle.events ?? {}).find(event => event.name === name) ?? null;
export const heard = (host, place) => (host.sdk.query('world.heardHere', { place }) ?? []).map(item => `${item.name}:${item.tag}`).sort();
export const conditionKeys = host => Object.keys(host.head().domains.chronicle.conditions ?? {}).sort();

/** Replay == live: a rebuild, and a fresh host loading the chat (no model), give the same state. */
export async function agrees(host, label) {
    const live = JSON.stringify(host.head().domains);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains), live, `${label}: rebuild equals live`);
    const again = await createHost({ modules: [fakeFightRunner(), createModule()], settings: { modules: { 'story-director': { 'chronicle.judge': true } } } });
    try {
        again.features.set(FEATURE, true);
        await again.st.loadChat(structuredClone(host.ctx.chat));
        assert.equal(JSON.stringify(again.head().domains.chronicle), JSON.stringify(host.head().domains.chronicle), `${label}: a fresh load agrees`);
    } finally { again.close(); }
}
