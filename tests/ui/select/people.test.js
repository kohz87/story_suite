import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectPeople } from '../../../ui/select/people.js';
import { PEOPLE_SHAPE } from '../../../ui/contract/people.js';
import { checkShape } from '../../../ui/contract/shapes.js';

// Answers as the real queries give them (recorded by hand from the code, no replica needed).
// npc.present { meters: true }: packages/npc-state-delta/src/adapter/queries.js:200-208 ([{ name, meters, stages }]).
const PRESENT = [
  { name: 'Sister Temiwa', meters: { trust: 22, affection: 9, desire: 0, tension: -4 }, stages: {} },
  { name: 'Torka', meters: { trust: 41, affection: 28, desire: 6, tension: 12 }, stages: {} },
];
// npc.known: adapter/queries.js:209 (names of every tracked, not archived NPC).
const KNOWN = ['Sister Temiwa', 'Torka', 'Rika', 'Old Marro'];
// npc.dossier: adapter/queries.js:215-237, fields from DOSSIER_FIELDS (packages/npc-state-delta/src/fields/registry.js:215), meters added at :225-229.
const DOSSIERS = {
  'Sister Temiwa': { id: 'np_1', name: 'Sister Temiwa', role: 'Guild chaplain at Bluewatch', mood: 'wary hope', location: 'by the notice board', lifeState: 'alive', present: true },
  Torka: { id: 'np_2', name: 'Torka', role: 'Sellsword', location: 'leaning on the counter, sword across her back, arguing the pay', lifeState: 'alive', present: true },
  Rika: { id: 'np_3', name: 'Rika', location: 'At the Bluewatch stables', lifeState: 'alive', present: false, meters: { trust: 5, affection: 1, desire: 0, tension: 0 } },
  'Old Marro': { id: 'np_4', name: 'Old Marro', role: 'Toll keeper', lifeState: 'deceased', relationship: { trust: 15, affection: 5, desire: 0, tension: 0 } },
};
// director.keyPeople.view: packages/story-director/src/v2/keypeople/queries.js:180-228 (people: [{ key, name, here, away, place, newsAgo, … }]).
const KEY_PEOPLE = { on: true, people: [
  { key: 'sister temiwa', name: 'Sister Temiwa', here: true, away: false, place: '', newsAgo: '' },
  { key: 'rika', name: 'Rika', here: false, away: true, place: 'Bluewatch stables', newsAgo: '2 days ago' },
] };
// party.actors: packages/story-block/src/v2/lean-rpg/roster.js:57 ([{ id, name, pc? }]).
const PARTY = [{ id: 'astra', name: 'Astra', pc: true }, { id: 'torka', name: 'Torka' }];
const PORTRAITS = { Torka: 'https://example.invalid/torka.png', Rika: null };
const ARGS = { present: PRESENT, known: KNOWN, dossiers: DOSSIERS, keyPeople: KEY_PEOPLE, party: PARTY, portraits: PORTRAITS };

