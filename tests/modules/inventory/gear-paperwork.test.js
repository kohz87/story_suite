// Paperwork (goods or material named as a paper, pass, warrant, ...) weighs 0 by default; equipment and an item's own weight are untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { weightFor, defaultWeight } from '../../../modules/inventory/gear.js';

const goods = name => ({ id: 'story/x', name, kind: 'goods' });

test('the owner\'s papers weigh nothing, as goods or material, plurals too', () => {
    for (const name of ['Guild Tally Chit', 'Watchhouse Warrant', 'Hulkrow Warrant', 'Guild Promissory Note (30 Silver)', 'Inspector\'s Smuggling Note',
        'Sealed Letters', 'Gate Passes', 'Old Tallies', 'Ship\'s Manifest', 'Trade Licence', 'Land Deeds', 'Maps',
        'Ledger of Debts', 'Watchhouse Warrant (Second)', 'Writ of the Harbour Master', 'Pass (Gate of Dawn)']) {
        assert.equal(weightFor(goods(name)), 0, name);
        assert.equal(weightFor({ ...goods(name), kind: 'material' }), 0, `${name} (material)`);
    }
});

test('only the head noun, as a whole word: other things keep their weight', () => {
    for (const name of ['Drag Sheet & Rope', 'Passage Stone', 'Boar Tusks', 'Compass', 'Notebook', 'Paperweight', 'Mapmaker\'s Ink',
        'Map Case', 'Letter Opener', 'Paper Lantern', 'Scroll Case', 'Notice Board', 'Mountain Pass Stone', 'Printing Paper Press', 'Sheaf of Papers', 'Satchel (Letters)', 'Case of Maps']) {
        assert.equal(weightFor(goods(name)), 1, name);
    }
});

test('equipment, consumables and money keep their own rule', () => {
    assert.equal(defaultWeight({ name: 'Map Case', kind: 'equipment', slot: 'off-hand' }), 4);
    assert.equal(defaultWeight({ name: 'Warrant Badge', kind: 'equipment', slot: null }), 1);
    assert.equal(defaultWeight({ name: 'Scroll of Mending', kind: 'consumable' }), 1);
    assert.equal(weightFor({ name: 'Bank Note', kind: 'money' }), 0);
});

test('an item\'s own weight (a pack\'s or the reader\'s Edit) still wins', () => {
    assert.equal(weightFor({ ...goods('Heavy Ledger'), weight: 3 }), 3);
});
