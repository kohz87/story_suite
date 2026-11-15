import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectDossier } from '../../../ui/select/dossier.js';
import { DOSSIER_SHAPE } from '../../../ui/contract/dossier.js';
import { checkShape } from '../../../ui/contract/shapes.js';

// npc.dossier: packages/npc-state-delta/src/adapter/queries.js:215-237 (DOSSIER_FIELDS, fields/registry.js:215; meters, stages, unlocked from npc.meters).
const DOSSIER = {
  id: 'np_1', name: 'Sister Temiwa', aliases: ['Tem'], role: 'Guild chaplain', species: 'Human', gender: 'Female', age: '26', homeBase: 'Bluewatch chapel',
  appearance: 'Tall, dark hair under a white veil.', personality: 'Careful with strangers.', speech: 'Quiet and precise.', background: 'Raised in the orphanage.',
  mannerisms: ['Folds her hands before answering'], behaviorProfile: ['Checks the door', 'Folds her hands before answering'],
  memories: ['Handed back the offering coin.', 'Met at the Guild Office.'],
  keyRelationships: ['Torka — childhood friend | Tem to her', 'The Harbour Master'],
  mood: 'wary hope', location: 'by the notice board', status: 'Waiting for the clerk', lifeState: 'alive', present: true,
  meters: { trust: 22, affection: 9, desire: 0, tension: -4 }, relationship: { trust: 1, affection: 1, desire: 1, tension: 1 }, stages: {}, unlocked: ['s1'],
};
// npc.meters({ name }) with `recent`: npc-meters-queries.js:17-35 and eventLog, npc-meters-pacing.js:126-128 (newest first).
const METERS = { key: 'sister temiwa', name: 'Sister Temiwa', meters: DOSSIER.meters, stages: {}, unlocked: ['s1'], recent: [
  { at: 12, date: 'Goldwane 13', mv: { trust: 2 }, held: false, why: 'handed back the coin' },
  { at: 11, date: 'Goldwane 11', mv: { affection: 5, tension: -4 }, held: false },
  { at: 10, date: 'Goldwane 9', ask: { affection: 8 }, held: true, note: 'she held back' },
] };
// npc.next: npc-meters-queries.js:47-77 (ladderView).
const NEXT = { rank: 'Acquaintance', next: { name: 'Friend', needs: [
  { meter: 'trust', label: 'Trust', value: 22, at: 30, below: false, met: false },
  { meter: 'affection', label: 'Affection', value: 9, at: 5, below: false, met: true },
], milestone: { name: 'a danger faced together', met: false }, held: false }, risk: null, text: 'Next: Friend' };
// npc.cast row: npc-meters-queries.js:176-203, notes from notesView :81-104.
const CAST = { key: 'sister temiwa', name: 'Sister Temiwa', present: true, mood: { word: 'hopeful' },
  opened: [{ id: 's1', title: 'Same orphanage as Torka', rule: 'Trust 15', text: 'Opened · Trust 15' }],
  locked: [{ id: 's2', event: false, opens: 'Opens at Trust 40', text: 'Hidden note · opens at Trust 40' }, { id: 's3', event: true, opens: 'Opens with the story', text: 'Hidden note · opens with the story' }] };
const KEY_PEOPLE = { people: [{ key: 'sister temiwa', name: 'Sister Temiwa', here: true, place: '', newsAgo: '' }] };
const ALL = { dossier: DOSSIER, meters: METERS, next: NEXT, cast: CAST, portrait: 'https://example.invalid/t.png', keyPeople: KEY_PEOPLE, party: [{ id: 'torka', name: 'Torka' }] };

