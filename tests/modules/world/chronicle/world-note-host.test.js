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
        items: [{ name: 'Rye Bread', tags: ['grain'] }],
        conditions: [
            { name: 'grain-dear', scope: 'region', fades: '10 days', means: 'Bread costs more.', effects: { prices: { grain: '×2', all: '×1.3' } } },
            { name: 'unrest', scope: 'place', fades: 'until cleared', means: 'Crowds in the streets.' },
            { name: 'roads-closed', scope: 'route', fades: 'until cleared', means: 'Nobody passes.' },
        ],
        // A world line names a place or region, not a route: a route condition comes from a pack event (job A's command).
        events: [{ id: 'closure', once: true, when: 'time() != null', cue: 'The road closes.', then: [{ command: 'chronicle.condition.set', payload: { name: 'roads-closed', ref: 'Highmark-Bluewatch', why: 'a landslide', by: 'event:pack.world-note/closure' } }] }],
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

test('on the host: the note takes the [World] lines\' place and shows the place, route and region conditions with what they mean and their told prices, and the news heard here', async () => {
    const host = await newHost(true);
    await play(host);
    assert.equal(host.sdk.query('chronicle.conditions').length, 3, JSON.stringify(host.head().domains.chronicle.conditions));
    const note = told(host);
    assert.doesNotMatch(note, /\[World\] Under way off-screen/, 'E23: the overlapping [World] lines are retired while the switch is on');
    assert.match(note, /Conditions here: unrest at Highmark: Crowds in the streets/);
    assert.match(note, /roads-closed at Highmark-Bluewatch: Nobody passes/, 'a route from the scene\'s place');
    assert.match(note, /grain-dear at The March: Bread costs more \(all goods ×1\.3, grain ×2\)/, 'test 58: prices told by category');
    assert.match(note, /News that has reached here: .*Bread Riots/);
    // A world line about a far place is heard at once as rumour; fact follows at courier time (ten days away by reach step).
    assert.match(note, /Keep Siege \(rumour\)/);
    assert.equal(host.sdk.query('world.heardHere', { place: 'Highmark' }).find(entry => entry.name === 'Keep Siege').tag, 'rumour');
    host.close();
});

test('on the host (E23): with the tightest tail budget the note\'s first lines are kept (pinned), not cut first', async () => {
    const host = await newHost(true);
    host.settings.set(null, 'tailBudget', 100);
    await play(host);
    const note = told(host);
    assert.match(note, /\[World now\]\nConditions here: unrest at Highmark/);
    host.close();
});

test('on the host: with the switch off nothing is set and no note is told', async () => {
    const host = await newHost(false);
    await play(host);
    assert.equal(host.st.promptLog.some(entry => String(entry.value ?? '').includes('[World now]')), false);
    assert.equal('conditions' in host.head().domains.chronicle, false);
    host.close();
});
