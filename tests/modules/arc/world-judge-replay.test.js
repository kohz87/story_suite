// The Director judge is stored with the arc and never asked again: swipe and swipe back, a middle delete, a rewind, an edited Re-read (grown and shrunk), a reload and a chat
// change keep the arc, its judge record and its world note the same, and the judge's call count stays at one. Switch off: the planner's request, the draft, the accept
// receipt, the arc record and the arc and clock tail lines are what origin/world/engine produces for the same fixture (the literals below were taken from that branch, not from this code).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { createModule } from '../../../ui/legacy/director/module.js';
import { createHost } from '../../../testkit/index.js';
import { NOTE, OPENING, PLAN, TAIL_KEY, said, sent, setUp } from './world-judge.helpers.js';

const arcOf = host => Object.values(host.head().domains.arc.arcs)[0];
const worldLine = host => sent(host, TAIL_KEY).at(-1).split('\n').find(line => line.startsWith('Arc and the world:'));
const WORLD = `Arc and the world: ${NOTE.slice(6)}`;

test('the verdicts and the note are stored with the arc: the plan\'s own reply swiped and swiped back, edited (grown, shrunk), a middle delete, a swipe of a later reply, a reload, a chat change and a rewind; the judge is asked once', async () => {
    const t = await setUp(true);
    const { host } = t;
    const at = pattern => host.ctx.chat.findIndex(message => pattern.test(message.mes));
    try {
        await host.send('Begin.', OPENING);
        await host.send('Early.', said('The harbour.', ['+ hook Harbour Talk — gulls']));
        await host.send('Morning.', said('The market.', ['+ hook Market Rumour — fish prices']));
        await t.arc.plan();
        assert.equal((await t.arc.accept()).ok, true);
        const record = JSON.stringify(arcOf(host));
        assert.deepEqual(arcOf(host).judge, { calls: 1, accept: 3, reshape: 0, refuse: 0, fell: false });
        assert.equal(arcOf(host).world, NOTE.slice(6));
        const check = (where, { calls = 1 } = {}) => {
            assert.deepEqual(host.store.problems(), [], `${where}: every block still applies`);
            assert.equal(JSON.stringify(arcOf(host)), record, `${where}: the arc, its verdicts and its note are the same`);
            assert.deepEqual(host.sdk.query('chronicle.directorCalls', {}), { count: calls }, `${where}: Settings counts the judge's call`);
            const live = JSON.stringify(host.head());
            host.store.rebuild();
            assert.equal(JSON.stringify(host.head()), live, `${where}: rebuild == live`);
            assert.equal(t.judged.length, 1, `${where}: the judge is never asked again`);
        };
        check('after accept');
        // The plan's own reply: a swipe is a reply with no plan in it (the arc is the receipt's, so it goes with the swipe); swiped back, it is all as it was.
        const holder = at(/The market\./);
        await host.swipe(said('The market, again.', ['+ hook Fish Prices — dear']));
        assert.equal(host.sdk.query('director.arc').current, null, 'a swipe of the plan\'s reply takes the arc with it');
        assert.deepEqual(host.sdk.query('chronicle.directorCalls', {}), { count: 0 });
        await host.st.swipeTo(holder, 0);
        check('plan reply swiped and back');
        await host.send('Noon.', said('The quay.', ['+ hook Quay Gossip — talk']));
        assert.equal(worldLine(host), WORLD, 'the narrator\'s next prompt carries the world note');
        // An edited Re-read of the plan's reply (the accept replays from its stored payload).
        await host.st.editMessage(holder, said('The market, longer.', ['+ hook Market Rumour — fish prices', '+ hook Dock Strike — the docks stop']));
        check('plan reply Re-read grown');
        await host.st.editMessage(holder, 'The market, short.');
        check('plan reply Re-read shrunk');
        await host.send('Evening.', said('The tavern.', ['+ hook Tavern Brawl — a fight brews']));
        const quay = at(/The quay\./);
        await host.st.editMessage(quay, said('The quay, longer.', ['+ hook Quay Gossip — talk', '+ hook Tide Table — the tides']));
        check('later reply Re-read grown');
        await host.st.editMessage(quay, 'The quay, short.');
        check('later reply Re-read shrunk');
        const early = at(/The harbour\./);
        await host.st.deleteMessage(early);
        await host.st.deleteMessage(early - 1);
        check('middle delete');
        const head = host.ctx.chat.length - 1;
        await host.swipe(said('The tavern, again.', ['+ hook Tavern Fire — it burns']));
        check('swipe');
        await host.st.swipeTo(head, 0);
        check('swipe back');
        await host.send('Next.', said('Dawn.'));
        assert.equal(worldLine(host), WORLD, 'still told, still one call');
        // A reload, and another chat and back (the draft is kept per chat in the browser).
        const saved = structuredClone(host.ctx.chat);
        const again = await createHost({ modules: [createModule()] });
        await again.st.loadChat(structuredClone(saved));
        assert.equal(JSON.stringify(Object.values(again.head().domains.arc.arcs)[0]), record, 'reload: the same arc, verdicts and note');
        again.close();
        await t.arc.plan();
        const drafted = t.arc.status().draft;
        assert.equal(t.judged.length, 2, 'a second plan is a second call');
        t.setChat('chat-2');
        await host.st.loadChat([], 'chat-2');
        assert.equal(t.arc.status().draft, null);
        assert.equal(host.sdk.query('director.arc').current, null, 'the other chat has no arc');
        t.setChat('chat-1');
        await host.st.loadChat(structuredClone(saved), 'chat-1');
        assert.deepEqual(t.arc.status().draft, drafted, 'back in the first chat the draft is as it was');
        assert.equal(JSON.stringify(arcOf(host)), record, 'chat change and back: the same arc');
        assert.equal(t.judged.length, 2, 'no new call');
        // A rewind to just after the plan's reply keeps the arc; one past it takes the arc, its record, its note and its call.
        for (let last = host.ctx.chat.length - 1; last > at(/The market, short\./); last -= 1) await host.st.deleteMessage(last);
        assert.equal(JSON.stringify(arcOf(host)), record, 'rewind to the plan\'s reply: the arc stays');
        await host.send('After.', said('Dusk.'));
        assert.equal(worldLine(host), WORLD);
        const planAt = at(/The market, short\./);
        for (let last = host.ctx.chat.length - 1; last >= planAt - 1; last -= 1) await host.st.deleteMessage(last);
        assert.equal(host.sdk.query('director.arc').current, null);
        assert.deepEqual(host.sdk.query('chronicle.directorCalls', {}), { count: 0 }, 'the arc went, and its call with it');
        await host.send('Later.', said('Dusk.'));
        assert.equal(worldLine(host), undefined);
    } finally { t.done(); }
});