describe('selectDossier', () => {
  it('builds the page and matches DOSSIER_SHAPE', () => {
    const vm = selectDossier(ALL);
    assert.deepEqual(checkShape(vm, DOSSIER_SHAPE), []);
    assert.equal(vm.id, 'np_1');
    assert.equal(vm.idLine, 'Human · female · 26');
    assert.equal(vm.life, 'alive');
    assert.equal(vm.genderUnknown, false);
    assert.equal(vm.following, true);
    assert.equal(vm.inParty, false);
    assert.equal(vm.portrait, 'https://example.invalid/t.png');
    assert.deepEqual(vm.meters, { trust: 22, affection: 9, desire: 0, tension: -4 });
  });

  it('reads the ladder into stage, listing only the unmet needs', () => {
    assert.deepEqual(selectDossier(ALL).stage, { now: 'Acquaintance', next: 'Friend', needs: 'Trust 30 and a danger faced together' });
    assert.equal(selectDossier({ dossier: DOSSIER }).stage, null);
  });

  it('turns recent rows into one change per meter, marking held rows', () => {
    const { changes } = selectDossier(ALL);
    assert.deepEqual(changes.map(c => [c.date, c.meter, c.delta, c.heldBack]), [
      ['Goldwane 13', 'trust', 2, false], ['Goldwane 11', 'affection', 5, false], ['Goldwane 11', 'tension', -4, false], ['Goldwane 9', 'affection', 8, true],
    ]);
    assert.equal(changes[0].why, 'handed back the coin');
    assert.equal(changes[3].why, 'she held back');
    assert.deepEqual(selectDossier({ dossier: DOSSIER }).changes, []);
  });

  it('gives Now for a present person, with wearing and thought as gaps, and Last seen for an away one', () => {
    assert.deepEqual(selectDossier(ALL).now, { where: 'by the notice board', doing: 'Waiting for the clerk', wearing: null, thought: null });
    const away = selectDossier({ dossier: { ...DOSSIER, present: false }, keyPeople: { people: [{ name: 'Sister Temiwa', place: 'Bluewatch stables', newsAgo: 'yesterday' }] } });
    assert.deepEqual(away.now, { lastPlace: 'Bluewatch stables', lastSeen: 'yesterday', said: null });
    assert.equal(away.following, true);
  });

  it('keeps scene null (hiding has no source) and mood from the dossier, else the cast row', () => {
    const vm = selectDossier(ALL);
    assert.equal(vm.scene, null);
    assert.equal(vm.mood, 'wary hope');
    assert.equal(selectDossier({ dossier: { ...DOSSIER, mood: '' }, cast: CAST }).mood, 'hopeful');
  });

  it('parses ties, past, secrets and the profile with merged habits', () => {
    const vm = selectDossier(ALL);
    assert.deepEqual(vm.ties, [{ personId: null, name: 'Torka', line: 'childhood friend · Tem to her' }, { personId: null, name: 'The Harbour Master', line: '' }]);
    assert.deepEqual(vm.past, [{ date: '', text: 'Handed back the offering coin.', dayRef: null }, { date: '', text: 'Met at the Guild Office.', dayRef: null }]);
    assert.deepEqual(vm.secrets, { opened: 1, total: 3, items: [
      { open: true, title: 'Same orphanage as Torka', rule: 'Opened · Trust 15', text: null },
      { open: false, title: null, rule: 'Opens at Trust 40', text: null },
      { open: false, title: null, rule: 'Opens with the story', text: null },
    ] });
    assert.equal(vm.profile.aliases, 'Tem');
    assert.equal(vm.profile.home, 'Bluewatch chapel');
    assert.equal(vm.profile.looks, 'Tall, dark hair under a white veil.');
    assert.deepEqual(vm.profile.habits, ['Folds her hands before answering', 'Checks the door']);
  });

  it('flags an unknown gender and writes it in the id line', () => {
    const vm = selectDossier({ dossier: { id: 'np_9', name: 'Dren', species: 'Human', gender: '' } });
    assert.equal(vm.genderUnknown, true);
    assert.equal(vm.idLine, 'Human · gender unknown');
    assert.equal(vm.profile.gender, null);
    assert.deepEqual(checkShape(vm, DOSSIER_SHAPE), []);
  });

  it('gives deceased people a Death card with empty when and where, presumed only when inferred, and no death otherwise', () => {
    const dead = selectDossier({ dossier: { ...DOSSIER, lifeState: 'deceased', present: true } });
    assert.equal(dead.life, 'deceased');
    assert.deepEqual(dead.death, { how: '', when: '', where: null, certainty: 'confirmed', referenceLine: '' });
    assert.equal('lastPlace' in dead.now, true, 'a dead person is never "here"');
    const presumed = selectDossier({ dossier: { ...DOSSIER, lifeState: 'deceased', lifeStateCertainty: 'inferred', lifeStateReason: 'Swept off the ford' } });
    assert.equal(presumed.life, 'presumed');
    assert.equal(presumed.death.certainty, 'presumed');
    assert.equal(presumed.death.how, 'Swept off the ford');
    assert.deepEqual(checkShape(presumed, DOSSIER_SHAPE), []);
    assert.equal(selectDossier(ALL).death, null);
  });

  it('returns null when npc.dossier gave no answer and zero meters without any', () => {
    assert.equal(selectDossier({}), null);
    assert.equal(selectDossier(), null);
    assert.equal(selectDossier({ dossier: null }), null);
    const bare = selectDossier({ dossier: { name: 'Nobody' } });
    assert.deepEqual(bare.meters, { trust: 0, affection: 0, desire: 0, tension: 0 });
    assert.equal(bare.id, 'nobody');
    assert.deepEqual(checkShape(bare, DOSSIER_SHAPE), []);
  });
});
