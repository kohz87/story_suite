// A saved character file imported into the New character wizard: the draft it makes (wizard-data's withImport) and what Create (create-run.js) makes from it.
import test from "node:test";
import assert from "node:assert/strict";
import { parseCharacterFile } from "../../../../modules/rpg/charfile.js";
import { TOLD } from "../../../../modules/inventory/index.js";
import { STATS } from "../../../../modules/rpg/index.js";
import { newDraft, pointsLeft, statBounds, withoutImport } from "../../../../modules/rpg/view/wizard-data.js";
import { reload } from "../../data-modules/helpers.js";
import { fieldsOf, page } from "./page.js";
import { GEAR_FILE, SAVED, carried, createRen, defsOf, importedDraft, names, newcomer, purseOf, receiptTypes } from "./char-export.helpers.js";
import { create, draftOf } from "./wizard.helpers.js";

test('stats the file put above 10 or below 5 stay where they were; the rest keep the creation range', () => {
    const saved = JSON.parse(SAVED);
    saved.stats = { ...saved.stats, str: 18, cha: 3 };
    const { draft } = importedDraft(JSON.stringify(saved), 'Ren');
    assert.equal(draft.stats.str, 18);
    assert.deepEqual(statBounds(draft, 'str'), [5, 18], 'STR 18 can go down to 5, not further up');
    assert.deepEqual(statBounds(draft, 'cha'), [3, 10], 'CHA 3 can come up (to 10), not further down');
    assert.deepEqual(statBounds(draft, 'vit'), [5, 12], 'the others: the creation range, widened to where the file had them');
    assert.equal(pointsLeft(draft), 3, 'the file\'s own unspent points');
    assert.equal(pointsLeft({ ...draft, stats: { ...draft.stats, str: 14 } }), 7, 'STR 14 frees four');
});

test('Undo import puts the draft back as it was before, and a typed name is kept', () => {
    const base = { ...draftOf('Ren', 'companion'), stats: { ...newDraft({ persona: 'Wessel' }).stats, str: 7 } };
    const { draft, before } = importedDraft(SAVED, 'Ren');
    assert.equal(draft.skills.length, 2);
    assert.equal(draft.set, '');
    const back = withoutImport({ ...draft, name: 'Renata' }, before);
    assert.deepEqual([back.name, back.skills, back.from, back.level], ['Renata', [], undefined, undefined]);
    assert.deepEqual(withoutImport(draft, { ...before, stats: base.stats }).stats, base.stats);
});

// ---- Create with an import ----------------------------------------------------------------------------------------------------------

test('Create makes the Character and Skills blocks from the file, adds the things and the money, all in one reply, and one swipe takes it all back', async t => {
    const ctx = await newcomer(t);
    assert.equal((await ctx.host.sdk.command('wallet.set', { amount: 20 })).ok, true);
    const blocksBefore = names(ctx.host);
    const receiptsBefore = receiptTypes(ctx.host).length;
    assert.deepEqual(await createRen(ctx), { ok: true, finished: '' }, 'everything fit');
    const made = receiptTypes(ctx.host).slice(receiptsBefore);
    assert.deepEqual(made, ['dm.define', 'dm.define', 'dm.define', 'dm.define', 'inventory.add', 'inventory.add', 'inventory.add', 'wallet.set'], 'blocks, then the things, then the purse: no dm.set');
    assert.deepEqual(names(ctx.host), [...blocksBefore, 'pack.chat/combat-rules', 'pack.chat/foes', 'pack.chat/ren', 'pack.chat/ren-skills'].sort());

    const ren = fieldsOf(ctx.host, 'pack.chat/ren'), skills = fieldsOf(ctx.host, 'pack.chat/ren-skills');
    assert.deepEqual([ren.who, ren.level, ren.points, ren.xp, ren.hp, ren.mp, ren.sp, ren.alive], ['Ren', 15, 3, 0, 16, 15, 17, true],
        'the file\'s level and points; the reader\'s name and who they are; XP 0 and full bars (HP from VIT, MP from INT and WIS, SP from STR and AGI, and the level)');
    assert.deepEqual(STATS.map(stat => ren[stat]), [14, 12, 11, 10, 8, 9, 10]);
    assert.deepEqual([skills.who, skills.skill1, skills.about1, skills.stat1, skills.type1, skills.rank1, skills.practice1, skills.skill2, skills.rank2, skills.skill3], ['Ren', 'Iron Breath', 'Steadies the lungs in a long fight.', 'vit', 'attack', 2, 200, 'Short blade', 0, '']);
    assert.deepEqual(carried(ctx.host), ['Bedroll', 'Oilskin Coat', 'Torch ×2']);
    const coat = ctx.host.sdk.query('inventory.items', {}).find(item => item.name === 'Oilskin Coat');
    assert.deepEqual([coat.note, coat.kind, coat.rarity, coat.owner, coat.equipped], ['waxed, a little too big', 'equipment', 'uncommon', 'party', null], 'the note, kind and rarity the file kept');
    assert.equal(purseOf(ctx.host), 70, 'the file\'s 50 on top of the 20 already there');

    await reload(ctx.host);
    assert.deepEqual([carried(ctx.host), purseOf(ctx.host)], [['Bedroll', 'Oilskin Coat', 'Torch ×2'], 70], 'reload = live');
    ctx.host.store.rebuild();
    assert.deepEqual([carried(ctx.host), purseOf(ctx.host), names(ctx.host).includes('pack.chat/ren')], [['Bedroll', 'Oilskin Coat', 'Torch ×2'], 70, true], 'rebuild = live');

    await ctx.host.swipe('Another opening.');
    assert.deepEqual(names(ctx.host), [], 'one swipe: the blocks go with the reply');
    assert.deepEqual(carried(ctx.host), [], 'and the things');
    assert.equal(purseOf(ctx.host), 0, 'and the money (the 20 before came from the same reply)');
});

