import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectParty } from '../../../ui/select/party.js';
import { PARTY_SHAPE } from '../../../ui/contract/party.js';
import { checkShape } from '../../../ui/contract/shapes.js';

// Answers as the real queries give them:
// party.actors / party.pc: packages/story-block/src/v2/lean-rpg/roster.js:57-58 ([{ id, name, pc? }] and { id }).
const ACTORS = [{ id: 'astra', name: 'Astra', pc: true }, { id: 'brann', name: 'Brann' }];
const PC = { id: 'astra' };
// party.levels: roster.js:77-80 ([{ id, name, level, left }]).
const LEVELS = [{ id: 'astra', name: 'Astra', level: 14, left: false }, { id: 'brann', name: 'Brann', level: 9, left: false }, { id: 'old', name: 'Old', level: 3, left: true }];
// gear.view slots: domains/gear/views.js:94-98 ({ stack, name, rarity, bonus, cond, word, broken }).
const piece = (stack, name, rarity, word = 'good') => ({ stack, name, rarity, bonus: '', cond: 100, word, broken: word === 'broken' });
const GEAR = {
  astra: { on: true, slots: { weapon: piece('s1', 'Steel longsword', 'rare'), body: piece('s2', 'Travel leathers', 'common'), 'off-hand': piece('s3', 'Oak round shield', 'uncommon', 'torn'),
    head: null, cloak: null, feet: null, 'accessory-1': piece('s4', 'Silver ring', 'legendary'), 'accessory-2': null } },
  brann: { on: true, slots: { weapon: null, body: null, 'off-hand': null, head: null, cloak: null, feet: null, 'accessory-1': null, 'accessory-2': null } },
};

describe('selectParty', () => {
  it('builds members in actor order with level from party.levels and the pc id', () => {
    const vm = selectParty({ actors: ACTORS, pc: PC, levels: LEVELS, gear: GEAR });
    assert.equal(vm.pcId, 'astra');
    assert.deepEqual(vm.members.map(m => [m.id, m.name, m.level, m.line]), [['astra', 'Astra', 14, 'Lv 14'], ['brann', 'Brann', 9, 'Lv 9']]);
    assert.equal(vm.max, 4);
    assert.equal(vm.canInvite, true);
  });

  it('maps gear.view places to the ten contract slots, with mount and bag empty', () => {
    const [astra] = selectParty({ actors: ACTORS, pc: PC, levels: LEVELS, gear: GEAR }).members;
    assert.deepEqual(astra.slots.map(s => s.key), ['head', 'armor', 'cloak', 'feet', 'mount', 'weapon', 'offhand', 'accessory1', 'accessory2', 'bag']);
    const by = Object.fromEntries(astra.slots.map(s => [s.key, s.item]));
    assert.deepEqual(by.weapon, { stack: 's1', name: 'Steel longsword', rarity: 'rare', soak: null, torn: false });
    assert.equal(by.armor.name, 'Travel leathers');
    assert.equal(by.offhand.torn, true);
    assert.equal(by.accessory1.rarity, 'epic', 'legendary has no contract value, so it folds to epic');
    assert.equal(by.head, null);
    assert.equal(by.mount, null);
    assert.equal(by.bag, null);
  });

  it('returns gaps as null or empty when no sheet answers', () => {
    const [astra] = selectParty({ actors: ACTORS, pc: PC, levels: LEVELS, gear: GEAR }).members;
    assert.equal(astra.portrait, null);
    assert.equal(astra.xpPct, null);
    assert.equal(astra.points, null);
    assert.equal(astra.away, null);
    assert.equal(astra.soakPct, null);
    assert.equal(astra.stats, null);
    assert.deepEqual([astra.bars, astra.effects, astra.skills], [[], [], []]);
  });

  it('takes sheet rows when a future rpg.sheet answer carries them, and then matches PARTY_SHAPE except per-item soak', () => {
    const sheet = [{ id: 'astra', portrait: 'astra', line: 'Lv 14 · Shadow Blade', xpPct: 62, points: 1, soakPct: 11, away: { where: 'Stables', lastSeen: '8:00 am' },
      bars: [{ kind: 'hp', value: 12, max: 14 }], effects: [], stats: { STR: 6, DEX: 12, AGI: 12, VIT: 10, INT: 6, WIS: 6, CHA: 5 }, skills: [] },
      { id: 'brann', portrait: null, xpPct: 15, points: 0, soakPct: 17, bars: [], stats: { STR: 11, DEX: 7, AGI: 6, VIT: 12, INT: 5, WIS: 6, CHA: 6 } }];
    const vm = selectParty({ actors: ACTORS, pc: PC, levels: LEVELS, gear: GEAR, sheet });
    assert.equal(vm.members[0].line, 'Lv 14 · Shadow Blade');
    assert.equal(vm.members[0].away.where, 'Stables');
    assert.equal(vm.members[1].line, 'Lv 9');
    const errors = checkShape(vm, PARTY_SHAPE);
    assert.ok(errors.length > 0 && errors.every(e => /soak: expected number, got null/.test(e)), errors.join('\n'));
  });

  it('hides invite at four members and caps the roster at four', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, name: id.toUpperCase() }));
    const vm = selectParty({ actors: five, pc: { id: 'a' }, levels: [], gear: {} });
    assert.equal(vm.members.length, 4);
    assert.equal(vm.canInvite, false);
  });

  it('handles a member with no level, no gear answer and no pc', () => {
    const vm = selectParty({ actors: [{ id: 'x', name: 'X' }], pc: null, levels: [{ id: 'x', name: 'X', level: null, left: false }], gear: null });
    assert.equal(vm.pcId, null);
    assert.equal(vm.members[0].level, null);
    assert.equal(vm.members[0].line, '');
    assert.ok(vm.members[0].slots.every(s => s.item === null));
  });

  it('returns null while the RPG is off or there are no actors', () => {
    assert.equal(selectParty({ actors: null, pc: null }), null);
    assert.equal(selectParty({ actors: [] }), null);
    assert.equal(selectParty(), null);
  });
});
