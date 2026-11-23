// The sheet seams a plug-in sheet module uses: a row's own command names and its Create character screen; absent, the view-model is as before.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectParty } from '../../../ui/select/party.js';
import { PARTY_SHAPE } from '../../../ui/contract/party.js';
import { checkShape } from '../../../ui/contract/shapes.js';

const actors = [{ id: 'a', name: 'A', pc: true }, { id: 'b', name: 'B' }];
const pick = sheet => selectParty({ actors, pc: { id: 'a' }, levels: [], gear: {}, sheet });

describe('selectParty sheet seams', () => {
  it('passes a row\'s spend and skillEdit command names through, and the first newCharacterScreen', () => {
    const vm = pick([{ id: 'a', commands: { spend: 'textRpg.spend', skillEdit: 'textRpg.skillEdit', other: 'x.y' } }, { id: 'b', newCharacterScreen: 'text-rpg/create' }, { id: 'c', newCharacterScreen: 'later' }]);
    assert.deepEqual(vm.members[0].commands, { spend: 'textRpg.spend', skillEdit: 'textRpg.skillEdit' });
    assert.equal('commands' in vm.members[1], false);
    assert.equal(vm.newCharacterScreen, 'text-rpg/create');
    assert.deepEqual(checkShape(vm, PARTY_SHAPE).filter(e => /commands|newCharacterScreen/.test(e)), [], 'the new keys fit the contract (the other gaps are this sparse fixture\'s)');
  });

  it('drops non-strings, empty and over-long (> 80) names; nothing named leaves the keys absent', () => {
    const vm = pick([{ id: 'a', commands: { spend: 5, skillEdit: 'x'.repeat(81) }, newCharacterScreen: 'y'.repeat(81) }, { id: 'b', commands: { spend: '' }, newCharacterScreen: 7 }]);
    assert.equal('commands' in vm.members[0], false);
    assert.equal('commands' in vm.members[1], false);
    assert.equal('newCharacterScreen' in vm, false);
    assert.equal(pick(undefined).newCharacterScreen, undefined);
    assert.equal('commands' in pick(undefined).members[0], false);
  });
});
