// Host helpers for the open-template tests: the daily-step host with a fake model call (a counter, and an answer chosen per test) and a
// world with an open template. The fake reads the "Slot <key>" lines of the prompt and answers each with the mode's JSON.
import assert from 'node:assert/strict';

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';
import { overrideWorld } from '../../../../modules/world/chronicle/world-daily/read-world.js';
import { openAsker } from '../../../../modules/world/chronicle/world-daily/open-ask.js';
import { fakeFightRunner } from '../../../suite/integration/director/helpers/fake-fight-runner.js';
import { FEATURE } from '../daily/daily-host.helpers.js';
import { slotValue } from '../../../../modules/rpg/slot.js';

export { FEATURE };
export const reply = (text, lines = []) => (lines.length ? `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);

const PACK = JSON.stringify({
    id: 'open-world', version: '1.0.0', name: 'Open world', requires: { storyBlock: '^2' },
    content: { places: [{ name: 'Highmark', region: 'The March', x: 0, y: 0, kind: 'town' }, { name: 'Bluewatch', region: 'The March', x: 5, y: 5, kind: 'village' }], conditions: [{ name: 'unrest', scope: 'place', fades: '10 days', means: 'Crowds.' }] },
});

export const MENU = {
    powers: { pick: 1, of: ['crown'], delta: [-5, 5] },
    set: { pick: 1, of: ['unrest', 'closed-gates'], at: '@place', for: '5 days' },
    cast: { pick: 1, of: 'figures', move: '@region' },
};
export const open = (id, extra = {}) => ({
    template: id, scope: 'place', severity: 'minor', reach: 'local', chance: '100% per season', where: { kinds: ['town'] },
    open: { menu: MENU, writes_facts: ['incident-noted'] }, fallback: { sets: ['unrest@place: 3 days'] }, summary: `A ${id} near {place}.`, ...extra,
});

/** The world the tests use: one region, two places, an open template (and a second that needs the first's unrest). */
export const WORLD = Object.freeze({
    realms: [{ name: 'March Realm', regions: ['The March'] }], events: [],
    places: [{ name: 'Highmark', region: 'The March', x: 0, y: 0, kind: 'town' }, { name: 'Bluewatch', region: 'The March', x: 5, y: 5, kind: 'village' }],
    conditions: [
        { name: 'unrest', scope: 'place', fades: '10 days', means: 'Crowds in the streets.', open: true },
        { name: 'closed-gates', scope: 'place', fades: '10 days', means: 'The gates are shut.' },
    ],
    powers: [{ id: 'crown', name: 'The Crown', start: 50 }], scores: [],
    cast: [{ id: 'warden', name: 'The Warden', kind: 'figure', start: { place: 'Highmark' } }, { id: 'queen', name: 'The Queen', kind: 'figure', protected: true, start: { place: 'Highmark' } }],
    templates: [open('border-incident')],
});

export const answerFor = (key, over = {}) => ({ slot: key, name: 'Border scuffle', summary: 'Soldiers scuffle at the gate.', people: ['warden'], effects: { powers: { crown: -3 }, set: [{ condition: 'unrest', for: '3 days' }], cast: [{ id: 'warden', to: 'Bluewatch' }], fact: 'incident-noted' }, ...over });

/** The fake model: `calls` counts every request; `mode` is 'good', 'bad' (always refused), 'bad-first', 'half' (the second slot refused, every later call busy), 'fail' or 'busy'; `prompts` keeps the text sent. */
export function fakeModel() {
    const model = {
        calls: 0, mode: 'good', prompts: [], requests: [], gate: null, extra: {},
        async callModel(request) {
            model.calls += 1;
            model.prompts.push(request.prompt);
            model.requests.push(request);
            if (model.gate) await model.gate;
            if (model.mode === 'fail') return { ok: false, text: '', error: 'FAILED', message: 'no' };
            if (model.mode === 'busy') return { ok: false, text: '', error: 'BUSY', message: 'busy' };
            const keys = [...request.prompt.matchAll(/^Slot (\S+)$/gm)].map(match => match[1]);
            if (model.mode === 'half' && model.calls > 1) return { ok: false, text: '', error: 'BUSY', message: 'busy' };
            const bad = model.mode === 'bad' || (model.mode === 'bad-first' && model.calls === 1);
            const rows = keys.map((key, index) => answerFor(key, bad || (model.mode === 'half' && index === 1) ? { effects: { powers: { crown: 99 } } } : model.extra));
            return { ok: true, text: JSON.stringify({ results: rows }), error: null };
        },
    };
    return model;
}

/** A host with the open world, the switch on and `model` as its model call. `host.done()` closes it and undoes the world. */
export async function openHost(model = fakeModel(), world = WORLD) {
    const undo = overrideWorld(base => ({ ...base, ...world }));
    openAsker.clear();
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), feature: id => host?.features.on(id), callModel: request => model.callModel(request), canCallModel: () => true, chat: () => [] } });
    host = await createHost({ modules: [fakeFightRunner(), module], settings: { modules: { 'story-director': { 'tracker.maxJump': 60 } } } });
    host.features.set(FEATURE, true);
    const installed = await host.packs.packs.install(PACK, { origin: 'pack.json' });
    assert.equal(installed.ok, true, JSON.stringify(installed.errors));
    host.model = model;
    host.done = () => { host.close(); undo(); openAsker.clear(); };
    return host;
}

export const chronicle = host => host.head().domains.chronicle;
export const dailyOf = host => slotValue(chronicle(host).daily) ?? null;
export const ledgerOpen = host => slotValue(chronicle(host).ledger)?.open ?? null;
export const slotRows = host => Object.values(dailyOf(host)?.slots ?? {});
export const worldOf = host => JSON.stringify({ daily: chronicle(host).daily ?? null, conditions: chronicle(host).conditions ?? null, ledger: chronicle(host).ledger ?? null, time: host.head().domains.director?.time?.minutes ?? null });

/** Lets the background call finish (the fake answers at once, but the promise chain needs a few turns). */
export const settle = async () => { for (let i = 0; i < 6; i += 1) await new Promise(resolve => setTimeout(resolve, 0)); };

export async function agrees(host, label) {
    const live = JSON.stringify(host.head().domains);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains), live, `${label}: rebuild equals live`);
    const again = await createHost({ modules: [fakeFightRunner(), createModule()], settings: { modules: { 'story-director': { 'tracker.maxJump': 60 } } } });
    try {
        again.features.set(FEATURE, true);
        await again.st.loadChat(structuredClone(host.ctx.chat));
        assert.equal(worldOf(again), worldOf(host), `${label}: a fresh load agrees`);
    } finally { again.close(); }
}
