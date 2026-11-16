import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectPeople } from '../../../ui/select/people.js';
import { tieKind } from '../../../ui/select/tie-kinds.js';
import { PEOPLE_SHAPE } from '../../../ui/contract/people.js';
import { checkShape } from '../../../ui/contract/shapes.js';

// people.list rows (packages/story-block/src/v2/domains/people/queries.js): the store's people in dossier order.
const row = (id, name, extra = {}) => ({
  id, name, aliases: [], role: null, mood: null, location: null, status: null, present: false, followed: false, lifeState: 'alive', lifeStateCertainty: null,
  lifeStateReason: null, lastSeenTurn: null, dormant: false, meters: null, portrait: null, ...extra,
});
const LIST = [
  row('npc_sister_temiwa', 'Sister Temiwa', { role: 'Guild chaplain at Bluewatch', mood: 'wary hope', location: 'by the notice board', present: true, followed: true, meters: { trust: 22, affection: 9, desire: 0, tension: -4 } }),
  row('npc_torka', 'Torka', { present: true, location: 'leaning on the counter, sword across her back, arguing the pay', meters: { trust: 41, affection: 28, desire: 6, tension: 12 }, portrait: '/user/files/torka.webp' }),
  row('npc_rika', 'Rika', { location: 'At the Bluewatch stables', followed: true, meters: { trust: 5, affection: 1, desire: 0, tension: 0 } }),
  row('npc_old_marro', 'Old Marro', { role: 'Toll keeper', lifeState: 'deceased', lifeStateReason: 'a fall from the toll bridge' }),
  row('npc_hale', 'Hale', { location: 'the harbour', dormant: true, lastSeenTurn: 3 }),
];
// director.keyPeople.view: packages/story-director/src/v2/keypeople/queries.js:180-228 (people: [{ key, name, here, away, place, newsAgo, … }]).
const KEY_PEOPLE = { on: true, people: [{ key: 'rika', name: 'Rika', here: false, away: true, place: 'Bluewatch stables', newsAgo: '2 days ago' }] };
const PARTY = [{ id: 'astra', name: 'Astra', pc: true }, { id: 'torka', name: 'Torka' }];
const ARGS = { list: LIST, keyPeople: KEY_PEOPLE, party: PARTY };

