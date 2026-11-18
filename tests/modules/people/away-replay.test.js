// People away replay == live (people/away, AWAYFOLLOW): a person sent away and brought back, through a swipe and swipe back, an edited Re-read
// (grown and shrunk), a middle delete, a rewind, a reload, a rebuild and a chat change. Each check fails if the away lines stop replaying.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OPENING, castHost, castSource, entry, said } from '../cast/cast/helpers.js';
import { tables } from '../../../modules/people/away/away-domain.js';

const quiet = t => { t.mock.method(console, 'log', () => {}); t.mock.method(console, 'warn', () => {}); };
const last = host => host.ctx.chat.length - 1;
const state = host => JSON.stringify(host.head().domains.away);
const awayNow = host => Object.keys(tables(host.head().domains.away).away).sort();
const home = host => Object.keys(tables(host.head().domains.away).home).sort();
const view = host => JSON.stringify(host.sdk.query('director.away'));

async function start(t) {
    quiet(t);
    const host = await castHost({ source: castSource([entry('brom')]) });
    await host.send('Hello.', said('Dawn.', OPENING));
    return host;
}

test('away and return: a swipe takes the return back, swiping back restores it; a reload, a rebuild and a chat change agree', async t => {
    const host = await start(t);
    try {
        await host.send('Go.', said('Ren leaves.', ['+ away Ren — scouting the north road | back: June 9']));
        await host.send('On.', said('News.', ['! away Ren — reached Wolfmere Outpost']));
        await host.send('Back.', said('Ren is back.', ['- away Ren']));
        const at = last(host);
        const live = state(host);
        const liveView = view(host);
        assert.deepEqual([awayNow(host), home(host)], [[], ['ren']]);
        await host.swipe(said('No sign of Ren.'));
        assert.deepEqual([awayNow(host), home(host)], [['ren'], []], 'the other swipe has no return');
        await host.st.swipeTo(at, 0);
        assert.equal(state(host), live, 'swiping back is the live state');
        assert.equal(view(host), liveView);
        host.store.rebuild();
        assert.equal(state(host), live, 'a rebuild');
        const chat = structuredClone(host.ctx.chat);
        await host.st.loadChat(chat);
        assert.equal(state(host), live, 'a reload');
        await host.st.loadChat([structuredClone(chat[0])], 'other-chat');
        assert.deepEqual(awayNow(host), [], 'another chat has nobody away');
        await host.st.loadChat(chat, 'first-chat');
        assert.equal(state(host), live, 'back to the first chat');
    } finally { host.close(); }
});

test('an edited Re-read: the away lines grown (a second person, a step) and shrunk (none) follow the text', async t => {
    const host = await start(t);
    try {
        await host.send('Go.', said('Ren leaves.', ['+ away Ren — scouting']));
        const at = last(host);
        await host.st.editMessage(at, said('Both leave.', ['+ away Ren — scouting', '+ away Ann — to the coast | back: in 3 days']));
        assert.equal((await host.turn.reread(at)).ok, true);
        assert.deepEqual(awayNow(host), ['ann', 'ren'], 'grown');
        const grown = state(host);
        host.store.rebuild();
        assert.equal(state(host), grown, 'rebuild == live after the grown Re-read');
        await host.st.editMessage(at, said('Nobody leaves.'));
        assert.equal((await host.turn.reread(at)).ok, true);
        assert.deepEqual(awayNow(host), [], 'shrunk');
        host.store.rebuild();
        assert.deepEqual(awayNow(host), []);
    } finally { host.close(); }
});

test('a middle delete of the reply that sent someone away passes over the later news and the return; a rewind takes them away', async t => {
    const host = await start(t);
    try {
        await host.send('Go.', said('Ren leaves.', ['+ away Ren — scouting']));
        const sentAway = last(host);
        await host.send('Go too.', said('Ann leaves.', ['+ away Ann — to the coast']));
        await host.send('On.', said('News.', ['! away Ren — reached the weir', '! away Ann — at the harbour']));
        await host.send('Back.', said('Ren rides in.', ['- away Ren']));
        assert.deepEqual([awayNow(host), home(host)], [['ann'], ['ren']]);
        await host.st.deleteMessage(sentAway);
        await host.st.deleteMessage(sentAway - 1);
        assert.deepEqual(awayNow(host), ['ann'], 'Ren goes with the reply that sent him; his news is passed over');
        assert.deepEqual(home(host), [], 'and so is his return: no "back" for an absence that is gone');
        assert.equal(JSON.stringify(host.sdk.query('director.away')).includes('Ren'), false, 'NPC State is told nothing of Ren');
        assert.deepEqual(tables(host.head().domains.away).away.ann.steps.map(step => step.text), ['at the harbour'], 'Ann\'s news stays');
        assert.deepEqual(host.turn.problems(), []);
        const live = state(host);
        host.store.rebuild();
        assert.equal(state(host), live, 'rebuild == live');
        await host.st.loadChat(structuredClone(host.ctx.chat));
        assert.equal(state(host), live, 'reload == live');
        for (let n = 0; n < 6; n += 1) await host.st.deleteMessage(last(host));
        assert.deepEqual(awayNow(host), [], 'a rewind past both');
    } finally { host.close(); }
});
