// The condition calls (job B) against the real conditions store (job A) on the real host: no stubbed query.
// A world event of the pack sets grain-dear on the second day; condition() is then asked through the host's own queries.
// (A pack cannot carry condition() in its own events yet: the install-time check knows only the base calls; see WEINT.REPORT.md.)
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';
import { evaluateCondition } from '../../../../modules/world/events/condition.js';
import { worldEnv } from '../../../../modules/world/events/engine-parts/world-env.js';
import { fakeFightRunner } from '../../../suite/integration/director/helpers/fake-fight-runner.js';

const FEATURE = 'story-director.world-events';
const reply = (text, lines = []) => (lines.length ? `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
const PACK = JSON.stringify({
    id: 'world-calls', version: '1.0.0', name: 'World calls', format: 4, kind: 'world', requires: { suite: '^0.1' },
    content: {
        places: [{ id: 'highmark', name: 'Highmark', region: 'The March', x: 0, y: 0 }, { id: 'bluewatch', name: 'Bluewatch', region: 'The March', x: 5, y: 5 }],
        realms: [{ id: 'march-realm', name: 'March Realm', regions: ['The March'] }],
        conditions: [{ name: 'grain-dear', scope: 'region', fades: '2 days', means: 'Bread costs more.' }],
        worldEvents: [{ id: 'hunger', kind: 'one-off', certainty: 'set-in-motion', where: ['Bluewatch'], window: { after: 'start + 1 day', within: '1 day' }, ends_when: 'instant', effects: { set: ['grain-dear@The March: 2 days'] }, summary: 'Grain runs short.' }],
    },
});

async function newHost(on) {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } });
    host = await createHost({ modules: [fakeFightRunner(), module] });
    if (on) host.features.set(FEATURE, true);
    const installed = await host.packs.packs.install(PACK, { origin: 'pack.json' });
    assert.equal(installed.ok, true, JSON.stringify(installed.errors));
    return host;
}
// The view an event's condition is read on: the head state and the host's own queries (job A's chronicle.conditions, the Journal).
const met = (host, source, def = {}, defs = []) => {
    const view = { state: host.head(), query: (name, args) => host.sdk.query(name, args), feature: id => host.features.on(id) };
    const out = evaluateCondition(source, worldEnv(view, def, defs));
    assert.equal(out.error ?? null, null, String(out.error?.message ?? ''));
    return out.met;
};

async function play(host) {
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Rest.', reply('A quiet night.', ['! time +1d']));
}

test('on the host: condition() reads the real store (the ref in any case; the where of the event), through a skip, a middle delete and a rebuild', async () => {
    const host = await newHost(true);
    await play(host);
    assert.equal(host.sdk.query('chronicle.conditions', { name: 'grain-dear' }).length, 1, 'set by the world event');
    assert.equal(met(host, "condition('grain-dear', 'The March')"), true);
    assert.equal(met(host, "condition('grain-dear', 'the march')"), true, 'the store matches a ref in any case, so does the call');
    assert.equal(met(host, "condition('grain-dear', 'Highmark')"), false, 'a region condition, not the place');
    assert.equal(met(host, "condition('grain-dear')", { where: ['The March'] }), true);
    assert.equal(met(host, "condition('grain-dear')"), true, 'anywhere with no where');
    // Two days on the condition fades: the call follows the store.
    await host.send('Skip.', reply('Days go.', ['! time +3d']));
    assert.equal(met(host, "condition('grain-dear', 'The March')"), false);
    // A middle delete of the skip and a rebuild: as live.
    await host.st.deleteMessage(host.ctx.chat.length - 1);
    assert.equal(met(host, "condition('grain-dear', 'The March')"), true);
    const live = JSON.stringify(host.head().domains);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains), live);
    host.close();
});

test('on the host: with the switch off the store has nothing and the query answers null, so condition() is false', async () => {
    const host = await newHost(false);
    await play(host);
    assert.equal(host.sdk.query('chronicle.conditions'), null);
    assert.equal(met(host, "condition('grain-dear', 'The March')"), false);
    host.close();
});
