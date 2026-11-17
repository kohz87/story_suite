import test from "node:test";
import assert from "node:assert/strict";
import { CHAR_FILE, parseCharacterFile } from "../../../../modules/rpg/charfile.js";
import { TOLD } from "../../../../modules/inventory/index.js";
import { STATS } from "../../../../modules/rpg/index.js";
import { reload } from "../../data-modules/helpers.js";
import { fieldsOf, page, party, settle } from "./page.js";
import { GEAR_FILE, SAVED, carried, click, companion, createRen, defsOf, exportDialog, exportOf, goTo, importInto, names, newcomer, purseOf, receiptTypes, saveFrom, story, type, without, wizardOf, wizardWith } from "./char-export.helpers.js";

test('stats the file put above 15 or below 8 stay where they were; the rest keep the usual 8 to 15', async t => {
    const ctx = await newcomer(t);
    const dialog = await wizardWith(ctx);
    const saved = JSON.parse(SAVED);
    saved.stats = { ...saved.stats, str: 18, cha: 3 };
    await importInto(dialog, JSON.stringify(saved));
    const stats = await goTo(dialog, 'stats');
    const step = (stat, dir) => wizardOf(dialog).querySelector(`.rpg-stat-step[data-stat="${stat}"] .ss-w-stepper-${dir}`);
    assert.equal(stats.querySelector('.rpg-stat-step[data-stat="str"] input').value, '18');
    assert.deepEqual([step('str', 'inc').disabled, step('str', 'dec').disabled], [true, false], 'STR 18 can go down, not further up');
    assert.deepEqual([step('cha', 'dec').disabled, step('cha', 'inc').disabled], [true, false], 'CHA 3 can come up (to 15), not further down');
    for (let n = 0; n < 4; n += 1) step('str', 'dec').click();
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-push').textContent, 'Points left: 7', 'STR 14 frees four');
    assert.equal(step('str', 'dec').disabled, false, 'down to 8');
    dialog.close();
});

test('Undo import puts the wizard back as it was before, and Import file is offered again', async t => {
    const ctx = await newcomer(t);
    const dialog = await wizardWith(ctx);
    await companion(dialog);
    await goTo(dialog, 'stats');
    wizardOf(dialog).querySelector('.rpg-stat-step[data-stat="str"] .ss-w-stepper-inc').click();
    wizardOf(dialog).querySelector('.rpg-stat-step[data-stat="str"] .ss-w-stepper-inc').click();
    await goTo(dialog, 'who');
    await importInto(dialog, SAVED);
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-push').textContent, 'Points left: 3');
    click(wizardOf(dialog), 'Undo import');
    const who = wizardOf(dialog);
    assert.ok(who.querySelector('.rpg-import'), 'Import file is back');
    assert.equal(who.querySelector('[data-wiz="import-done"]'), null);
    assert.equal(who.querySelector('.rpg-wiz-push').textContent, 'Points left: 8', 'the two points spent before the import are back as they were');
    assert.match(who.querySelector('.rpg-wiz-sum').textContent, /STR 7 · VIT 5/);
    assert.equal(who.querySelector('.rpg-wiz-sub').textContent, 'Companion · Lv 1');
    assert.equal(who.querySelector('[data-wiz="name"]').value, 'Ren');
    const skills = await goTo(dialog, 'skills');
    assert.equal(skills.querySelectorAll('.rpg-wiz-row[data-skill]').length, 0, 'the imported skills are gone');
    const review = await goTo(dialog, 'review');
    assert.equal(review.querySelector('[data-review="import-also"]'), null, 'and nothing more will be added');
    // And a file can be imported again.
    await goTo(dialog, 'who');
    await importInto(dialog, SAVED);
    assert.ok(wizardOf(dialog).querySelector('[data-wiz="import-done"]'));
    dialog.close();
});

