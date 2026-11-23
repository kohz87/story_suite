// The sheet seams a plug-in sheet module uses: a row's own command names and its Create character screen (the plain `party.newCharacter` answer); absent, the view-model is as before.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectParty } from '../../../ui/select/party.js';
import { PARTY_SHAPE } from '../../../ui/contract/party.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { checkShape } from '../../../ui/contract/shapes.js';

const actors = [{ id: 'a', name: 'A', pc: true }, { id: 'b', name: 'B' }];
const pick = (sheet, newCharacter) => selectParty({ actors, pc: { id: 'a' }, levels: [], gear: {}, sheet, newCharacter });

describe('selectParty sheet seams', () => {
  it('passes a row\'s spend and skillEdit command names through, and the party.newCharacter screen', () => {
    const vm = pick([{ id: 'a', commands: { spend: 'textRpg.spend', skillEdit: 'textRpg.skillEdit', other: 'x.y' } }, { id: 'b' }], 'text-rpg/create');
    assert.deepEqual(vm.members[0].commands, { spend: 'textRpg.spend', skillEdit: 'textRpg.skillEdit' });
    assert.equal('commands' in vm.members[1], false);
    assert.equal(vm.newCharacterScreen, 'text-rpg/create');
    assert.deepEqual(checkShape(vm, PARTY_SHAPE).filter(e => /commands|newCharacterScreen/.test(e)), [], 'the new keys fit the contract (the other gaps are this sparse fixture\'s)');
  });

  it('drops non-strings, empty and over-long (> 80) names; nothing named leaves the keys absent', () => {
    const vm = pick([{ id: 'a', commands: { spend: 5, skillEdit: 'x'.repeat(81) } }, { id: 'b', commands: { spend: '' } }], 'y'.repeat(81));
    assert.equal('commands' in vm.members[0], false);
    assert.equal('commands' in vm.members[1], false);
    assert.equal('newCharacterScreen' in vm, false);
    assert.equal(pick(undefined, 7).newCharacterScreen, undefined);
    assert.equal(pick(undefined, null).newCharacterScreen, undefined, 'null (or unregistered) keeps today\'s path');
    assert.equal(pick([{ id: 'a', newCharacterScreen: 'text-rpg/create' }]).newCharacterScreen, undefined, 'a row no longer names the screen');
    assert.equal('commands' in pick(undefined).members[0], false);
  });

  it('accepts a row command name only when it is a plain name', () => {
    const vm = pick([{ id: 'a', commands: { spend: 'bad name', skillEdit: '1x' } }, { id: 'b', commands: { spend: 'ok.name-1', skillEdit: 'x/y' } }]);
    assert.equal('commands' in vm.members[0], false);
    assert.deepEqual(vm.members[1].commands, { spend: 'ok.name-1' });
  });

  it('an empty party that a plug-in sheet answers with a Create character screen still offers it; unregistered or null keeps today\'s path', () => {
    const party = answers => buildSelectors(() => ({ chat: [] }), null).party(name => answers[name] ?? null);
    const own = party({ 'party.actors': [], 'party.newCharacter': 'text-rpg/new-character' });
    assert.deepEqual([own.newCharacter, own.newCharacterScreen, own.members.length], [true, 'text-rpg/new-character', 0]);
    assert.equal(party({ 'party.actors': [], 'party.newCharacter': null }), null);
    assert.equal(party({ 'party.actors': [] }), null);
  });
});