describe('selectPeople', () => {
  it('splits here, elsewhere and deceased, and matches PEOPLE_SHAPE', () => {
    const vm = selectPeople(ARGS);
    assert.deepEqual(checkShape(vm, PEOPLE_SHAPE), []);
    assert.deepEqual(vm.here.map(c => c.name), ['Sister Temiwa', 'Torka']);
    assert.deepEqual(vm.elsewhere.map(c => c.name), ['Rika']);
    assert.deepEqual(vm.deceased.map(c => c.name), ['Old Marro']);
  });

  it('reads followed from keyPeople, inParty from party.actors, meters and portraits from their answers', () => {
    const vm = selectPeople(ARGS);
    const [temiwa, torka] = vm.here;
    assert.equal(temiwa.followed, true);
    assert.equal(temiwa.inParty, false);
    assert.equal(torka.inParty, true);
    assert.equal(torka.followed, false);
    assert.deepEqual(temiwa.meters, { trust: 22, affection: 9, desire: 0, tension: -4 });
    assert.equal(torka.portrait, 'https://example.invalid/torka.png');
    assert.equal(temiwa.portrait, null);
    assert.equal(temiwa.personId, 'np_1');
    assert.equal(temiwa.role, 'Guild chaplain at Bluewatch');
  });

  it('cuts where to 40 characters and keeps mood or null', () => {
    const [temiwa, torka] = selectPeople(ARGS).here;
    assert.equal(temiwa.mood, 'wary hope');
    assert.equal(torka.mood, null);
    assert.ok(torka.where.length <= 40);
    assert.ok(torka.where.endsWith('…'));
  });

  it('gives an away person their place and how long ago, with said still a gap', () => {
    const [rika] = selectPeople(ARGS).elsewhere;
    assert.equal(rika.lastPlace, 'Bluewatch stables');
    assert.equal(rika.lastSeen, '2 days ago');
    assert.equal(rika.said, null);
    assert.deepEqual(rika.meters, { trust: 5, affection: 1, desire: 0, tension: 0 }, 'meters come from the dossier when npc.present has no row');
  });

  it('falls back to the dossier location for lastPlace when nobody follows them', () => {
    const vm = selectPeople({ ...ARGS, keyPeople: null });
    assert.equal(vm.elsewhere[0].lastPlace, 'At the Bluewatch stables');
    assert.equal(vm.elsewhere[0].lastSeen, null);
    assert.equal(vm.elsewhere[0].followed, false);
  });

  it('puts the deceased on a Death card with empty when and where, and presumed only when the dossier says inferred', () => {
    const [marro] = selectPeople(ARGS).deceased;
    assert.deepEqual(marro.death, { how: '', when: '', where: null, presumed: false });
    assert.deepEqual(marro.meters, { trust: 15, affection: 5, desire: 0, tension: 0 });
    const dossiers = { ...DOSSIERS, 'Old Marro': { ...DOSSIERS['Old Marro'], lifeStateCertainty: 'inferred', lifeStateReason: 'Swept off the ford' } };
    assert.deepEqual(selectPeople({ ...ARGS, dossiers }).deceased[0].death, { how: 'Swept off the ford', when: '', where: null, presumed: true });
  });

  it('counts active people, party, followed and deceased; dormant is a gap so 0', () => {
    const { counts, notSeenLately } = selectPeople(ARGS);
    assert.deepEqual(counts, { all: 3, party: 1, followed: 2, deceased: 1, notSeenLately: 0 });
    assert.equal(notSeenLately, 0);
  });

  it('accepts a plain name list for npc.present, lists each person once, and falls back to the slice cast mood', () => {
    const vm = selectPeople({ ...ARGS, present: ['Torka', 'torka'], cast: [{ key: 'torka', name: 'Torka', mood: { word: 'restless' } }] });
    assert.deepEqual(vm.here.map(c => c.name), ['Torka']);
    assert.equal(vm.here[0].mood, 'restless');
    assert.deepEqual(vm.here[0].meters, { trust: 0, affection: 0, desire: 0, tension: 0 });
    assert.equal(vm.elsewhere.length, 2);
  });

  it('returns null when npc.known gave no answer, an empty view for an empty cast, and keeps only a valid filter', () => {
    assert.equal(selectPeople({}), null);
    assert.equal(selectPeople(), null);
    const empty = selectPeople({ present: [], known: [] });
    assert.deepEqual(checkShape(empty, PEOPLE_SHAPE), []);
    assert.deepEqual(empty.counts, { all: 0, party: 0, followed: 0, deceased: 0, notSeenLately: 0 });
    assert.equal(selectPeople({ ...ARGS, filter: 'party' }).filter, 'party');
    assert.equal(selectPeople({ ...ARGS, filter: 'nobody' }).filter, 'all');
  });

  it('has no ties key (People > Map has no v2 query)', () => {
    assert.equal('ties' in selectPeople(ARGS), false);
  });
});