test('a second plan writes a new note and replaces the old one in the prompt; the stored note is not sent with the switch off', async () => {
    const t = await setUp(true, { judge: [`1: accept\n2: accept\n3: accept\nNOTE: First note.`, `1: accept\n2: accept\n3: accept\nNOTE: Second note.`] });
    try {
        await t.host.send('Begin.', OPENING);
        await t.arc.plan();
        await t.arc.accept();
        assert.equal(arcOf(t.host).world, 'First note.');
        await t.host.send('Go.', said('Rain.'));
        assert.match(sent(t.host, TAIL_KEY).at(-1), /Arc and the world: First note\./);
        await t.arc.plan();
        await t.arc.accept();
        assert.equal(t.judged.length, 2);
        await t.host.send('Go.', said('Wind.'));
        const tail = sent(t.host, TAIL_KEY).at(-1);
        assert.match(tail, /Arc and the world: Second note\./);
        assert.doesNotMatch(tail, /First note/, 'refreshed when the arc is re-planned');
        t.host.features.set('story-director.world-events', false);
        await t.host.send('Go.', said('Mist.'));
        assert.doesNotMatch(sent(t.host, TAIL_KEY).at(-1), /Arc and the world/, 'switch off: the stored note is not sent');
    } finally { t.done(); }
});

// The literals are origin/world/engine's output for this fixture with the switch off (a pack with an Active succession event and the plan below).
const OFF_PLAN = '<plan>\nARC: Succession — a crown in doubt\nBEAT: Refugees — families leave Highmark\nBEAT: Settlement — the lords settle who rules\nBEAT: Coronation — heir-crowned in the hall\nCLOCK: Rumours — whispers grow | due: in 2 days\nHOOK: Letter — a sealed letter\n</plan>';
test('switch off is byte-identical to origin/world/engine: the planner request, the draft, the receipt, the arc record and the tail', async () => {
    const t = await setUp(false, { plans: [OFF_PLAN], lore: false });
    try {
        await t.host.send('Begin.', OPENING);
        const planned = await t.arc.plan();
        const accepted = await t.arc.accept();
        await t.host.send('Go on.', said('Rain.', ['+ hook Echo — the bell echoes']));
        assert.equal(t.judged.length, 0, 'no judge call');
        assert.equal(t.planned.length, 1);
        assert.equal(createHash('sha256').update(t.planned[0].system).digest('hex').slice(0, 16), '51287b5b7808c4c7');
        assert.deepEqual(planned.draft, JSON.parse(String.raw`{"text": "ARC: Succession \u2014 a crown in doubt\nBEAT: Refugees \u2014 families leave Highmark\nBEAT: Settlement \u2014 the lords settle who rules\nBEAT: Coronation \u2014 heir-crowned in the hall\nCLOCK: Rumours \u2014 whispers grow | due: June 5, 08:00 am\nHOOK: Letter \u2014 a sealed letter", "findings": [], "reason": "manual", "note": "", "noteUsed": false}`));
        assert.equal(accepted.receipt.summary, 'New arc: Succession (3 beats, 1 hook, 1 clock).');
        assert.deepEqual(arcOf(t.host), { id: arcOf(t.host).id, key: 'Succession', desc: 'a crown in doubt', rev: 7, minutes: 631361280, reason: 'manual', note: '' });
        const tail = sent(t.host, TAIL_KEY).at(-1).split('\n').filter(line => /^(Clocks|Arc)/.test(line));
        assert.deepEqual(tail, ['Clocks: Rumours — whispers grow (June 5, 08:00 am)', 'Arc: Succession — a crown in doubt']);
    } finally { t.done(); }
});
