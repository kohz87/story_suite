// A beat the story never fires: no line postpones it ("slips (~ on: later)" is gone from the Pacing text). Code closes it as
// `slipped` 3 story days after its date, and the While-away recap says so. The code is unchanged, so R0-R5 (audit 7.1 rule 3)
// show the same state on Re-read, swipe, edit, Continue and rebuild, and that an old reply with `on: later` still replays.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../../../packages/story-block/testkit/index.js';
import { createModule } from '../../../../ui/legacy/director/module.js';
import { PACING_TEXT, STATIC_TEXT } from '../../../../modules/time/tracker/note.js';

const TAIL_KEY = 'story_suite_tail_1';
const reply = (text, lines = []) => (lines.length ? `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
const tailOf = host => host.st.promptLog.filter(entry => entry.key === TAIL_KEY && entry.value).map(entry => entry.value).at(-1) ?? '';
const quiet = t => t.mock.method(console, 'warn', () => {});
const BEAT = ['~ time June 3, 1200, 08:00 pm', '+ beat Stray Oar — the inn | then: sacked by the guild | on: June 5, 1200'];

async function newHost() {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), chat: () => host?.ctx.chat ?? [] } });
    host = await createHost({ modules: [module] });
    return host;
}

const thread = host => host.sdk.query('director.thread', { key: 'Stray Oar' });
const hash = host => JSON.stringify(host.head().domains);

test('the Pacing text no longer teaches a postponing line', () => {
    assert.match(PACING_TEXT, /What cannot fit yet happens off-screen \(!\) or waits\.$/);
    assert.doesNotMatch(STATIC_TEXT, /on: later|slips/);
});

test('R0: an old reply that wrote `on: later` replays as before (nothing reads a literal "later")', async t => {
    quiet(t);
    const host = await newHost();
    try {
        await host.send('Evening.', reply('Dusk.', BEAT));
        await host.send('Settle.', reply('Quiet.', ['~ beat Stray Oar | on: later']));
        const first = hash(host);
        const old = JSON.stringify(thread(host).fields);
        assert.equal(thread(host).status, 'active');
        assert.equal((await host.turn.reread(host.ctx.chat.length - 1)).ok, true);
        assert.equal(hash(host), first);
        host.store.rebuild();
        assert.equal(hash(host), first);
        assert.equal(JSON.stringify(thread(host).fields), old);
        assert.deepEqual(host.store.problems(), []);
    } finally {
        host.close();
    }
});

test('a due beat with no line for 3 story days is closed slipped, once, and the recap says so; R1-R5 hold', async t => {
    quiet(t);
    const host = await newHost();
    try {
        await host.send('Evening.', reply('The inn is loud.', BEAT));
        assert.equal(thread(host).status, 'active');
        await host.send('Settle.', reply('Quiet.'));
        await host.send('Days.', reply('Quiet.', ['~ time June 9, 1200, 09:00 am']));
        await host.send('Later.', reply('Still quiet.'));
        assert.equal(thread(host).status, 'resolved');
        assert.equal(thread(host).ended.reason, 'slipped');
        assert.match(tailOf(host), /While away.*Stray Oar|Slipped.*Stray Oar/s);
        const live = hash(host);
        const at = host.ctx.chat.length - 1;

        // R1: Re-read.
        assert.equal((await host.turn.reread(at)).ok, true);
        assert.equal(hash(host), live, 'R1');
        // R4: Continue applies nothing twice.
        await host.cont(' More.');
        assert.equal(thread(host).status, 'resolved');
        assert.equal(Object.keys(host.head().meta.claims).filter(key => key.startsWith('lapse:')).length, 1, 'R4');
        // R3: a prose edit changes no state.
        const before = hash(host);
        await host.st.editMessage(host.ctx.chat.length - 1, `${host.ctx.chat.at(-1).mes} Edited.`);
        assert.equal(hash(host), before, 'R3');
        // R5: a rebuild gives the live state.
        const now = hash(host);
        host.store.rebuild();
        await host.turn.onChatChanged();
        assert.equal(hash(host), now, 'R5');
        assert.deepEqual(host.store.problems(), []);
    } finally {
        host.close();
    }
});

test('R2: a swipe of the reply that slipped the beat gives it back, and going back closes it again once', async t => {
    quiet(t);
    const host = await newHost();
    try {
        await host.send('Evening.', reply('The inn is loud.', BEAT));
        await host.send('Settle.', reply('Quiet.'));
        await host.send('Days.', reply('Quiet.', ['~ time June 9, 1200, 09:00 am']));
        await host.send('And?', reply('Quiet.'));
        assert.equal(thread(host).status, 'resolved');
        const first = hash(host);
        await host.swipe(reply('Quiet again.', ['~ time June 9, 1200, 09:00 am']));
        assert.equal(thread(host).status, 'resolved', 'the swipe closes it once, not twice');
        assert.equal(Object.keys(host.head().meta.claims).filter(key => key.startsWith('lapse:')).length, 1);
        await host.st.swipeTo(host.ctx.chat.length - 1, 0);
        assert.equal(hash(host), first, 'going back restores the first');
        assert.deepEqual(host.store.problems(), []);
    } finally {
        host.close();
    }
});
