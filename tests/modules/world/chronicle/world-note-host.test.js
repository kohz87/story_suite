// The world note (job F) on the real host, from the real conditions store (job A, set by world lines, job D) and the real news
// arrival (job E): no stubbed queries. Conditions at the scene's place, region and route show; news from far off waits for the courier.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../ui/legacy/director/module.js';
import { fakeFightRunner } from '../../../suite/integration/director/helpers/fake-fight-runner.js';

const FEATURE = 'story-director.world-events';
const reply = (text, lines = []) => (lines.length ? `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
const PACK = JSON.stringify({
    id: 'world-note', version: '1.0.0', name: 'World note', requires: { storyBlock: '^2' },
    content: {
        places: [
            { name: 'Highmark', region: 'The March', x: 0, y: 0 }, { name: 'Bluewatch', region: 'The March', x: 5, y: 5 },
            { name: 'Far Keep', region: 'The Wilds', x: 90, y: 90 },
        ],
        routes: [{ from: 'Highmark', to: 'Bluewatch', kind: 'road', km: 600 }],
        conditions: [
            { name: 'grain-dear', scope: 'region', fades: '10 days', means: 'Bread costs more.' },
            { name: 'unrest', scope: 'place', fades: 'until cleared', means: 'Crowds in the streets.' },
            { name: 'roads-closed', scope: 'route', fades: 'until cleared', means: 'Nobody passes.' },
        ],
        // A world line names a place or region, not a route: a route condition comes from a pack event (job A's command).
        events: [{ id: 'closure', once: true, when: 'time() != null', cue: 'The road closes.', then: [{ command: 'chronicle.condition.set', payload: { name: 'roads-closed', ref: 'Highmark Bluewatch', why: 'a landslide', by: 'event:pack.world-note/closure' } }] }],
    },
});

async function newHost(on) {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), feature: id => host?.features.on(id) } });
    host = await createHost({ modules: [fakeFightRunner(), module] });
    if (on) host.features.set(FEATURE, true);
    const installed = await host.packs.packs.install(PACK, { origin: 'pack.json' });
    assert.equal(installed.ok, true, JSON.stringify(installed.errors));
    return host;
}
// What the last generation was told: every extension prompt value of the last send.
const told = host => host.st.promptLog.map(entry => String(entry.value ?? '')).filter(value => value.includes('[World now]')).at(-1) ?? '';

async function play(host) {
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm', '~ place Highmark']));
    await host.send('Look.', reply('The square fills.', ['+ world Bread Riots — crowds fill the square | state: ongoing | place: Highmark | conditions: +unrest, +grain-dear']));
    await host.send('Far.', reply('A rider speaks of the north.', ['+ world Keep Siege — the far keep is besieged | state: ongoing | place: Far Keep']));
    await host.send('Wait.', reply('Evening.'));
}

test('on the host: the note shows the place, region and route conditions and only the news that has reached the scene', async () => {
    const host = await newHost(true);
    await play(host);
    assert.equal(host.sdk.query('chronicle.conditions').length, 3, JSON.stringify(host.head().domains.chronicle.conditions));
    const note = told(host);
    assert.match(note, /Conditions here: .*unrest at Highmark/);
    assert.match(note, /grain-dear at The March/);
    assert.match(note, /roads-closed at Highmark-Bluewatch/, 'a route condition is kept as "From-To"; the note finds the scene\'s routes by it');
    assert.match(note, /News that has reached here: Bread Riots/);
    assert.doesNotMatch(note, /Keep Siege/, 'ten days away by tier');
    const heard = host.sdk.query('world.heardHere', { place: 'Highmark' }).map(entry => entry.name);
    assert.deepEqual(heard.includes('Keep Siege'), false);
    host.close();
});

test('on the host: with the switch off nothing is set and no note is told', async () => {
    const host = await newHost(false);
    await play(host);
    assert.equal(host.st.promptLog.some(entry => String(entry.value ?? '').includes('[World now]')), false);
    assert.equal('conditions' in host.head().domains.chronicle, false);
    host.close();
});
