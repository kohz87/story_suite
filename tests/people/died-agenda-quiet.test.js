// An unpinned person's own agenda goes quiet when a died line kills them, through the real host and NPC State adapter
// (npc.dossier hides a dead person by name; the Director finds her by the id npc.identity still gives). Deleting the reply, a reload: same read.
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleRig } from './helpers/people-rig.js';
import { quietThreads } from '../../modules/time/tracker/quiet.js';

const LETHAL = 'The blade fell.\n\n<Changes>\n~ npc MIRA | died | how: struck down at the gate\n</Changes>';
const settle = () => new Promise(resolve => setTimeout(resolve, 60));
const director = { threads: { t1: { id: 't1', status: 'active', kind: 'agenda', key: 'MIRA' } } };
const quiet = rig => [...quietThreads(director, { state: null, query: (name, args) => rig.host.sdk.query(name, args) })];

test('nobody pinned: a died line closes the dead person\'s agenda, delete brings it back, a reload reads the same', async t => {
    let rig = await peopleRig(t, { linesMode: true });
    await rig.reply('Mira is here.');
    assert.deepEqual(quiet(rig), [], 'alive: open');
    await rig.host.send('Go on.', LETHAL);
    await settle();
    assert.equal(rig.host.sdk.query('npc.dossier', { name: 'MIRA' }), null, 'by name the dead person is hidden');
    assert.deepEqual(quiet(rig), ['t1'], 'dead: quiet');
    rig = await rig.reload();
    await settle();
    assert.deepEqual(quiet(rig), ['t1'], 'after a reload: still quiet');
    await rig.host.st.deleteMessage(rig.host.ctx.chat.length - 1);
    await settle();
    assert.deepEqual(quiet(rig), [], 'lethal reply deleted: open again');
});
