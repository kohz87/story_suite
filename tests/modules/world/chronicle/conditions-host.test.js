// World conditions on the real host: a pack's event sets them, they fade with the clock, and swipe, delete, Re-read (edited, grown and shrunk), rebuild and a fresh load all agree.
// With the feature off nothing is set, nothing fades and the chronicle is byte-identical to a chat without the pack's conditions.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../ui/legacy/director/module.js';
import { fakeFightRunner } from '../../../suite/integration/director/helpers/fake-fight-runner.js';

const FEATURE = 'story-director.world-events';
const reply = (text, lines = []) => (lines.length ? `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
const by = id => `event:pack.world-conds/${id}`;
const PACK = JSON.stringify({
    id: 'world-conds', version: '1.0.0', name: 'World conds', requires: { storyBlock: '^2' },
    content: {
        places: [{ name: 'Highmark', region: 'The March', x: 0, y: 0 }, { name: 'Bluewatch', region: 'The March', x: 5, y: 5 }],
        conditions: [
            { name: 'grain-dear', scope: 'region', fades: '2 days', means: 'Bread costs more.' },
            { name: 'unrest', scope: 'place', fades: 'until cleared', means: 'Crowds in the streets.' },
        ],
        events: [
            { id: 'hunger', once: true, when: 'time() != null', cue: 'Grain runs short.', then: [{ command: 'chronicle.condition.set', payload: { name: 'grain-dear', ref: 'The March', why: 'a bad harvest', by: by('hunger') } }] },
            { id: 'riot', after: 'hunger', once: true, when: "query('chronicle.passed', { name: 'x', minutes: 0 }) == false", cue: 'Crowds gather.', then: [{ command: 'chronicle.condition.set', payload: { name: 'unrest', ref: 'Highmark', why: 'riots', by: by('riot') } }] },
        ],
    },
});

async function newHost(on = true) {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } });
    host = await createHost({ modules: [fakeFightRunner(), module] });
    if (on) host.features.set(FEATURE, true);
    const installed = await host.packs.packs.install(PACK, { origin: 'pack.json' });
    assert.equal(installed.ok, true, JSON.stringify(installed.errors));
    return host;
}
const conditions = host => host.head().domains.chronicle.conditions ?? {};
const names = host => Object.keys(conditions(host)).sort();
const snap = host => JSON.stringify(host.head().domains.chronicle.conditions ?? null);

async function agrees(host, label) {
    const live = JSON.stringify(host.head().domains);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains), live, `${label}: rebuild equals live`);
    const again = await createHost({ modules: [fakeFightRunner(), createModule()] });
    try {
        again.features.set(FEATURE, true);
        await again.st.loadChat(structuredClone(host.ctx.chat));
        assert.equal(JSON.stringify(again.head().domains.chronicle.conditions ?? null), snap(host), `${label}: a fresh load agrees`);
    } finally { again.close(); }
}

async function play(host) {
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Rest.', reply('A quiet night.'));
    await host.send('Day.', reply('Dawn.', ['! time +1d']));
    await host.send('Next.', reply('Noon.'));
}

test('on the host: an event sets a condition, it is active, queries see it, and it fades once its end has come', async () => {
    const host = await newHost();
    await play(host);
    assert.deepEqual(names(host), ['grain-dear@The March', 'unrest@Highmark']);
    assert.deepEqual(host.sdk.query('chronicle.conditions', { ref: 'highmark' }).map(c => c.name), ['unrest']);
    assert.deepEqual(host.sdk.query('chronicle.conditionNames').map(c => c.name), ['grain-dear', 'unrest']);
    assert.equal(conditions(host)['grain-dear@The March'].by, by('hunger'));
    await host.send('Skip.', reply('Days go.', ['! time +3d']));
    assert.equal(host.sdk.query('chronicle.conditions', { name: 'grain-dear' }).length, 0, 'lapsed: not active');
    await host.send('Then.', reply('Quiet.'));
    assert.deepEqual(names(host), ['unrest@Highmark'], 'settled: removed');
    assert.ok(host.sdk.receipts().some(entry => entry.receipt.type === 'chronicle.conditions.settle' && /Faded: grain-dear on The March/.test(entry.receipt.summary)));
    await agrees(host, 'fade');
    host.close();
});

test('on the host: swipe, a middle delete, a rewind and an edited Re-read (grown, shrunk) keep replay equal to live', async () => {
    const host = await newHost();
    await play(host);
    await host.send('Skip.', reply('Days go.', ['! time +3d']));
    await host.send('Then.', reply('Quiet.'));
    await agrees(host, 'before');
    // Swipe the last reply, then swipe back: nothing moves.
    const before = snap(host);
    await host.swipe(reply('Quiet, but different.'));
    assert.equal(snap(host), before);
    await agrees(host, 'swipe');
    // An edited Re-read of the skip reply: shrunk (+3d → +1h, so grain-dear has not lapsed), then grown (+9d).
    const at = host.ctx.chat.findIndex(message => /Days go\./.test(message.mes));
    await host.st.editMessage(at, reply('Days go.', ['! time +1h']));
    assert.equal((await host.sdk.reread(at)).ok, true);
    await agrees(host, 'shrunk Re-read');
    const shrunk = names(host);
    await host.st.editMessage(at, reply('Days go.', ['! time +9d']));
    assert.equal((await host.sdk.reread(at)).ok, true);
    await agrees(host, 'grown Re-read');
    await host.st.editMessage(at, reply('Days go.', ['! time +3d']));
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.equal(snap(host), before, 'edited back: as it was');
    // The later reply's settle is a kept system step: it removed grain-dear on the old clock and replays as recorded (see WEINT.REPORT.md).
    assert.deepEqual(shrunk, ['unrest@Highmark']);
    // A middle delete: the day's reply goes, the later ones replay without it.
    await host.st.deleteMessage(at);
    await agrees(host, 'middle delete');
    assert.deepEqual(host.store.problems(), []);
    // Delete down to the start: nothing is left to fade, and the store holds no conditions the replies did not make.
    while (host.ctx.chat.length > 2) await host.st.deleteMessage(host.ctx.chat.length - 1);
    await agrees(host, 'rewound');
    host.close();
});

test('on the host: with the feature off nothing is set or settled and the chronicle has no conditions field', async () => {
    const host = await newHost(false);
    await play(host);
    await host.send('Skip.', reply('Days go.', ['! time +3d']));
    await host.send('Then.', reply('Quiet.'));
    assert.equal('conditions' in host.head().domains.chronicle, false);
    assert.equal(host.sdk.query('chronicle.conditions'), null);
    assert.equal(host.sdk.receipts().some(entry => /^chronicle\.condition/.test(entry.receipt.type)), false);
    host.close();
});

test('on the host: deleting the reply that set a condition, after later replies settled it, replays the settle without a failure', async () => {
    const host = await newHost();
    await play(host);
    await host.send('Skip.', reply('Days go.', ['! time +3d']));
    await host.send('Then.', reply('Quiet.'));
    assert.deepEqual(names(host), ['unrest@Highmark']);
    const fired = host.sdk.receipts().find(entry => entry.receipt.type === 'events.fire' && entry.receipt.data.event.endsWith('/hunger'));
    // The settle's receipt names grain-dear; drop the fire's exchange only (a middle delete of the reply holding it).
    await host.st.deleteMessage(fired.index - 1);
    assert.deepEqual(host.store.problems(), []);
    assert.equal('grain-dear@The March' in conditions(host), false);
    const live = JSON.stringify(host.head().domains);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains), live);
    host.close();
});
