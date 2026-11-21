// The Director judge on the story's new world lines, on the real host: the entry is heard as rumour at once, one background call judges it,
// the verdict is stored by the chronicle's command before the next reply (accept, reshape, refuse); replay == live with no new calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FIRE, RIOT, agrees, conditionKeys, entry, fakeModel, heard, judgeHost, reply, settle } from './judge-host.helpers.js';

const BEGIN = ['Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm'])];

test('accept: rumour at once, one call, then fact at its place; the call is counted; replay and a reload agree', async () => {
    const host = await judgeHost();
    try {
        await host.send(...BEGIN);
        await host.send('Look.', reply('The square fills.', [RIOT]));
        const riot = entry(host, 'Bread Riots');
        assert.equal(riot.judge.state, 'pending');
        assert.deepEqual(riot.judge.conditions, ['unrest@Highmark']);
        assert.deepEqual(heard(host, 'Highmark'), ['Bread Riots:rumour'], 'heard as rumour even at its own place while it waits');
        await settle();
        assert.equal(host.model.calls, 1, 'one background call');
        assert.match(host.model.prompts[0].prompt, /Items:\n1: Bread Riots — crowds fill the square \| place: Highmark \| conditions: \+unrest$/);
        assert.equal(host.model.prompts[0].role, 'quick');
        await host.send('Wait.', reply('Time passes.'));
        assert.equal(entry(host, 'Bread Riots').judge.state, 'accepted');
        assert.deepEqual(heard(host, 'Highmark'), ['Bread Riots:fact'], 'accepted: fact at its own place');
        assert.equal(host.sdk.query('chronicle.directorCalls', {}).count, 1, 'the call is counted for Settings');
        await settle();
        assert.equal(host.model.calls, 1, 'never asked again');
        await agrees(host, 'accepted');
        await host.swipe(reply('Time passes, again.'));
        await settle();
        assert.equal(host.model.calls, 1, 'a swipe asks nothing');
        assert.equal(entry(host, 'Bread Riots').judge.state, 'accepted', 'the stored verdict stays through a swipe');
        await agrees(host, 'swiped');
    } finally { host.done(); }
});

test('refuse: the entry ends, is heard nowhere, its line\'s condition is lifted; reshape: the corrected words and place are used', async () => {
    const model = fakeModel(prompt => (/Bread Riots/.test(prompt) ? '1: refuse: the lore says Highmark has no square' : '1: reshape: Mill Fire — the mill smoulders | place: Bluewatch'));
    const host = await judgeHost({ model });
    try {
        await host.send(...BEGIN);
        await host.send('Look.', reply('The square fills.', [RIOT]));
        assert.deepEqual(conditionKeys(host), ['unrest@Highmark']);
        await settle();
        await host.send('Wait.', reply('Smoke rises.', [FIRE]));
        const riot = entry(host, 'Bread Riots');
        assert.equal(riot.state, 'resolved');
        assert.deepEqual([riot.judge.state, riot.judge.why], ['refused', 'the lore says Highmark has no square']);
        assert.deepEqual(conditionKeys(host), [], 'the refused line\'s condition is lifted');
        assert.ok(!heard(host, 'Highmark').some(item => item.startsWith('Bread Riots')), 'a refused entry is heard nowhere');
        assert.match(host.sdk.receipts().map(item => String(item.receipt.summary ?? '')).join('\n'), /the Director refused "Bread Riots" \(the lore says Highmark has no square\); it was only a rumour/);
        await settle();
        await host.send('On.', reply('On.'));
        const fire = entry(host, 'Mill Fire');
        assert.deepEqual([fire.judge.state, fire.summary, fire.place], ['reshaped', 'the mill smoulders', 'Bluewatch']);
        assert.equal(model.calls, 2);
        await agrees(host, 'refused and reshaped');
    } finally { host.done(); }
});

