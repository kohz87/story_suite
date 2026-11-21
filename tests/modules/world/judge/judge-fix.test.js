// The Director judge on world lines, fixes from the part-2 review: a verdict on old words never lays over newer ones; a verdict is not lost to a swipe or a
// Continue; entries are let go when the setting is off or the model keeps failing; a refused entry stays refused unless a `+` line restarts it. Replay == live.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FIRE, agrees, entry, fakeModel, heard, judgeHost, reply, settle } from './judge-host.helpers.js';

const BEGIN = ['Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm'])];

// A model whose first call (the one on the old words) waits for `release()`; later calls answer at once.
function gated(answer) {
    const model = fakeModel(answer);
    let release = null;
    const gate = new Promise(resolve => { release = resolve; });
    const plain = model.callModel;
    let first = true;
    model.callModel = async request => {
        if (first && request.module === 'story-director world judge') { first = false; model.calls += 0; await gate; }
        return plain(request);
    };
    model.release = release;
    return model;
}

test('a verdict on the old words is not laid over the story\'s newer update of a waiting entry', async () => {
    const model = gated(prompt => (/old mill/.test(prompt) ? '1: reshape: Mill Fire — the mill smoulders | place: Bluewatch' : '1: accept'));
    const host = await judgeHost({ model });
    try {
        await host.send(...BEGIN);
        await host.send('Look.', reply('Smoke.', [FIRE]));
        await host.send('More.', reply('The quarter burns.', ['~ world Mill Fire — the whole quarter burns | place: Highmark']));
        assert.equal(entry(host, 'Mill Fire').judge.state, 'pending', 'still waiting, on the new words');
        model.release();
        await settle();
        await host.send('On.', reply('On.'));
        await settle();
        await host.send('Further.', reply('Further.'));
        const fire = entry(host, 'Mill Fire');
        assert.deepEqual([fire.judge.state, fire.summary, fire.place], ['accepted', 'the whole quarter burns', 'Highmark'], 'the stale reshape was skipped, the new words judged');
        await agrees(host, 'stale verdict');
    } finally { host.done(); }
});

test('a verdict first stored at a swipe is offered again at the next swipe: asked once, counted once, replay agrees', async () => {
    const model = gated(() => '1: refuse: no such fire');
    const host = await judgeHost({ model });
    try {
        await host.send(...BEGIN);
        await host.send('Look.', reply('Smoke.', [FIRE]));
        await host.send('Wait.', reply('Ash two.'));
        model.release();
        await settle();
        await host.swipe(reply('Ash two, again.'));
        assert.equal(entry(host, 'Mill Fire').judge.state, 'refused', 'stored on the first swipe');
        await host.swipe(reply('Ash two, third.'));
        assert.equal(entry(host, 'Mill Fire').judge.state, 'refused', 'the next swipe has it too');
        assert.equal(model.calls, 1, 'asked once');
        assert.equal(host.sdk.query('chronicle.directorCalls', {}).count, 1, 'counted once');
        await agrees(host, 'swipes');
    } finally { host.done(); }
});

test('a Continue stores no verdict and loses none: it is stored by the next real reply, asked once', async () => {
    const model = fakeModel(() => '1: accept');
    const host = await judgeHost({ model });
    try {
        await host.send(...BEGIN);
        await host.send('Look.', reply('Smoke.', [FIRE]));
        await settle();
        await host.cont(reply(' More smoke.'));
        assert.equal(entry(host, 'Mill Fire').judge.state, 'pending', 'a Continue commits nothing');
        await host.send('Wait.', reply('Ash.'));
        assert.equal(entry(host, 'Mill Fire').judge.state, 'accepted');
        assert.equal(model.calls, 1);
        assert.equal(host.sdk.query('chronicle.directorCalls', {}).count, 1);
        await agrees(host, 'continue');
    } finally { host.done(); }
});

test('the setting turned off: no more calls, and the entries still waiting are let go (kept as the line wrote them, heard as fact at their place)', async () => {
    const model = fakeModel();
    model.error = 'UNAVAILABLE';
    const host = await judgeHost({ model });
    try {
        await host.send(...BEGIN);
        await host.send('Look.', reply('Smoke.', [FIRE]));
        await settle();
        const asked = model.calls;
        assert.equal(entry(host, 'Mill Fire').judge.state, 'pending');
        host.settings.set('story-director', 'chronicle.judge', false);
        await host.send('Wait.', reply('Ash.'));
        await settle();
        await host.send('On.', reply('On.'));
        assert.equal(model.calls, asked, 'no call with the setting off');
        assert.equal(entry(host, 'Mill Fire').judge.state, 'kept');
        assert.deepEqual(heard(host, 'Highmark'), ['Mill Fire:fact']);
        await agrees(host, 'setting off');
    } finally { host.done(); }
});

test('an entry whose asks keep failing for a transient reason is given up after a few tries and kept', async () => {
    const model = fakeModel();
    model.error = 'UNAVAILABLE';
    const host = await judgeHost({ model });
    try {
        await host.send(...BEGIN);
        await host.send('Look.', reply('Smoke.', [FIRE]));
        let sent = 0;
        while (entry(host, 'Mill Fire').judge.state === 'pending' && sent < 12) {
            await settle();
            sent += 1;
            await host.send(`Turn ${sent}.`, reply(`Turn ${sent}.`));
        }
        assert.equal(entry(host, 'Mill Fire').judge.state, 'kept', 'let go, not rumour for ever');
        assert.ok(sent <= 8, `given up within a few replies (${sent})`);
        const asked = model.calls;
        await settle();
        await host.send('After.', reply('After.'));
        assert.equal(model.calls, asked, 'never asked again');
        await agrees(host, 'given up');
    } finally { host.done(); }
});

test('a refused entry stays refused when a later line updates it; a `+` line restarts it as a plain entry', async () => {
    const model = fakeModel(() => '1: refuse: no such fire');
    const host = await judgeHost({ model });
    try {
        await host.send(...BEGIN);
        await host.send('Look.', reply('Smoke.', [FIRE]));
        await settle();
        await host.send('Wait.', reply('Ash.', ['~ world Mill Fire — the fire spreads | state: ongoing']));
        const fire = entry(host, 'Mill Fire');
        assert.deepEqual([fire.judge.state, fire.state, fire.summary], ['refused', 'resolved', 'the old mill burns'], 'the line did not reopen it');
        assert.ok(!heard(host, 'Highmark').some(item => item.startsWith('Mill Fire')));
        await agrees(host, 'refused kept');
        await host.send('Again.', reply('A new fire.', ['+ world Mill Fire — a second fire at the mill | state: ongoing | place: Highmark']));
        const again = entry(host, 'Mill Fire');
        assert.deepEqual([again.judge, again.state, again.summary], [undefined, 'ongoing', 'a second fire at the mill'], 'restarted by the story');
        await agrees(host, 'restarted');
    } finally { host.done(); }
});