describe('selectPeople', () => {
  it('splits here, elsewhere, not seen lately and deceased, and matches PEOPLE_SHAPE', () => {
    const vm = selectPeople(ARGS);
    assert.deepEqual(checkShape(vm, PEOPLE_SHAPE), []);
    assert.deepEqual(vm.here.map(c => c.name), ['Sister Temiwa', 'Torka']);
    assert.deepEqual(vm.elsewhere.map(c => c.name), ['Rika']);
    assert.deepEqual(vm.dormant.map(c => c.name), ['Hale']);
    assert.deepEqual(vm.deceased.map(c => c.name), ['Old Marro']);
  });

  it('carries the person id, the store Follow flag, party from party.actors, meters and the portrait', () => {
    const [temiwa, torka] = selectPeople(ARGS).here;
    assert.equal(temiwa.personId, 'npc_sister_temiwa');
    assert.equal(temiwa.followed, true);
    assert.equal(temiwa.inParty, false);
    assert.equal(torka.inParty, true);
    assert.equal(torka.followed, false);
    assert.deepEqual(temiwa.meters, { trust: 22, affection: 9, desire: 0, tension: -4 });
    assert.equal(torka.portrait, '/user/files/torka.webp');
    assert.equal(temiwa.portrait, null);
    assert.equal(temiwa.role, 'Guild chaplain at Bluewatch');
  });

  it('followed comes from the row, not from the key people', () => {
    const vm = selectPeople({ ...ARGS, keyPeople: { people: [{ name: 'Torka', place: 'x', newsAgo: 'y' }] } });
    assert.equal(vm.here.find(c => c.name === 'Torka').followed, false);
    assert.equal(vm.elsewhere[0].followed, true);
  });

  it('cuts where to 40 characters and keeps mood or null', () => {
    const [temiwa, torka] = selectPeople(ARGS).here;
    assert.equal(temiwa.mood, 'wary hope');
    assert.equal(torka.mood, null);
    assert.ok(torka.where.length <= 40);
    assert.ok(torka.where.endsWith('…'));
  });

  it('gives an away person their place and how long ago, with said still a gap, and the stored location without key-people news', () => {
    const [rika] = selectPeople(ARGS).elsewhere;
    assert.equal(rika.lastPlace, 'Bluewatch stables');
    assert.equal(rika.lastSeen, '2 days ago');
    assert.equal(rika.said, null);
    const bare = selectPeople({ ...ARGS, keyPeople: null }).elsewhere[0];
    assert.equal(bare.lastPlace, 'At the Bluewatch stables');
    assert.equal(bare.lastSeen, null);
  });

  it('puts the deceased on a Death card with empty when and where, presumed only when the record says inferred', () => {
    const [marro] = selectPeople(ARGS).deceased;
    assert.deepEqual(marro.death, { how: 'a fall from the toll bridge', when: '', where: null, presumed: false });
    const presumed = selectPeople({ list: [row('npc_a', 'A', { lifeState: 'deceased', lifeStateCertainty: 'inferred' })] }).deceased[0];
    assert.equal(presumed.death.presumed, true);
  });

  it('counts active people, party, followed, deceased and not seen lately; the dormant stay out of All', () => {
    const { counts, notSeenLately } = selectPeople(ARGS);
    assert.deepEqual(counts, { all: 3, party: 1, followed: 2, deceased: 1, notSeenLately: 1 });
    assert.equal(notSeenLately, 1);
  });

  it('a dormant person in the party stays in the lists as elsewhere, never dormant', () => {
    const vm = selectPeople({ list: [row('npc_torka', 'Torka', { dormant: true })], party: PARTY });
    assert.deepEqual(vm.dormant, []);
    assert.deepEqual(vm.elsewhere.map(c => c.name), ['Torka']);
  });

  it('an empty view while the chat has no people yet, and only a valid filter is kept', () => {
    for (const none of [selectPeople({}), selectPeople(), selectPeople({ list: null }), selectPeople({ list: [] })]) {
      assert.deepEqual(checkShape(none, PEOPLE_SHAPE), []);
      assert.deepEqual(none.counts, { all: 0, party: 0, followed: 0, deceased: 0, notSeenLately: 0 });
    }
    assert.equal(selectPeople({ ...ARGS, filter: 'party' }).filter, 'party');
    assert.equal(selectPeople({ ...ARGS, filter: 'nobody' }).filter, 'all');
  });

  it('draws ties from the stored edges whose text reads as one of the four kinds; the rest are left out', () => {
    const ties = [
      { aId: 'npc_torka', bId: 'npc_rika', aToB: 'older sister', bToA: 'little sister' },
      { aId: 'npc_torka', bId: 'npc_sister_temiwa', aToB: 'childhood friend', bToA: '' },
      { aId: 'npc_rika', bId: 'npc_hale', aToB: 'rival at the market', bToA: '' },
      { aId: 'npc_hale', bId: 'npc_torka', aToB: 'owes a debt', bToA: '' },
      { aId: 'npc_hale', bId: 'npc_rika', aToB: 'knows by sight', bToA: '' },
    ];
    const vm = selectPeople({ ...ARGS, ties });
    assert.deepEqual(vm.ties, [
      { a: 'npc_torka', b: 'npc_rika', kind: 'kin' }, { a: 'npc_torka', b: 'npc_sister_temiwa', kind: 'friend' },
      { a: 'npc_rika', b: 'npc_hale', kind: 'rival' }, { a: 'npc_hale', b: 'npc_torka', kind: 'owes' },
    ]);
    assert.deepEqual(checkShape(vm, PEOPLE_SHAPE), []);
    assert.equal('ties' in selectPeople(ARGS), false);
  });

  it('tieKind: rival before owes before kin before friend; "owed by" is not owes', () => {
    assert.equal(tieKind('enemy and sister', ''), 'rival');
    assert.equal(tieKind('', 'owes her a debt'), 'owes');
    assert.equal(tieKind('owed by', ''), null);
    assert.equal(tieKind('mentor', ''), 'friend');
    assert.equal(tieKind('', ''), null);
  });
});
