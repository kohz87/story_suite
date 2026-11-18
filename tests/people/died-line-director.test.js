// A death written as a line (`~ npc Mira | died | how: …`, lines mode on) as the Director reads it through the real host and NPC State adapter:
// Mira leaves npc.known and npc.dossier says deceased; deleting the lethal reply brings her back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleRig } from './helpers/people-rig.js';

const LETHAL = 'The blade fell.\n\n<Changes>\n~ npc MIRA | died | how: struck down at the gate\n</Changes>';
const settle = () => new Promise(resolve => setTimeout(resolve, 60));
const known = rig => rig.host.sdk.query('npc.known', {});

test('a died line: Mira leaves npc.known, npc.dossier says deceased, and deleting the lethal reply brings her back', async t => {
    const rig = await peopleRig(t, { linesMode: true });
    await rig.reply('Mira is here.');
    const id = rig.host.sdk.query('npc.identity', { name: 'MIRA' }).id;
    assert.match(id, /^np_/);
    assert.ok(known(rig).includes('MIRA'), 'listed while alive');
    assert.equal(rig.host.sdk.query('npc.dossier', { id }).lifeState, 'alive');

    await rig.host.send('Go on.', LETHAL);
    await settle();
    assert.equal(rig.host.sdk.query('npc.dossier', { id }).lifeState, 'deceased', 'the dossier answers deceased');
    assert.equal(known(rig).includes('MIRA'), false, 'npc.known no longer lists her');

    await rig.host.st.deleteMessage(rig.host.ctx.chat.length - 1);
    await settle();
    assert.equal(rig.host.sdk.query('npc.dossier', { id })?.lifeState, 'alive', 'deleting the lethal reply: alive again');
    assert.ok(known(rig).includes('MIRA'));
});
