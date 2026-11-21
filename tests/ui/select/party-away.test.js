// The Party tab shows who is away only while "Companions who are away wait" is on; the Party sheet's rows keep nothing else changed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { awayShown } from '../../../ui/select/party-away.js';
import { selectParty } from '../../../ui/select/party.js';

const rows = [{ id: 'astra', away: null, line: 'Lv 5' }, { id: 'ren', away: { where: 'scouting the north road', lastSeen: '2 days ago', short: 'away' }, line: 'Lv 2' }];

test('off (or unset): the rows come back with no away; on: untouched', () => {
    for (const values of [undefined, {}, { rpgAwayWait: false }]) assert.deepEqual(awayShown(rows, values).map(row => row.away), [null, null]);
    assert.equal(awayShown(rows, { rpgAwayWait: true }), rows);
    assert.deepEqual(awayShown(null, {}), null);
    assert.equal(rows[1].away.where, 'scouting the north road', 'the input is not changed');
});

test('on: the Party member carries the away note', () => {
    const actors = [{ id: 'astra', name: 'Astra' }, { id: 'ren', name: 'Ren' }];
    const vm = selectParty({ actors, pc: { id: 'astra' }, levels: [], gear: {}, sheet: awayShown(rows, { rpgAwayWait: true }) });
    assert.equal(vm.members.find(member => member.id === 'ren').away.short, 'away');
    const off = selectParty({ actors, pc: { id: 'astra' }, levels: [], gear: {}, sheet: awayShown(rows, {}) });
    assert.equal(off.members.find(member => member.id === 'ren').away, null);
});
