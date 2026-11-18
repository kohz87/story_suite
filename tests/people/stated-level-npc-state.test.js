// F4 (main only, until the fight board's job R1): the fight board's stated level of a foe reads, through NPC State's own queries (npc.known, npc.dossier),
// the person's built-in Level first and the older "Level" custom field only without one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleRig, record } from './helpers/people-rig.js';
import { statedLevel } from '../../modules/rpg/board/stated-level.js';

test('a foe\'s stated level comes from NPC State: the built-in Level, else the custom field "Level"; nothing without either', async t => {
    const rig = await peopleRig(t);
    await rig.reply('Vorn and Ash wait at the gate.', state => {
        state.npcs.push(record('vorn', { name: 'Vorn', level: 30, customFields: { Level: '12' } }), record('ash', { name: 'Ash', customFields: { Level: 'Lv 18' } }), record('kel', { name: 'Kel' }));
    });
    const query = (name, args) => rig.host.sdk.query(name, args);
    assert.equal(query('npc.dossier', { name: 'Vorn' })?.level, 30, 'the dossier query carries the built-in Level');
    assert.deepEqual(statedLevel(query, 'Vorn'), { level: 30 }, 'the built-in Level wins over the custom field');
    assert.deepEqual(statedLevel(query, 'Ash'), { level: 18 }, 'no built-in Level: the custom field "Level" as before');
    assert.equal(statedLevel(query, 'Kel'), null, 'neither: the normal rules');
    assert.equal(statedLevel(query, 'Nobody'), null);
});
