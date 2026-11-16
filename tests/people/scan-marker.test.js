// The scan marker in the store (people store P4): NPC State's commit stores the last reply it read (`people.scan` = [lastSid, swipeKey, since]), outside the
// people hash; a swipe, a swipe back, a middle delete, a last delete then a regenerate, and a reload take NPC State's marker from the store, so a reply
// already read is not read again and a reply that replaced one is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleRig } from './helpers/people-rig.js';

const history = async rig => (await rig.host.sdk.timeline.history({})).messages;
const headAt = rig => rig.host.store.headIndex();
const scanOf = rig => { const scan = rig.host.head().domains.people?.scan; return scan ? { lastSid: scan[0], swipeKey: scan[1], since: scan[2] } : scan; };   // (stored as [lastSid, swipeKey, since])
const dossierHash = rig => rig.host.sdk.query('people.hash', { dossiers: true });
const lastMark = rig => rig.marks.at(-1);
const settleSync = () => new Promise(resolve => setTimeout(resolve, 30));
// NPC State's scan of the head reply: the marker moves to it (and `edit` may change people), announced as index.js does.
const scanned = (rig, edit = () => {}) => rig.publish(state => { state.lastScannedMessageId = headAt(rig); state.assistantSinceScan = 0; edit(state); });

test('a scan\'s commit stores the marker on its reply; a scan that changed no person writes only the marker, and the people hash does not move', async t => {
    const rig = await peopleRig(t);
    await rig.reply('Mira is here.', state => { state.lastScannedMessageId = headAt(rig); state.assistantSinceScan = 0; });
    const messages = await history(rig);
    assert.deepEqual(scanOf(rig), { lastSid: messages[headAt(rig)].sid, swipeKey: messages[headAt(rig)].swipeKey, since: 0 });
    const hash = dossierHash(rig);
    await rig.host.send('On.', 'Further on.');
    await settleSync();
    assert.equal(await scanned(rig), true);
    const now = await history(rig);
    assert.equal(scanOf(rig).lastSid, now[headAt(rig)].sid, 'the marker moved to the new reply');
    assert.equal(dossierHash(rig), hash, 'the people hash leaves the marker out');
    assert.deepEqual(rig.warnings.filter(text => /could not/.test(text)), []);
});

test('swipe: the new swipe is read (the marker the store holds there is the reply before); swipe back: the read swipe is not read again', async t => {
    const rig = await peopleRig(t);
    await rig.reply('Mira is here.', state => { state.lastScannedMessageId = headAt(rig); });
    await rig.host.send('On.', 'Reply two.');
    await settleSync();
    await scanned(rig);
    const two = headAt(rig);
    const first = (await history(rig))[two];
    await rig.host.swipe('Reply two, another way.');
    await settleSync();
    assert.equal(lastMark(rig)?.[0], two - 2, 'the swipe\'s carrier holds the earlier marker: the new swipe will be read');
    assert.equal(rig.live.state.lastScannedMessageId, two - 2);
    await scanned(rig);
    assert.equal(scanOf(rig).swipeKey !== first.swipeKey, true, 'the swipe\'s own read is stored on it');
    await rig.host.st.swipeTo(two, 0);
    await settleSync();
    assert.equal(lastMark(rig)?.[0], two, 'swiping back to the read swipe: its marker says read');
    assert.equal(rig.live.state.lastScannedMessageId, two, 'it is not read again');
});

test('middle delete: the head keeps its reply but moves down; the marker follows it from the store', async t => {
    const rig = await peopleRig(t);
    await rig.reply('Mira is here.', state => { state.lastScannedMessageId = headAt(rig); });
    await rig.host.send('On.', 'Reply two.');
    await settleSync();
    await scanned(rig);
    await rig.host.send('On again.', 'Reply three.');
    await settleSync();
    await scanned(rig);
    const before = headAt(rig);
    await rig.host.st.deleteMessage(before - 2);   // reply two, in the middle
    await settleSync();
    assert.equal(headAt(rig), before - 1);
    assert.equal(rig.live.state.lastScannedMessageId, before - 1, 'the head reply is still the one read, at its new place');
});

test('a reply whose commit did not land is deleted, then a reply is regenerated: the new reply is read (marker from the store, or held to the head)', async t => {
    const rig = await peopleRig(t);
    await rig.reply('Mira is here.', state => { state.lastScannedMessageId = headAt(rig); });
    await rig.host.send('On.', 'Reply two.');
    await settleSync();
    await scanned(rig);
    const two = headAt(rig);
    await rig.host.send('On again.', 'Reply three.');
    await settleSync();
    rig.live.state.lastScannedMessageId = headAt(rig);   // reply three was read, but nothing was committed for it
    await rig.host.st.deleteMessage(headAt(rig));
    await settleSync();
    assert.equal(rig.live.state.lastScannedMessageId, two, 'back to the marker the store holds for reply two');
    await rig.host.st.generate('regenerate', { reply: 'Reply three again.' });
    await settleSync();
    assert.ok(rig.live.state.lastScannedMessageId < headAt(rig), 'the regenerated reply is not marked read');
});

test('with no marker stored, a last delete holds the marker to the head (the old clamp), so a regenerated reply is read', async t => {
    const rig = await peopleRig(t);
    await rig.reply('Mira is here.');
    assert.equal(scanOf(rig), undefined);
    await rig.host.send('On.', 'Reply two.');
    await settleSync();
    rig.live.state.lastScannedMessageId = headAt(rig);
    await rig.host.st.deleteMessage(headAt(rig));
    await settleSync();
    assert.ok(rig.live.state.lastScannedMessageId <= headAt(rig), 'held to the head');
});

test('reload: the marker comes back from the store (no sidecar), with the replies since the scan', async t => {
    const rig = await peopleRig(t);
    await rig.reply('Mira is here.', state => { state.lastScannedMessageId = headAt(rig); state.assistantSinceScan = 0; });
    await rig.host.send('On.', 'Reply two.');
    await settleSync();
    await rig.publish(state => { state.lastScannedMessageId = headAt(rig); state.assistantSinceScan = 1; });
    const at = headAt(rig);
    const again = await rig.reload();
    assert.equal(await again.settle(), true);
    assert.equal(again.live.state.lastScannedMessageId, at, 'the reloaded cache knows the last reply read');
    assert.equal(again.live.state.assistantSinceScan, 1);
});

test('a change line while NPC State has uncommitted work: no hydrate, and neither the line\'s meters nor the cache\'s work is lost', async t => {
    const rig = await peopleRig(t);
    await rig.reply('Mira is here.');
    const hydrations = rig.hydrations.length;
    rig.live.state.npcs.find(item => item.id === 'npc_mira').seenCount = 7;   // made for the next reply, not committed yet
    await rig.host.send('Go.', 'Mira smiles.\n\n<Changes>\n~ npc MIRA | trust: +2\n</Changes>');
    await settleSync();
    assert.equal(rig.hydrations.length, hydrations, 'the line\'s meters are not the cache\'s: no hydrate');
    assert.equal(rig.live.state.npcs.find(item => item.id === 'npc_mira').seenCount, 7, 'the uncommitted work stays');
    assert.equal(await rig.publish(() => {}), true);
    assert.equal(rig.host.head().domains.people.npcs.npc_mira.seenCount, 7, 'the cache\'s work is stored');
    assert.equal(rig.host.head().domains.people.bonds.npcs.npc_mira.meters.trust > 0, true, 'the line\'s meters are kept by the cache\'s write');
});
