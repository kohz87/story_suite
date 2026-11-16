// An edited Re-read of the reply whose people.write made the people slice (P4FIX2): the first write is stored as leaf changes on the initial slice,
// so the kept write replaying after the new capture does not reset the meter move the edited line made. Real NPC State adapter (peopleRig).
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleRig } from './helpers/people-rig.js';

const settle = () => new Promise(resolve => setTimeout(resolve, 60));
const trust = rig => rig.host.head().domains.people?.bonds?.npcs?.npc_mira?.meters?.trust;
const plain = value => JSON.parse(JSON.stringify(value));

test('a meter line added to the reply that made the slice, then a Re-read: the move is kept, the receipt matches, rebuild and reload equal live', async t => {
    let rig = await peopleRig(t);
    await rig.reply('Mira is here.');
    await settle();
    const at = rig.host.store.headIndex();
    assert.ok(rig.host.head().domains.people, 'the slice was made by this reply');
    const before = trust(rig) ?? 0;
    rig.host.ctx.chat[at].mes += '\n\n<Changes>\n~ npc MIRA | trust: +2\n</Changes>';
    const done = await rig.host.turn.reread(at);
    assert.equal(done.ok, true, done.message);
    await settle();
    assert.equal(trust(rig), before + 2, 'the state holds the move the card shows');
    assert.ok(rig.host.head().domains.people.order.includes('npc_mira'), 'and the dossier');
    assert.deepEqual(rig.host.store.problems(), []);
    const live = plain(rig.host.head());
    await rig.host.store.rebuild();
    assert.deepEqual(plain(rig.host.head()), live, 'rebuild equals live');
    rig = await rig.reload();
    assert.equal(await rig.settle(), true);
    assert.equal(trust(rig), before + 2, 'reload equals live');
});
