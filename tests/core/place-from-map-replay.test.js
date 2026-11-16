// B1.9 replay: a marked `~ place Name` (no kind or region) filled from a pack place gives the same scene live, on Re-read, after a swipe and back,
// after an edit of the line, after a delete of an earlier reply and on a rebuild. Marks are recorded with the reply.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../packages/story-block/testkit/index.js';
import { createStore } from '../../core/store.js';

const PACK = { id: 'places', version: '1.0.0', requires: { storyBlock: '^2' }, content: { places: [
    { name: 'Bluewatch Village', kind: 'settlement', region: 'Lakeshire', x: 1, y: 1 },
    { name: 'Cold Ford', kind: 'wild', region: 'The Marches', x: 2, y: 2 },
] } };
const said = (text, lines) => `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const place = host => host.head().domains.scene.place;
const rebuilt = host => createStore({ chat: () => host.ctx.chat, save: () => {} }).head();

async function start(t) {
    t.mock.method(console, 'warn', () => {});
    const probe = await createHost();
    assert.equal((await probe.packs.packs.install(PACK)).ok, true);
    const settings = structuredClone(probe.ctx.extensionSettings.storySuite);
    probe.close();
    const host = await createHost({ settings });
    t.after(() => host.close());
    return host;
}

test('R1-R5: live, Re-read, swipe, edit, delete and rebuild agree on the place the map filled in', async t => {
    const host = await start(t);
    await host.send('Go.', said('Home.', ['~ place Old Quay | kind: dock | region: River']));
    await host.send('To town.', said('The village.', ['~ place Bluewatch Village']));
    const at = host.ctx.chat.length - 1;
    assert.deepEqual(place(host), { name: 'Bluewatch Village', kind: 'settlement', region: 'Lakeshire' });

    const live = structuredClone(host.head());
    assert.deepEqual(rebuilt(host), live, 'R5: the rebuild equals live');
    const done = await host.turn.reread(at);
    assert.equal(done.ok, true, done.message);
    assert.deepEqual(host.head(), live, 'R1: Re-read equals live');

    await host.swipe(said('The ford.', ['~ place Cold Ford']));
    assert.deepEqual(place(host), { name: 'Cold Ford', kind: 'wild', region: 'The Marches' }, 'R2: the swipe has its own place');
    await host.st.swipeTo(at, 0);
    assert.deepEqual(host.head(), live, 'R2: swiping back restores the first');

    await host.st.editMessage(at, said('The village, changed prose.', ['~ place Bluewatch Village']));
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.deepEqual(place(host), { name: 'Bluewatch Village', kind: 'settlement', region: 'Lakeshire' }, 'R3: a prose edit changes nothing');
    await host.st.editMessage(at, said('The ford.', ['~ place Cold Ford']));
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.deepEqual(place(host), { name: 'Cold Ford', kind: 'wild', region: 'The Marches' }, 'R3: a line edit is worked once from the new line');

    await host.st.editMessage(at, said('The village.', ['~ place Bluewatch Village']));
    assert.equal((await host.turn.reread(at)).ok, true);
    await host.send('On.', said('More.', ['+ coin 1']));
    await host.st.deleteMessage(1);
    await host.turn.onChatChanged();
    assert.deepEqual(host.head(), rebuilt(host), 'R5: a delete of an earlier reply, then reload, equals a fresh rebuild');
});

test('R4: a Continue after a marked place reads nothing twice: one place receipt, the same place, the rebuild agrees', async t => {
    const host = await start(t);
    await host.send('To town.', said('The village', ['~ place Bluewatch Village']));
    const before = place(host);
    await host.cont(' and on.\n<Changes>\n+ coin 1\n</Changes>');
    assert.deepEqual(place(host), before);
    assert.deepEqual(before, { name: 'Bluewatch Village', kind: 'settlement', region: 'Lakeshire' });
    const receipts = host.ctx.chat.at(-1).extra.storySuite.receipts;
    assert.equal(receipts.filter(receipt => JSON.stringify(receipt).includes('place')).length, 1, 'one place receipt');
    assert.deepEqual(host.head(), rebuilt(host));
});
