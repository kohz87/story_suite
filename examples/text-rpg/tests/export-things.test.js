// textRpg.export carries the bag and the purse: the RPG file's items and money, counted in the answer, left out on request, and read back by Text RPG's wizard and the RPG's parser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCharacterFile as rpgParse } from '../../../modules/rpg/charfile.js';
import { parseCharacterFile } from '../src/wizard/charfile.js';
import { addThings } from '../src/wizard/things.js';
import { itemsOfRows } from '../src/module-parts/export-things.js';
import { reply, withAstra, newHost, astraOf } from './helpers/host.js';

const stocked = async () => {
    const host = await withAstra({ 'story-block.gear': true });
    await host.send('Loot.', reply('Boots.', ['+ item Wolfhide Boots | slot: feet | +2 agi', '+ item Torch | qty: 3 | note: half burnt', '+ item Torch | qty: 2 | note: half burnt']));
    const set = await host.sdk.command('wallet.set', { owner: 'party', amount: 75, starting: true });
    assert.equal(set.ok, true, set.message);
    return host;
};

test('the export carries the party bag and the purse, counts them, and leaves them out when asked', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await stocked();
    t.after(() => host.close());
    const id = astraOf(host).id;
    const answer = host.sdk.query('textRpg.export', { id });
    const file = JSON.parse(answer.text);
    assert.equal(file.money, 75);
    assert.deepEqual(file.items.map(item => [item.name, item.qty]), [['Wolfhide Boots', 1], ['Torch', 5]]);
    assert.deepEqual([answer.items, answer.money], [2, 75]);
    const theirs = rpgParse(answer.text);
    assert.equal(theirs.ok, true, theirs.message);
    assert.deepEqual([theirs.file.items.map(item => [item.name, item.qty]), theirs.file.money], [[['Wolfhide Boots', 1], ['Torch', 5]], 75]);
    const bare = host.sdk.query('textRpg.export', { id, inventory: false, money: false });
    assert.deepEqual([bare.items, bare.money, 'items' in JSON.parse(bare.text), 'money' in JSON.parse(bare.text)], [2, 75, false, false]);
});

test('a saved Text RPG character comes back in a new chat with the same things and money', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await stocked();
    const text = host.sdk.query('textRpg.export', { id: astraOf(host).id }).text;
    host.close();
    const read = parseCharacterFile(text);
    assert.equal(read.ok, true, read.message);
    const fresh = await newHost();
    t.after(() => fresh.close());
    const made = await fresh.sdk.command('textRpg.create', { name: 'Astra', stats: read.file.stats, skills: read.file.skills, level: read.file.level, imported: true });
    assert.equal(made.ok, true, made.message);
    const failed = await addThings(read.file, (type, payload) => fresh.sdk.command(type, payload), (name, args) => fresh.sdk.query(name, args));
    assert.deepEqual(failed, []);
    const again = fresh.sdk.query('textRpg.export', { id: astraOf(fresh).id });
    assert.deepEqual([again.items, again.money], [2, 75]);
    assert.deepEqual(JSON.parse(again.text).items.map(item => [item.name, item.qty, item.note ?? null, item.slot ?? null]), JSON.parse(text).items.map(item => [item.name, item.qty, item.note ?? null, item.slot ?? null]));
});

test('the rows are held to the file\'s limits: 60 entries, counts added up to 999, rows the file cannot hold left out', () => {
    const rows = Array.from({ length: 70 }, (_, at) => ({ name: `Thing ${at}`, qty: 1 }));
    assert.equal(itemsOfRows(rows).length, 60);
    assert.equal(itemsOfRows([{ name: 'Arrow', qty: 600 }, { name: 'arrow', qty: 600 }])[0].qty, 999);
    assert.deepEqual(itemsOfRows([{ name: '', qty: 1 }, { name: 'Odd', qty: 0 }, null]), []);
});