test('a reshape that does not read (another name, a place the map does not know) keeps the line; a failed call is recorded, never asked again', async () => {
    const model = fakeModel(() => '1: reshape: Other Name — something | place: Nowhere');
    const host = await judgeHost({ model });
    try {
        await host.send(...BEGIN);
        await host.send('Look.', reply('Smoke.', [FIRE]));
        await settle();
        await host.send('Wait.', reply('Ash.'));
        const fire = entry(host, 'Mill Fire');
        assert.deepEqual([fire.judge.state, fire.summary, fire.place], ['kept', 'the old mill burns', 'Highmark']);
        model.error = 'FAILED';
        await host.send('More.', reply('Rain.', ['+ world Flood — the river rises | place: Bluewatch']));
        await settle();
        await host.send('Wait.', reply('Mud.'));
        assert.equal(entry(host, 'Flood').judge.state, 'kept', 'a failed call: the line stands, recorded');
        const calls = model.calls;
        await settle();
        await host.send('Later.', reply('Later.'));
        await settle();
        assert.equal(model.calls, calls, 'nothing is asked again');
        await agrees(host, 'kept');
    } finally { host.done(); }
});

test('busy: asked again later, not recorded; the setting off or the switch off: nothing waits and nothing is asked', async () => {
    const model = fakeModel();
    model.error = 'BUSY';
    const host = await judgeHost({ model });
    try {
        await host.send(...BEGIN);
        await host.send('Look.', reply('Smoke.', [FIRE]));
        await settle();
        await host.send('Wait.', reply('Ash.'));
        assert.equal(entry(host, 'Mill Fire').judge.state, 'pending', 'busy is no answer');
        model.error = null;
        await settle();
        await host.send('Again.', reply('Ash again.'));
        await settle();
        await host.send('Once more.', reply('Still ash.'));
        assert.equal(entry(host, 'Mill Fire').judge.state, 'accepted', 'asked again once the model was free, stored before the next reply');
    } finally { host.done(); }
    for (const options of [{ judge: false }, { on: false }]) {
        const plain = await judgeHost({ ...options, model: fakeModel() });
        try {
            await plain.send(...BEGIN);
            await plain.send('Look.', reply('Smoke.', [FIRE]));
            await settle();
            await plain.send('Wait.', reply('Ash.'));
            assert.equal(entry(plain, 'Mill Fire')?.judge, undefined, `${JSON.stringify(options)}: no mark`);
            assert.equal(plain.model.calls, 0, `${JSON.stringify(options)}: no call`);
        } finally { plain.done(); }
    }
});

test('an edited Re-read of the line\'s reply waits again (new words, new key: the old verdict is never used); a middle delete takes the entry and its verdict', async () => {
    const model = fakeModel(() => '1: reshape: Mill Fire — the mill smoulders | place: Bluewatch');
    const host = await judgeHost({ model });
    try {
        await host.send(...BEGIN);
        await host.send('Look.', reply('Smoke.', [FIRE]));
        await settle();
        await host.send('Wait.', reply('Ash.'));
        assert.equal(entry(host, 'Mill Fire').judge.state, 'reshaped');
        const at = host.ctx.chat.findIndex(message => !message.is_user && message.mes.startsWith('Smoke.'));
        await host.st.editMessage(at, reply('Smoke.', ['+ world Mill Fire — the new mill burns bright | state: ongoing | place: Highmark']));
        assert.equal((await host.sdk.reread(at)).ok, true);
        const fire = entry(host, 'Mill Fire');
        assert.deepEqual([fire.judge.state, fire.summary, fire.place], ['pending', 'the new mill burns bright', 'Highmark'], 'the old reshape is not laid on the new words');
        await agrees(host, 'edited Re-read');
        for (const text of ['On.', 'Further.']) {
            await settle();
            await host.send(text, reply(text));
        }
        assert.equal(entry(host, 'Mill Fire').judge.state, 'reshaped', 'the new words were judged in their turn');
        assert.equal(model.calls, 2);
        await host.st.deleteMessage(at);
        assert.equal(entry(host, 'Mill Fire'), null, 'a middle delete of the line\'s reply takes the entry; its stored verdict finds nothing');
        await agrees(host, 'middle delete');
        await settle();
        assert.equal(model.calls, 2, 'nothing is asked after the delete');
    } finally { host.done(); }
});