test('a bad file is refused in plain words and the wizard is left exactly as it was', async t => {
    const ctx = await newcomer(t);
    const dialog = await wizardWith(ctx);
    await companion(dialog);
    const before = wizardOf(dialog).querySelector('.rpg-wiz-sum').textContent;
    const bad = [
        ['notes.txt', 'just some words', /not a saved character: the file could not be read\./],
        ['pack.json', JSON.stringify({ id: 'a-pack' }), /not a saved character file\./],
        ['future.json', JSON.stringify({ ...JSON.parse(SAVED), [CHAR_FILE]: 2 }), /newer version/],
        ['stat.json', JSON.stringify({ ...JSON.parse(SAVED), stats: { ...JSON.parse(SAVED).stats, wis: 99 } }), /no valid WIS \(1 to 30\)/],
        ['money.json', JSON.stringify({ ...JSON.parse(SAVED), money: -1 }), /money in the file is not a whole number/],
        ['empty.json', '', /file is empty/],
    ];
    for (const [name, text, pattern] of bad) {
        await importInto(dialog, text, name);
        const alert = wizardOf(dialog).querySelector('.rpg-import-error');
        assert.match(alert?.textContent ?? '', pattern, name);
        assert.equal(alert.getAttribute('role'), 'alert');
        assert.equal(wizardOf(dialog).querySelector('[data-wiz="import-done"]'), null, name);
        assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-sum').textContent, before, `${name}: nothing was filled`);
        assert.equal(wizardOf(dialog).querySelector('[data-wiz="name"]').value, 'Ren');
    }
    // A file too big is not even read; one that cannot be read says so.
    let read = false;
    const input = wizardOf(dialog).querySelector('.rpg-import-file');
    input.files = [{ name: 'big.json', size: 70000, text: async () => { read = true; return SAVED; } }];
    input.dispatch('change');
    await settle();
    assert.equal(read, false);
    assert.match(wizardOf(dialog).querySelector('.rpg-import-error').textContent, /too big/);
    const gone = wizardOf(dialog).querySelector('.rpg-import-file');
    gone.files = [{ name: 'gone.json', size: 4, text: async () => { throw new Error('gone'); } }];
    gone.dispatch('change');
    await settle();
    assert.equal(wizardOf(dialog).querySelector('.rpg-import-error').textContent, 'gone.json could not be read.');
    const none = wizardOf(dialog).querySelector('.rpg-import-file');
    none.files = [];
    none.dispatch('change');
    await settle();
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-sum').textContent, before);
    // A good file after the bad ones works, and the old error is gone.
    await importInto(dialog, SAVED);
    assert.equal(wizardOf(dialog).querySelector('.rpg-import-error'), null);
    assert.ok(wizardOf(dialog).querySelector('[data-wiz="import-done"]'));
    dialog.close();
});

