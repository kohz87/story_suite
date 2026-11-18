// The Follow star reaches the narrator: following pins the person (past the cap), unfollowing unpins; both replay with the reply they were made on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sendFollow } from '../../../../ui/tabs/people/dossier/follow.js';
import { OPENING, keyHost, said, slice, pin, keyTail } from './helpers.js';

const view = { v: 1, order: ['npc_ann'], npcs: { npc_ann: { id: 'npc_ann', name: 'Ann', role: 'smith' } }, candidates: [], dismissed: [], userDismissedGroups: [], socialGraph: {}, portraitAssets: {}, turn: 1 };
const ann = host => host.head().domains.people.npcs.npc_ann;
const both = host => JSON.stringify([host.head().domains.keypeople, ann(host)?.followed ?? null]);
const portOf = host => ({ command: (type, payload) => host.sdk.command(type, payload), can: () => true });

async function start() {
    const host = await keyHost({ settings: { 'keypeople.cap': 1 } });
    await host.send('Hello.', said('Dawn.', OPENING));
    const s = host.store.sourceAt(host.store.headIndex());
    assert.equal((await host.sdk.command('people.write', { v: 1, source: { sid: s.sid, swipeKey: s.swipeKey }, view })).ok, true);
    return host;
}

test('following pins past the cap and the away line is told; unfollowing unpins', async () => {
    const host = await start();
    try {
        await pin(host, 'Mara');
        assert.equal((await pin(host, 'Bo')).code, 'LIMITED', 'a plain pin still stops at the cap');
        assert.equal((await host.sdk.command('keypeople.pin', { name: 'Bo', followed: 'yes' })).code, 'INVALID');
        assert.equal((await sendFollow({ port: portOf(host) }, { id: 'npc_ann', name: 'Ann' }, true)).ok, true);
        assert.equal(ann(host).followed, true);
        assert.deepEqual(Object.keys(slice(host).pins).sort(), ['ann', 'mara']);
        await host.send('Go.', said('Ann leaves.', ['+ away Ann — scouting | back: June 9, 1200']));
        await host.send('Next.', 'Quiet.');
        assert.match(keyTail(host), /Ann: away, scouting/);
        await sendFollow({ port: portOf(host) }, { id: 'npc_ann', name: 'Ann' }, false);
        assert.equal(Object.hasOwn(ann(host), 'followed'), false);
        assert.equal(slice(host).pins.ann, undefined);
        const again = await sendFollow({ port: portOf(host) }, { id: 'npc_ann', name: 'Ann' }, false);
        assert.equal(again.ok, true, 'unpin of an absent pin never undoes the star');
    } finally { host.close(); }
});

test('swipe, swipe back, edited Re-read, middle delete, rebuild and reload keep follow and pin together', async () => {
    const host = await start();
    try {
        await host.send('One.', said('Quiet.', []));
        await sendFollow({ port: portOf(host) }, { id: 'npc_ann', name: 'Ann' }, true);
        const at = host.ctx.chat.length - 1;
        const live = both(host);
        await host.swipe(said('Other.', []));
        await host.st.swipeTo(at, 0);
        assert.equal(both(host), live, 'swipe back');
        await host.st.editMessage(at, said('Grown.', ['+ away Ann — out | back: June 9, 1200']));
        assert.equal((await host.turn.reread(at)).ok, true);
        assert.equal(JSON.parse(both(host))[1], true, 'follow stays through a grown Re-read');
        await host.st.editMessage(at, said('Shrunk.', []));
        assert.equal((await host.turn.reread(at)).ok, true);
        const afterShrunk = both(host);
        host.store.rebuild();
        assert.equal(both(host), afterShrunk, 'rebuild');
        await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
        assert.equal(both(host), afterShrunk, 'reload');
        await host.send('Two.', said('More.', []));
        await host.st.deleteMessage(at);
        await host.st.deleteMessage(at - 1);
        const mid = both(host);
        host.store.rebuild();
        assert.equal(both(host), mid, 'middle delete == rebuild');
    } finally { host.close(); }
});

test('the code the star depends on is wired: the dossier calls sendFollow', () => {
    assert.match(readFileSync(new URL('../../../../ui/tabs/people/dossier/dossier.js', import.meta.url), 'utf8'), /sendFollow\(ctx, d, on\)/);
});