test('the things and the money an import adds are told under [Happened] as the starting kit and purse, not as found or paid in the story', async t => {
    const ctx = await newcomer(t);
    await createRen(ctx);
    const receipts = ctx.host.ctx.chat.flatMap(message => message.extra?.storySuite?.receipts ?? []);
    const things = receipts.filter(receipt => receipt.type === 'inventory.add'), purse = receipts.filter(receipt => receipt.type === 'wallet.set');
    assert.equal(things.length, 3);
    assert.equal(purse.length, 1);
    assert.ok(things.every(receipt => receipt.data.told === TOLD.startKit), 'every thing: the starting kit');
    assert.equal(purse[0].data.told, TOLD.startPurse);
    assert.match(purse[0].summary, /^You set the purse to /, 'the card\'s own words are the same');
});

test('the things and the money are the same reply\'s changes as the blocks: a swipe of a later reply leaves them', async t => {
    const ctx = await newcomer(t);
    await ctx.host.send('On.', 'A second reply.');
    await createRen(ctx);
    assert.deepEqual([carried(ctx.host).length, purseOf(ctx.host)], [3, 50]);
    await ctx.host.swipe('A different second reply.');
    assert.deepEqual([names(ctx.host).includes('pack.chat/ren'), carried(ctx.host).length, purseOf(ctx.host)], [false, 0, 0], 'all of it was on the head reply');
});

test('Create keeps every imported piece\'s slot and stats exactly, with Gear off (the default) and the carry the file kept', async t => {
    // The start of a new chat: nothing from the reader yet (the starting kit is open).
    const ctx = await page(t, { persona: 'Wessel' });
    const { draft, imported } = importedDraft(GEAR_FILE, 'Wessel', 'you');
    assert.equal((await create(ctx.host, draft, { imported })).ok, true);
    const def = name => defsOf(ctx.host).find(item => item.name === name);
    assert.deepEqual([def('Cane Sword').slot, def('Cane Sword').stats], ['weapon', { AGI: 1 }], 'AGI, not the name\'s DEX');
    assert.deepEqual([def('Traveling Robe').slot, def('Traveling Robe').stats], ['cloak', { AGI: 1 }], 'the cloak slot and AGI, not the name\'s body and VIT');
    assert.deepEqual([def('Linen Shoes').stats, def('Linen Clothes').stats], [{ AGI: 1 }, { VIT: 1 }]);
    assert.equal(def('Traveler\'s Slingbag').carry, 12, 'the carry the file kept is set as the reader\'s');
    assert.equal(def('Cane Sword').carry, undefined);
    // Written out again, the file carries the same things (stats, slots and the carry).
    const { itemsForFile } = await import('../../../../modules/rpg/charfile.js');
    const out = itemsForFile(ctx.host.sdk.query('inventory.items', {}));
    assert.deepEqual(out.find(item => item.name === 'Cane Sword'), { name: 'Cane Sword', qty: 1, note: 'Hidden blade inside a walking cane', kind: 'equipment', rarity: 'common', slot: 'weapon', stats: { AGI: 1 } });
    assert.equal(out.find(item => item.name === 'Traveler\'s Slingbag').carry, 12);
    await reload(ctx.host);
    assert.deepEqual(defsOf(ctx.host).find(item => item.name === 'Cane Sword').stats, { AGI: 1 }, 'reload = live');
});

// Gear on before Create (a): the pieces keep the file's stats and no "held" Problem says the starting kit was closed. Gear off at Create and on after (b): the rows show the file's stats.
for (const [label, before] of [['(a) Gear on before Create', true], ['(b) Gear off at Create, on afterwards', false]]) {
    test(`an imported character's pieces keep the file's stats: ${label}`, async t => {
        const ctx = await page(t, { persona: 'Wessel' });
        const gear = on => ctx.host.features.set('story-block.gear', on);
        if (before) gear(true);
        const { draft, imported } = importedDraft(GEAR_FILE, 'Wessel', 'you');
        assert.equal((await create(ctx.host, draft, { imported })).ok, true);
        gear(true);
        assert.doesNotMatch(JSON.stringify(ctx.host.turn.problems()), /came in as a Common piece/, 'no piece was held back: the starting kit was open');
        const row = name => ctx.host.sdk.query('inventory.items', {}).find(item => item.name === name);
        assert.deepEqual([row('Cane Sword').stats, row('Traveling Robe').slot, row('Traveling Robe').stats], [{ AGI: 1 }, 'cloak', { AGI: 1 }]);
    });
}

test('a file with no carry still loads and an item\'s carry is a whole number from 1 to 500', () => {
    assert.equal(parseCharacterFile(SAVED).ok, true);
    assert.equal(parseCharacterFile(SAVED).file.items.some(item => 'carry' in item), false, 'older files are unchanged');
    const one = carry => parseCharacterFile(JSON.stringify({ ...JSON.parse(SAVED), items: [{ name: 'Sack', qty: 1, carry }] })).file.items[0];
    assert.equal(one(500).carry, 500);
    for (const bad of [0, 501, 2.5, '9']) assert.equal('carry' in one(bad), false, `carry ${bad} is left out`);
});