test('a file with no things or money says nothing about them; one with them says so on the Review', async t => {
    const ctx = await newcomer(t);
    let dialog = await wizardWith(ctx);
    await companion(dialog);
    await importInto(dialog, without('items', 'money'));
    assert.equal(wizardOf(dialog).querySelector('[data-wiz="import-done"]').textContent, 'Imported from wessel.character.json: stats, 3 unspent points, Lv 15 and 2 skills. Give the character a name below.Undo import');
    let review = await goTo(dialog, 'review');
    assert.equal(review.querySelector('[data-review="import-also"]'), null);
    assert.match(review.textContent, /Starts at Lv 15 \(imported\), 0 XP, full Health, Mana and Stamina\./);
    assert.match(review.textContent, /Iron Breath · VIT · Stamina · starts at Adept/);
    assert.match(review.textContent, /3 unspent points go to Spend points on the Party tab\./);
    dialog.close();

    dialog = await wizardWith(ctx);
    await companion(dialog);
    await importInto(dialog, without('money'));
    assert.match(wizardOf(dialog).querySelector('[data-wiz="import-done"]').textContent, /When you press Create it also adds 3 things to the party's bag\./);
    dialog.close();

    dialog = await wizardWith(ctx);
    await companion(dialog);
    await importInto(dialog, SAVED);
    review = await goTo(dialog, 'review');
    assert.equal(review.querySelector('[data-review="import-also"]').textContent, 'Also adds: 3 things to the party\'s bag · 50 gold to the purse. One swipe of this reply takes it all back.');
    assert.match(review.querySelector('[data-review="also"]').textContent, /^Also adds: Combat rules, Foes\.$|^Also adds: /, 'the blocks line is the one it always was');
    dialog.close();
    // A purse of 0 and no things in the file: nothing to add, nothing said.
    dialog = await wizardWith(ctx);
    await companion(dialog);
    await importInto(dialog, JSON.stringify({ ...JSON.parse(SAVED), items: [], money: 0 }));
    assert.equal((await goTo(dialog, 'review')).querySelector('[data-review="import-also"]'), null);
    dialog.close();
});

test('the money is told in this chat\'s coins, and the file keeps only its value', async t => {
    const first = await story(t, { purse: 0 });
    first.host.settings.set('story-block', 'coins', [{ name: 'copper', value: 1 }, { name: 'silver', value: 10 }]);
    await first.host.sdk.command('wallet.set', { amount: 50 });
    await settle();
    const dialog = await exportDialog(first);
    assert.match(exportOf(dialog).querySelector('[data-option="money"]').textContent, /Money · 5 silver/);
    dialog.close();
    const saved = await saveFrom(first);
    assert.equal(JSON.parse(saved.text).money, 50, 'the value in the smallest unit, not a coin word');

    const other = await newcomer(t);
    other.host.settings.set('story-block', 'currency', 'crown');
    other.host.settings.set('story-block', 'currencyPlural', 'crowns');
    const wizard = await wizardWith(other);
    await companion(wizard);
    await importInto(wizard, saved.text);
    assert.match(wizardOf(wizard).querySelector('[data-wiz="import-done"]').textContent, /adds 3 things to the party's bag and 50 crowns to the purse/, 'another game\'s words for the same value');
    wizard.close();

    const silver = await newcomer(t);
    silver.host.settings.set('story-block', 'coins', [{ name: 'copper', value: 1 }, { name: 'silver', value: 10 }]);
    const w2 = await wizardWith(silver);
    await companion(w2);
    await importInto(w2, saved.text);
    assert.match(wizardOf(w2).querySelector('[data-wiz="import-done"]').textContent, /adds 3 things to the party's bag and 5 silver to the purse/);
    w2.close();
});

// ---- Create with an import ----------------------------------------------------------------------------------------------------------

test('Create makes the Character and Skills blocks from the file, adds the things and the money, all in one reply, and one swipe takes it all back', async t => {
    const ctx = await newcomer(t);
    assert.equal((await ctx.host.sdk.command('wallet.set', { amount: 20 })).ok, true);
    const blocksBefore = names(ctx.host);
    const receiptsBefore = receiptTypes(ctx.host).length;
    await createRen(ctx);
    assert.equal(ctx.ui.mounts.dialog.current(), null, 'everything fit: the dialog closes');
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

    // The Party tab shows Ren with the imported sheet.
    const card = party(ctx.doc).querySelector('.rpg-card[data-character="Ren"]');
    assert.match(card.textContent, /Iron Breath \(Adept\) · Short blade \(Novice\)/);
    assert.match(card.textContent, /3 points to spend/);

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
    const dialog = await wizardWith(ctx, { empty: true });
    await importInto(dialog, GEAR_FILE);
    (await goTo(dialog, 'review')).querySelector('.rpg-wiz-create').click();
    await settle();
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

// Gear on before Create (a): the pieces keep the file's stats and no "held" Problem says the starting kit was closed. Gear off at import and on after (b): the rows show the file's stats.
for (const [label, before] of [['(a) Gear on before Create', true], ['(b) Gear off at import, on afterwards', false]]) {
    test(`an imported character's pieces keep the file's stats: ${label}`, async t => {
        const ctx = await page(t, { persona: 'Wessel' });
        const gear = on => ctx.host.features.set('story-block.gear', on);
        if (before) gear(true);
        const dialog = await wizardWith(ctx, { empty: true });
        await importInto(dialog, GEAR_FILE);
        (await goTo(dialog, 'review')).querySelector('.rpg-wiz-create').click();
        await settle();
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
