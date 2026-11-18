import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcRecord } from '../../modules/people/core/core.js';
import { addUserDismissedGroup, clearUserDismissedGroupsFor, normalizeUserDismissedGroups } from '../../modules/people/core/dismissed-groups.js';
import { decodeStateFilePayload, encodeStateFilePayload } from '../../modules/people/storage/storage-payload.js';


test('historical ids can be attached to one deletion tombstone for old branch snapshots',()=>{
  const deleted=createNpcRecord('Mina'); deleted.id='npc_current';
  const groups=addUserDismissedGroup([],deleted,{historicalNpcIds:['npc_interim']});
  assert.deepEqual(normalizeUserDismissedGroups(groups)[0].ids.sort(),['npc_current','npc_interim']);
});



test('same-name different-id explicit add/import does not clear a modern deletion tombstone',()=>{
  const deleted=createNpcRecord('Mina'); deleted.id='npc_old';
  const groups=addUserDismissedGroup([],deleted);
  const homonym=createNpcRecord('Mina'); homonym.id='npc_new';
  const cleared=clearUserDismissedGroupsFor(groups,homonym,{modernByIdOnly:true});
  assert.equal(cleared.groups.length,1);
  assert.deepEqual(cleared.removedIds,[]);
  const resurrected=clearUserDismissedGroupsFor(groups,deleted,{modernByIdOnly:true});
  assert.equal(resurrected.groups.length,0);
  assert.deepEqual(resurrected.removedIds,['npc_old']);
});


test('explicit manual name-based tombstone clearing remains available',()=>{
  const deleted=createNpcRecord('Mina'); deleted.id='npc_old'; deleted.aliases=['The Innkeeper'];
  const groups=addUserDismissedGroup([],deleted);
  const cleared=clearUserDismissedGroupsFor(groups,'Mina');
  assert.equal(cleared.groups.length,0);
  assert.ok(cleared.removedIds.includes('npc_old'));
  assert.ok(cleared.removedLabels.includes('the innkeeper'));
});

// B4-10a: the branch journal is gone. A sidecar is written as plain format 1 with no checkpoints; one saved with packed checkpoints (format 2)
// still loads, its packing header and checkpoints dropped unread.
test('a sidecar is written as format 1 without checkpoints, and a format 2 file with packed checkpoints still loads without them', () => {
  const mina = createNpcRecord('Mina'); mina.id = 'npc_mina';
  const written = JSON.parse(encodeStateFilePayload('chat:a.png:one', { npcs: [mina], lineage: ['a'] }));
  assert.equal(written.formatVersion, 1);
  assert.equal('packing' in written, false);
  assert.equal('checkpoints' in written.state, false);
  const old = JSON.stringify({ format: 'npc_state_delta_chat_data', formatVersion: 2, chatKey: 'chat:a.png:one', revision: 3,
    packing: { scheme: 'chain-rfc6902', anchorEvery: 25, fullTail: 4, maxChainEntries: 80 },
    state: { npcs: [mina], checkpoints: [{ messageId: 1, patch: [{ op: 'replace', path: '/npcs/0/trust', value: 2 }], base: 0 }] } });
  const loaded = decodeStateFilePayload(old);
  assert.equal(loaded.revision, 3);
  assert.equal('packing' in loaded, false);
  assert.equal('checkpoints' in loaded.state, false);
  assert.deepEqual(loaded.state.npcs.map(npc => npc.id), ['npc_mina']);
});
