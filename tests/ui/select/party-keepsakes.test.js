import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { partyKeepsakes } from '../../../ui/select/party-keepsakes.js';
import { selectParty } from '../../../ui/select/party.js';
import { PARTY_SHAPE } from '../../../ui/contract/party.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { peopleQueries } from '../../../modules/people/domain/queries.js';

const ACTORS = [{ id: 'you', name: 'Astra' }, { id: 'torka', name: 'Torka' }, { id: 'rika', name: 'Rika' }, { id: 'brann', name: 'Brann' }];

// The real people.dossier over a small slice: it matches the name or an alias.
function reader(npcs) {
  const dossier = peopleQueries('people')['people.dossier'];
  const state = { domains: { people: { npcs, order: Object.keys(npcs) } } };
  const asked = [];
  return { asked, read: (name, args) => { asked.push([name, args]); return name === 'people.dossier' ? dossier(state, args) : null; } };
}

describe('partyKeepsakes', () => {
  it('finds each companion by name or alias and never asks for the reader\'s own character', () => {
    const { read, asked } = reader({
      a: { name: 'Astra', keepsakes: [{ name: 'Locket', description: 'hers' }] },
      b: { name: 'Torka', keepsakes: [{ name: 'Huge Spiked Iron Maul', description: 'her father\'s' }, 'Fang Charm'] },
      c: { name: 'Erika Vane', aliases: ['rika'], keepsakes: [{ name: 'Brass bit' }] },
      d: { name: 'Brann', keepsakes: [] },
    });
    assert.deepEqual(partyKeepsakes(read, ACTORS, 'you'), {
      torka: [{ name: 'Huge Spiked Iron Maul', note: 'her father\'s' }, { name: 'Fang Charm', note: '' }],
      rika: [{ name: 'Brass bit', note: '' }],
    });
    assert.deepEqual(asked.map(([, args]) => args.name), ['Torka', 'Rika', 'Brann']);
  });

  it('trims, drops nameless rows and caps the rows, names and notes', () => {
    const keepsakes = [{ name: '  ', description: 'no name' }, null, 7, { name: `  ${'n'.repeat(100)}`, description: 'd'.repeat(200) },
      ...Array.from({ length: 20 }, (_, i) => ({ name: ` Charm ${i} `, description: ' bone ' }))];
    const { read } = reader({ b: { name: 'Torka', keepsakes } });
    const { torka } = partyKeepsakes(read, ACTORS, 'you');
    assert.equal(torka.length, 12);
    assert.deepEqual([torka[0].name.length, torka[0].note.length], [80, 160]);
    assert.deepEqual(torka[1], { name: 'Charm 0', note: 'bone' });
  });

  it('answers {} with no people, no actors or no list', () => {
    assert.deepEqual(partyKeepsakes(() => null, ACTORS, 'you'), {});
    assert.deepEqual(partyKeepsakes(() => null, null, null), {});
    assert.deepEqual(partyKeepsakes(() => ({ keepsakes: 'Fang Charm' }), ACTORS, 'you'), {});
  });
});

describe('selectParty keepsakes', () => {
  it('puts them on their member ([] when none), apart from the gear slots, in the contract\'s shape', () => {
    const rows = [{ name: 'Fang Charm', note: '' }];
    const vm = selectParty({ actors: ACTORS, pc: { id: 'you' }, keepsakes: { torka: rows } });
    assert.deepEqual(vm.members.map(m => m.keepsakes), [[], rows, [], []]);
    assert.ok(vm.members[1].slots.every(slot => slot.item === null));
    assert.deepEqual(checkShape(vm, PARTY_SHAPE).filter(e => /keepsakes/.test(e)), []);
    assert.deepEqual(selectParty({ actors: ACTORS }).members[1].keepsakes, []);
  });
});
