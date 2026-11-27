// Gear's sixth stat is WIS: a WIS point worn is in the hero's WIS on the sheet; a piece saved with LUK (an older save, a story line, a pack) counts as WIS, no point lost.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../testkit/index.js';
import { COMBAT_V1_TEMPLATES } from '../../../../modules/rpg/templates-combat.js';
import { readSheet } from '../../../../modules/rpg/read.js';
import { gearQuery } from '../../../../modules/rpg/board/gear-query.js';
import { sheetWithGear } from '../../../../modules/rpg/gear.js';
import { readItem } from '../../../../modules/rpg/charfile-parts/read-entries.js';
import { applyGear } from '../../../../modules/rpg/gear.js';
import { GEAR, statsFor, statsOf } from '../../../../modules/inventory/gear.js';
import { defNamed, equip, reply } from '../../inventory/gear-inventory.helpers.js';

async function world(t, line) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ settings: { features: { 'story-block.gear': true, 'story-block.rpg': true } } });
    t.after(() => host.close());
    await host.send('Begin.', 'Opening.');
    for (const { definition } of COMBAT_V1_TEMPLATES) {
        const made = structuredClone(definition);
        if (made.slug === 'skills') delete made.state.practice1.edit;
        assert.equal((await host.sdk.command('dm.define', { definition: made })).ok, true);
    }
    await host.sdk.command('dm.set', { module: 'pack.chat/character', fields: { who: 'Ren' } });
    await host.sdk.command('dm.set', { module: 'pack.chat/character', fields: { wis: 9 } });
    await host.send('Charm.', reply('Charm.', [line]));
    return host;
}
const wisOf = host => sheetWithGear(readSheet(host.head()), gearQuery(host.head())).characters[0].stats.wis;

test('gear\'s sixth stat is WIS, and the sheet\'s WIS has the worn point', async t => {
    assert.deepEqual(GEAR.stats, ['STR', 'VIT', 'AGI', 'DEX', 'INT', 'WIS', 'CHA']);
    const host = await world(t, '+ item Sage Charm | slot: head | rarity: uncommon | WIS: 2');
    assert.equal(wisOf(host), 9, 'not worn yet');
    await equip(host, 'Sage Charm');
    assert.deepEqual(defNamed(host, 'Sage Charm').stats, { WIS: 2 });
    assert.equal(wisOf(host), 11);
});

test('a story line that says LUK, and a def saved with LUK (an older save), both give WIS', async t => {
    const host = await world(t, '+ item Luck Charm | slot: head | rarity: uncommon | LUK: 2');
    assert.deepEqual(defNamed(host, 'Luck Charm').stats, { WIS: 2 }, 'the line\'s LUK is kept as WIS');
    await equip(host, 'Luck Charm');
    assert.equal(wisOf(host), 11, 'no point lost');
});

test('an older save\'s def or piece with LUK (stored as it was) is read as WIS, beside a WIS adding up, and a pack item\'s LUK too', () => {
    const def = { name: 'Old Charm', slot: 'head', rarity: 'rare', stats: { LUK: 2 } };
    assert.deepEqual(statsFor(def), { WIS: 2 });
    assert.deepEqual(statsFor({ ...def, stats: { luk: 1, WIS: 1 } }), { WIS: 2 });
    assert.deepEqual(statsFor(def, { stats: { LUK: 3 } }), { WIS: 3 }, 'the reader\'s own pick on a piece');
    assert.deepEqual(statsFor({ id: 'pack.x/ring', name: 'Ring', slot: 'accessory', bonus: 2, stats: { LUK: 2 } }), { WIS: 2 });
    assert.deepEqual(statsOf({ LUK: 1, STR: 2, MAG: 5 }), { WIS: 1, STR: 2 });
});

test('a character file\'s piece with LUK reads as WIS; a sheet of the earlier rules (LUK, no WIS) still gets the gear\'s WIS on its LUK', () => {
    assert.deepEqual(readItem({ name: 'Old Ring', qty: 1, kind: 'equipment', stats: { LUK: 2, STR: 1 } }).stats, { WIS: 2, STR: 1 });
    assert.deepEqual(readItem({ name: 'Ring', qty: 1, kind: 'equipment', stats: { LUK: 1, WIS: 1 } }).stats, { WIS: 2 });
    const sheet = { characters: [{ key: 'ren', stats: { str: 5, luk: 6 } }] };
    assert.equal(applyGear(sheet, { v: 1, who: { ren: { own: ['party'], add: { wis: 2 } } } }).characters[0].stats.luk, 8);
});

test('a story line with both WIS and an old LUK adds them; a file piece whose LUK and WIS pass 6 is held to 6, not dropped', async t => {
    const host = await world(t, '+ item Twin Charm | slot: head | rarity: epic | WIS: 1 | LUK: 1 | STR: 2');
    assert.deepEqual(defNamed(host, 'Twin Charm').stats, { WIS: 2, STR: 2 });
    assert.deepEqual(readItem({ name: 'Big Ring', qty: 1, kind: 'equipment', stats: { LUK: 4, WIS: 3 } }).stats, { WIS: 6 });
});
