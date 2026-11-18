import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcRecord, mergeScanResult, npcNamedInText, setActiveCalendarConfig } from '../../modules/people/core/core.js';

test('BUG-08: a shared title or first name does not pull in other NPCs', () => {
    const roster = ['Lady Mira', 'Lady Noela', 'Lady Vera', 'Linnea Vael', 'Tomas Reed', 'Tomas Hale'].map(name => createNpcRecord(name));
    const named = text => roster.filter(npc => npcNamedInText(npc, text, roster)).map(npc => npc.name);
    assert.deepEqual(named('I ask Lady Mira to join me.'), ['Lady Mira']);
    assert.deepEqual(named('Lady, a word?'), []);
    assert.deepEqual(named('Linnea, come here.'), ['Linnea Vael'], 'a unique first name still counts');
    assert.deepEqual(named('Tomas, over here.'), [], 'an ambiguous first name selects nobody');
    assert.deepEqual(named('Tomas Hale waves.'), ['Tomas Hale']);
});

test('BUG-05: a scanned birthday correction needs support in the scanned text', () => {
    setActiveCalendarConfig({ era: 'CR', months: [{ name: 'Redleaf', days: 30 }, { name: 'Sunwane', days: 31 }], currentYear: 821, currentMonth: 'Redleaf', currentDay: 16 });
    try {
        const npc = createNpcRecord('Mira');
        npc.id = 'npc_mira';
        npc.age = '20';
        npc.birthDate = { era: 'CR', year: 801, month: 'Redleaf', day: 1 };
        npc.birthDateSource = 'established';
        npc.birthDateYearSource = 'established';
        const state = { npcs: [npc], candidates: [], turn: 3 };
        const correction = { npcs: [{ id: 'npc_mira', name: 'Mira', birthDate: { era: 'CR', year: 790, month: 'Redleaf', day: 2 }, birthDateState: 'correct', birthDateReason: 'Invented.' }] };
        const rejected = mergeScanResult(state, correction, { sourceMessageId: 9, developmentContext: 'Mira silently checks the account book.' }).state.npcs[0];
        assert.equal(rejected.birthDate.year, 801);
        assert.equal(rejected.age, '20');
        const grounded = mergeScanResult(state, correction, { sourceMessageId: 9, developmentContext: 'Mira admits she was born on Redleaf 2 in CR790, not CR801.' }).state.npcs[0];
        assert.equal(grounded.birthDate.year, 790, 'a stated correction still applies');
    } finally {
        setActiveCalendarConfig(null);
    }
});
