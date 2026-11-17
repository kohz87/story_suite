// The world line's conditions (job D) on the real host, through the real store (job A): no stubbed commands or names.
// A reply's `| conditions:` label sets and lifts the pack's conditions; a second world line in a reply is refused; replay == live.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../ui/legacy/director/module.js';
import { fakeFightRunner } from '../../../suite/integration/director/helpers/fake-fight-runner.js';

const FEATURE = 'story-director.world-events';
const reply = (text, lines = []) => (lines.length ? `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
const PACK = JSON.stringify({
    id: 'world-line', version: '1.0.0', name: 'World line', requires: { storyBlock: '^2' },
    content: {
        places: [{ name: 'Highmark', region: 'The March', x: 0, y: 0 }, { name: 'Bluewatch', region: 'The March', x: 5, y: 5 }],
        conditions: [
            { name: 'grain-dear', scope: 'region', fades: '10 days', means: 'Bread costs more.' },
            { name: 'unrest', scope: 'place', fades: 'until cleared', means: 'Crowds in the streets.' },
        ],
    },
});

export async function newHost(on) {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } });
    host = await createHost({ modules: [fakeFightRunner(), module] });
    if (on) host.features.set(FEATURE, true);
    const installed = await host.packs.packs.install(PACK, { origin: 'pack.json' });
    assert.equal(installed.ok, true, JSON.stringify(installed.errors));
    return host;
}
const keys = host => Object.keys(host.head().domains.chronicle.conditions ?? {}).sort();
const summaries = host => host.sdk.receipts().map(entry => String(entry.receipt.summary ?? '')).join('\n');

async function agrees(host, label) {
    const live = JSON.stringify(host.head().domains);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains), live, `${label}: rebuild equals live`);
    const again = await createHost({ modules: [fakeFightRunner(), createModule()] });
    try {
        again.features.set(FEATURE, true);
        await again.st.loadChat(structuredClone(host.ctx.chat));
        assert.equal(JSON.stringify(again.head().domains.chronicle), JSON.stringify(host.head().domains.chronicle), `${label}: a fresh load agrees`);
    } finally { again.close(); }
}

const RIOT = '+ world Bread Riots — crowds fill the square | state: ongoing | place: Highmark | conditions: +unrest, +grain-dear';
const SECOND = '+ world Second Thing — another line | state: looming | place: Bluewatch';

test('on the host: a world line sets the pack\'s conditions through the real commands; a second line in the reply is refused', async () => {
    const host = await newHost(true);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Look.', reply('The square fills.', [RIOT, SECOND]));
    assert.deepEqual(keys(host), ['grain-dear@The March', 'unrest@Highmark'], 'region from the place on the line; place as is');
    const unrest = host.head().domains.chronicle.conditions['unrest@Highmark'];
    assert.equal(unrest.by, 'narrator');
    assert.equal(unrest.scope, 'place');
    assert.ok(host.sdk.query('chronicle.conditions', { ref: 'highmark' }).some(row => row.name === 'unrest'));
    assert.equal('Second Thing' in Object.fromEntries(Object.values(host.head().domains.chronicle.events).map(e => [e.name, 1])), false, 'the second world line is refused');
    assert.match(summaries(host), /Conditions: \+unrest \(Highmark\)/);
    await agrees(host, 'live');
    // Lift one in a later reply.
    await host.send('Calm.', reply('The crowds go home.', ['+ world Bread Riots — the crowds go home | state: over | place: Highmark | conditions: -unrest']));
    assert.deepEqual(keys(host), ['grain-dear@The March']);
    await agrees(host, 'lifted');
    // Swipe the lift and back, an edited Re-read (shrunk: no conditions; grown: both lines), a middle delete, a rewind.
    await host.swipe(reply('Still crowds.'));
    assert.deepEqual(keys(host), ['grain-dear@The March', 'unrest@Highmark']);
    await agrees(host, 'swipe');
    const at = host.ctx.chat.findIndex(message => /The square fills\./.test(message.mes));
    await host.st.editMessage(at, reply('The square fills.', ['+ world Bread Riots — crowds | state: ongoing | place: Highmark']));
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.deepEqual(keys(host), [], 'shrunk Re-read: the label gone, nothing set');
    await agrees(host, 'shrunk Re-read');
    await host.st.editMessage(at, reply('The square fills.', [RIOT, SECOND]));
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.deepEqual(keys(host), ['grain-dear@The March', 'unrest@Highmark'], 'grown Re-read: set again, the second line refused again');
    await agrees(host, 'grown Re-read');
    await host.st.deleteMessage(at);
    assert.deepEqual(keys(host), []);
    await agrees(host, 'middle delete');
    assert.deepEqual(host.store.problems(), []);
    host.close();
});

test('on the host, switch off: a Re-read while the threads feature is off runs the plain world line (both lines kept, no worldLine mark)', async () => {
    const host = await newHost(false);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Look.', reply('The square fills.', [RIOT, SECOND]));
    const at = host.ctx.chat.findIndex(message => /The square fills\./.test(message.mes));
    // With the threads feature off a Re-read runs the world lines "again", where every declared feature reads on.
    host.features.set('story-director.threads', false);
    await host.st.editMessage(at, reply('The square fills.', [RIOT, SECOND, '+ world Third — x | state: looming | place: Highmark']));
    assert.equal((await host.sdk.reread(at)).ok, true);
    const names = Object.values(host.head().domains.chronicle.events).map(event => event.name).sort();
    assert.deepEqual(names, ['Bread Riots', 'Second Thing'], 'no one-line limit with the switch off (a new line is not used: its kind is off)');
    assert.equal('worldLine' in host.head().domains.chronicle, false);
    assert.equal('conditions' in host.head().domains.chronicle, false);
    assert.doesNotMatch(host.sdk.receipts().map(entry => String(entry.receipt.summary ?? '')).join('\n'), /Not used: "unrest"/);
    host.close();
});
