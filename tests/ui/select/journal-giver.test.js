// F53: a quest's giver opens their dossier: the name (or an alias) is matched to a stored person.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectJournal } from '../../../ui/select/journal.js';

const quest = { id: 'th_1', key: 'Witness for the Captain', kind: 'quest', status: 'active', summary: '', fields: { giver: 'Old Wen' }, offer: false, taken: true, ended: null, rev: 1 };
const read = people => (name, args) => (name === 'director.threads' ? (args?.status === 'resolved' ? [] : [quest]) : name === 'people.list' ? people : null);

describe('quest giver link', () => {
  it('carries the stored person\'s id when the giver\'s name or alias matches', () => {
    const vm = selectJournal(read([{ id: 'wenna', name: 'Wenna Coll', aliases: ['Old Wen'] }]));
    assert.equal(vm.quests[0].giver.personId, 'wenna');
    assert.equal(vm.quests[0].giver.name, 'Old Wen');
  });
  it('leaves it plain text when nobody stored answers to the name', () => {
    assert.equal(selectJournal(read([{ id: 'hesk', name: 'Hesk Dalla' }])).quests[0].giver.personId, null);
  });
});
