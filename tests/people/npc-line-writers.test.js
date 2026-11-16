// A `~ npc` line and the scan's JSON in one reply, and a Continue, on the real NPC State adapter (peopleRig): the later write wins and replay equals live.
// Order in a reply: the line is captured when the reply arrives; the scan's people.write for that reply is stored after it. So on the same person and field the scan wins
// (it replaces the whole view, as the later writer); a field only the line states (status here) stays, and Re-read / rebuild / reload give the same state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleRig } from './helpers/people-rig.js';

const settle = () => new Promise(resolve => setTimeout(resolve, 60));
const mira = rig => rig.host.head().domains.people?.npcs?.npc_mira;
const plain = value => JSON.parse(JSON.stringify(value));
const LINE = '\n\n<Changes>\n~ npc MIRA | goal: from the line | status: tired\n</Changes>';

async function lineThenScan(rig, edit) {
    await rig.reply('Mira is here.');
    await settle();
    await rig.host.send('Next.', `Next reply.${LINE}`);
    await settle();
    assert.equal(await rig.publish(edit), true);
    await settle();
}

test('the line and the scan name the same field: the scan (stored after the line) wins; a field only the line states stays; rebuild and reload equal live', async t => {
    let rig = await peopleRig(t);
    await lineThenScan(rig, state => { state.npcs[0].goal = 'from the scan'; });
    assert.equal(mira(rig).goal, 'from the scan');
    assert.equal(mira(rig).status, 'tired');
    const live = plain(rig.host.head());
    await rig.host.store.rebuild();
    assert.deepEqual(plain(rig.host.head()), live, 'rebuild equals live');
    rig = await rig.reload();
    assert.equal(await rig.settle(), true);
    assert.equal(mira(rig).goal, 'from the scan', 'reload equals live');
    assert.equal(mira(rig).status, 'tired');
});

test('an edited Re-read of that reply applies the new line, rebuild equals live, and a rewind takes the reply fields away', async t => {
    const rig = await peopleRig(t);
    await lineThenScan(rig, state => { state.npcs[0].goal = 'from the scan'; });
    const at = rig.host.store.headIndex();
    rig.host.ctx.chat[at].mes = 'Next reply.\n\n<Changes>\n~ npc MIRA | goal: edited line | status: rested\n</Changes>';
    assert.equal((await rig.host.turn.reread(at)).ok, true);
    await settle();
    assert.equal(mira(rig).status, 'rested', 'the edited line applies');
    const live = plain(rig.host.head());
    await rig.host.store.rebuild();
    assert.deepEqual(plain(rig.host.head()), live, 'rebuild equals live after the Re-read');
    await rig.host.st.deleteMessage(at);
    await settle();
    assert.equal(mira(rig).status, undefined, 'a rewind takes the reply\'s fields away');
});

test('a Continue of a reply that had a ~ npc line: the line stays applied once and replay equals live', async t => {
    const rig = await peopleRig(t);
    await rig.reply('Mira is here.');
    await rig.host.send('Next.', `Next reply.${LINE}`);
    await settle();
    await rig.host.cont(' And then more.');
    await settle();
    assert.equal(mira(rig).status, 'tired');
    assert.equal(mira(rig).goal, 'from the line');
    const live = plain(rig.host.head());
    await rig.host.store.rebuild();
    assert.deepEqual(plain(rig.host.head()), live, 'rebuild equals live after the Continue');
});
