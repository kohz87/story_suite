import test from "node:test";
import assert from "node:assert/strict";
import { CHAR_FILE, parseCharacterFile } from "../../../../modules/rpg/charfile.js";
import { STATS } from "../../../../modules/rpg/index.js";
import { EXPORT_SCREEN_ID, EXPORT_WIDGET } from "../../../../modules/rpg/view/export.js";
import { WIZARD_SCREEN_ID } from "../../../../modules/rpg/view/wizard.js";
import { begin, makeBlocks, page, party, settle } from "./page.js";
import { PARTY_STUB, REN, SAVED, WESSEL, WESSEL_SKILLS, captureSaves, click, companion, exportDialog, exportOf, goTo, importInto, newcomer, saveFrom, story, type, wizardOf, wizardWith } from "./char-export.helpers.js";

// ---- Export ------------------------------------------------------------------------------------------------------------------------

test('Export is on every Party card, after Spend points and Skills, and opens a dialog named for the character', async t => {
    const ctx = await story(t, { companion: true });
    ctx.ui.mounts.screen.open('story-block/party');
    await settle();
    const cards = party(ctx.doc).querySelectorAll('.rpg-card');
    assert.equal(cards.length, 2);
    for (const card of cards) {
        const labels = card.querySelectorAll('.rpg-card-actions button').map(node => node.textContent);
        assert.equal(labels.at(-1), 'Export', 'Export closes the row');
        assert.ok(labels.length >= 2, 'beside the card\'s other buttons');
        assert.equal(card.querySelector('.rpg-export-open').getAttribute('aria-label'), `Export ${card.getAttribute('data-character')}`);
    }
    assert.deepEqual(party(ctx.doc).querySelector('.rpg-card[data-character="Wessel"] .rpg-card-actions').querySelectorAll('button').map(node => node.textContent), ['Spend points', 'Skills', 'Export']);
    const dialog = await exportDialog(ctx);
    assert.equal(dialog.screenId, EXPORT_SCREEN_ID);
    assert.equal(dialog.root.querySelector('.ss-dialog-title').textContent, 'Export Wessel');
    assert.equal(dialog.root.getAttribute('aria-label'), 'Export Wessel');
    assert.ok(exportOf(dialog));
    dialog.close();
    assert.equal(ctx.ui.mounts.dialog.current(), null);
});

test('the dialog says what is saved: the character always, the things and the money as options, and what is not saved', async t => {
    const ctx = await story(t);
    const dialog = await exportDialog(ctx);
    const root = exportOf(dialog);
    assert.match(root.textContent, /Saves a file you can import when you make a character in another chat\. The name and who they are stay in this chat\./);
    const option = key => root.querySelector(`[data-option="${key}"]`);
    assert.match(option('character').textContent, /Character/);
    assert.match(option('character').textContent, /Lv 15 · 3 points to spend/);
    assert.match(option('character').textContent, /STR 14 · VIT 12 · AGI 11 · DEX 10 · INT 8 · LUK 9 · CHA 10/);
    assert.match(option('character').textContent, /Skills: Iron Breath \(Expert\) · Short blade \(Novice\)/);
    const always = option('character').querySelector('input');
    assert.deepEqual([always.checked, always.disabled], [true, true], 'the character is always saved');
    assert.match(option('inventory').textContent, /Inventory · 3 things/);
    assert.match(option('inventory').textContent, /Oilskin Coat \(waxed, a little too big\) · Bedroll · Torch ×2/);
    assert.equal(option('inventory').querySelector('input').checked, true, 'on');
    assert.match(option('money').textContent, /Money · 50 gold/);
    assert.match(option('money').textContent, /Kept as its value, so another game's coins show it in their own words\./);
    assert.equal(option('money').querySelector('input').checked, true, 'on');
    assert.equal(root.querySelector('.rpg-exp-notsaved').textContent, 'Not saved: the name, who they are, XP, Health, Mana and Stamina (a new character starts full), skill practice, and anything about the story.');
    assert.equal(root.querySelector('.rpg-exp-save .rpg-exp-file').textContent, 'wessel.character.json');
    assert.deepEqual(root.querySelectorAll('.rpg-exp-actions button').map(node => node.textContent), ['Cancel', 'Save' + 'wessel.character.json']);
    click(root, 'Cancel');
    assert.equal(ctx.ui.mounts.dialog.current(), null, 'Cancel closes it and saves nothing');
});

test('Save writes <name>.character.json with the character, the things and the money, and only those', async t => {
    const ctx = await story(t);
    const saved = await saveFrom(ctx);
    assert.equal(saved.name, 'wessel.character.json');
    assert.equal(saved.type, 'application/json;charset=utf-8');
    assert.equal(ctx.ui.mounts.dialog.current(), null, 'saved: the dialog closes');
    const data = JSON.parse(saved.text);
    assert.deepEqual(Object.keys(data), [CHAR_FILE, 'level', 'soul', 'points', 'stats', 'skills', 'items', 'money']);
    assert.deepEqual([data[CHAR_FILE], data.soul, data.points, data.money], [1, 2, 3, 50]);
    assert.deepEqual(data.stats, { str: 14, vit: 12, agi: 11, dex: 10, int: 8, luk: 9, cha: 10 });
    assert.deepEqual(data.skills, [
        { name: 'Iron Breath', about: 'Steadies the lungs in a long fight.', stat: 'vit', uses: 'stamina', rank: 2 },
        { name: 'Short blade', about: 'Quick cuts at close range.', stat: 'agi', uses: 'stamina', rank: 0 },
    ]);
    assert.deepEqual(data.items, [
        { name: 'Oilskin Coat', qty: 1, note: 'waxed, a little too big', kind: 'equipment', rarity: 'uncommon' },
        { name: 'Bedroll', qty: 1, kind: 'goods', rarity: 'common' },
        { name: 'Torch', qty: 2, kind: 'goods', rarity: 'common' },
    ], 'names, counts, notes, kind and rarity, in the order the Inventory tab lists them (equipment first)');
    // Nothing of the rest: not the name or who they are, XP, Health/Mana/Stamina, or practice, anywhere in the text.
    for (const word of ['Bluewatch', '"who"', '"about": "A drill', '"xp"', 'health', 'practice', 'stamina": 1', '"name": "Wessel"']) assert.ok(!saved.text.includes(word), word);
    assert.equal(parseCharacterFile(saved.text).ok, true, 'Import reads what Export wrote');
});

test('with the options off the file has neither the things nor the money, and an empty bag or purse leaves them off by itself', async t => {
    const ctx = await story(t);
    const saves = captureSaves(ctx);
    const dialog = await exportDialog(ctx);
    for (const key of ['inventory', 'money']) {
        const box = exportOf(dialog).querySelector(`[data-option="${key}"] input`);
        box.checked = false;
        box.dispatch('change');
    }
    assert.equal(exportOf(dialog).querySelector('[data-option="inventory"] input').checked, false, 'it stays off when the dialog is drawn again');
    exportOf(dialog).querySelector('.rpg-exp-save').click();
    await settle();
    const data = JSON.parse(saves[0].blob.text);
    assert.deepEqual(Object.keys(data), [CHAR_FILE, 'level', 'soul', 'points', 'stats', 'skills']);

    const bare = await story(t, { things: false, purse: 0 });
    const empty = await exportDialog(bare);
    const root = exportOf(empty);
    assert.match(root.querySelector('[data-option="inventory"]').textContent, /Inventory · nothing carried/);
    assert.match(root.querySelector('[data-option="money"]').textContent, /Money · nothing in the purse/);
    assert.deepEqual([root.querySelector('[data-option="inventory"] input').disabled, root.querySelector('[data-option="money"] input').disabled], [true, true]);
    const more = captureSaves(bare);
    root.querySelector('.rpg-exp-save').click();
    await settle();
    assert.deepEqual(Object.keys(JSON.parse(more[0].blob.text)), [CHAR_FILE, 'level', 'soul', 'points', 'stats', 'skills']);
});

test('money only on your own card: a companion\'s dialog has the character and its things, never the purse', async t => {
    const ctx = await story(t, { companion: true });
    const dialog = await exportDialog(ctx, 'Ren');
    const root = exportOf(dialog);
    assert.equal(dialog.root.querySelector('.ss-dialog-title').textContent, 'Export Ren');
    assert.ok(root.querySelector('[data-option="character"]'));
    assert.ok(root.querySelector('[data-option="inventory"]'));
    assert.equal(root.querySelector('[data-option="money"]'), null);
    // Nobody but the party's bag holds things here, so Ren carries nothing; the bag is Wessel's.
    assert.match(root.querySelector('[data-option="inventory"]').textContent, /Inventory · nothing carried/);
    const saves = captureSaves(ctx);
    root.querySelector('.rpg-exp-save').click();
    await settle();
    const data = JSON.parse(saves[0].blob.text);
    assert.equal(saves[0].name, 'ren.character.json');
    assert.equal(Object.hasOwn(data, 'money'), false);
    assert.equal(Object.hasOwn(data, 'items'), false);
    assert.deepEqual(data.skills, [], 'Ren has no skills yet');
    assert.deepEqual([data.soul, data.points], [1, 0]);
});

test('a companion with a party actor of the same name carries what that actor holds, and a You also carries the bag', async t => {
    const ctx = await page(t, { persona: 'Wessel', modules: [PARTY_STUB([REN])] });
    await begin(ctx.host);
    await makeBlocks(ctx.host, { who: 'Wessel', character: WESSEL, skills: WESSEL_SKILLS });
    await makeBlocks(ctx.host, { who: 'Ren' });
    for (const payload of [{ name: 'Bedroll', qty: 1 }, { name: 'Whistle', qty: 1, note: 'tin', owner: REN.id }, { name: 'Rope', qty: 3, owner: REN.id }]) {
        const added = await ctx.host.sdk.command('inventory.add', payload);
        assert.equal(added.ok, true, added.message);
    }
    await settle();
    const ren = await exportDialog(ctx, 'Ren');
    assert.match(exportOf(ren).querySelector('[data-option="inventory"]').textContent, /Inventory · 2 things/);
    assert.match(exportOf(ren).querySelector('[data-option="inventory"]').textContent, /Rope ×3 · Whistle \(tin\)/);
    assert.ok(!exportOf(ren).querySelector('[data-option="inventory"]').textContent.includes('Bedroll'), 'the party\'s bag is not Ren\'s');
    ren.close();
    const wessel = await exportDialog(ctx, 'Wessel');
    assert.match(exportOf(wessel).querySelector('[data-option="inventory"]').textContent, /Inventory · 1 thing\s*Bedroll/);
    assert.ok(!exportOf(wessel).querySelector('[data-option="inventory"]').textContent.includes('Whistle'));
});

// ---- Import (the New character wizard) ----------------------------------------------------------------------------------------------

test('the RPG off: no Export button, no Import row, no dialogs of either', async t => {
    const off = await page(t, { feature: false, persona: 'Wessel' });
    await begin(off.host);
    await settle();
    assert.equal(off.loads.length, 0, 'the RPG screens were never loaded');
    assert.equal(off.ui.screens.resolve(EXPORT_SCREEN_ID), null);
    assert.equal(off.ui.screens.resolve(WIZARD_SCREEN_ID), null);
    assert.equal(off.doc.querySelector('.rpg-export-open'), null);
    assert.equal(off.doc.querySelector('.rpg-import'), null);
    // On: the screens are there; off again: they go.
    const ctx = await story(t);
    assert.ok(ctx.ui.screens.resolve(EXPORT_SCREEN_ID));
    ctx.ui.mounts.screen.open('story-block/party');
    await settle();
    assert.equal(party(ctx.doc).querySelectorAll('.rpg-export-open').length, 1);
    ctx.ui.mounts.screen.close?.();
    ctx.host.features.set('story-block.rpg', false);
    await settle();
    assert.equal(ctx.ui.screens.resolve(EXPORT_SCREEN_ID), null, 'switched off: the Export dialog is gone');
    assert.equal(ctx.ui.screens.resolve(WIZARD_SCREEN_ID), null);
    assert.equal(ctx.doc.querySelector('.rpg-export-open'), null);
    assert.equal(ctx.ui.mounts.dialog.current(), null);
    assert.equal(EXPORT_WIDGET, 'rpg.export');
});

test('the Who step starts with "Start from a saved character" and an Import file button, before the name', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    const dialog = await wizardWith(ctx, { empty: true });
    const who = wizardOf(dialog);
    const row = who.querySelector('.rpg-import');
    assert.ok(row);
    assert.equal(row.querySelector('.rpg-import-text').textContent, 'Start from a saved character: its stats, unspent points, level, skills, inventory and money.');
    assert.equal(row.querySelector('button').textContent, 'Import file…');
    assert.equal(row.querySelector('input').getAttribute('type'), 'file');
    assert.equal(row.querySelector('input').getAttribute('accept'), '.json,application/json');
    assert.equal(who.querySelector('.rpg-wiz-body').children[0], row, 'first on the step');
    let opened = 0;
    row.querySelector('input').click = () => { opened += 1; };
    row.querySelector('button').click();
    assert.equal(opened, 1, 'the button opens the file picker');
    for (const step of ['stats', 'skills', 'review']) assert.equal((await goTo(dialog, step)).querySelector('.rpg-import'), null, `not on ${step}`);
    dialog.close();
});

test('a good file fills the stats, the unspent points, the level and the skills; the name, You or a companion and who they are stay', async t => {
    const ctx = await newcomer(t);
    const dialog = await wizardWith(ctx);
    await companion(dialog);
    await importInto(dialog, SAVED);
    const who = wizardOf(dialog);
    assert.deepEqual([who.querySelector('[data-wiz="name"]').value, who.querySelector('[data-wiz="about"]').value], ['Ren', 'A ferry hand from Low Quay.'], 'name and who they are are not touched');
    assert.deepEqual(who.querySelectorAll('.rpg-wiz-seg button').map(node => node.getAttribute('aria-pressed')), ['false', 'true'], 'still a companion');
    assert.equal(who.querySelector('.rpg-import'), null, 'the row gives way to the note');
    const done = who.querySelector('[data-wiz="import-done"]');
    assert.equal(done.textContent, 'Imported from wessel.character.json: stats, 3 unspent points, Lv 15 and 2 skills. When you press Create it also adds 3 things to the party\'s bag and 50 gold to the purse. Give the character a name and who they are below.Undo import');
    assert.equal(done.getAttribute('role'), 'status');
    assert.equal(who.querySelector('.rpg-wiz-sum .rpg-wiz-sub').textContent, 'Companion · Lv 15');
    assert.equal(who.querySelector('.rpg-wiz-push').textContent, 'Points left: 3');
    assert.match(who.querySelector('.rpg-wiz-sum').textContent, /STR 14 · VIT 12 · AGI 11 · DEX 10 · INT 8 · LUK 9 · CHA 10/);
    assert.match(who.querySelector('.rpg-wiz-sum').textContent, /Iron Breath \(Expert\), Short blade \(Novice\)/);
    assert.match(who.textContent, /Starts at Lv 15 \(imported\) with 0 XP\. Health, Mana and Stamina start full\./);

    // The Stats step: the file's stats, the file's points to spend, the usual limits.
    const stats = await goTo(dialog, 'stats');
    const field = stat => stats.querySelector(`.rpg-stat-step[data-stat="${stat}"]`);
    assert.equal(stats.querySelector('.rpg-wiz-push').textContent, 'Points left: 3');
    assert.deepEqual(STATS.map(stat => Number(field(stat).querySelector('input').value)), [14, 12, 11, 10, 8, 9, 10]);
    assert.match(stats.textContent, /These are the saved character's stats\. Spend the 3 points from the file/);
    const inc = (stat, n = 1) => { for (let at = 0; at < n; at += 1) wizardOf(dialog).querySelector(`.rpg-stat-step[data-stat="${stat}"] .ss-w-stepper-inc`).click(); };
    inc('int', 3);
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-push').textContent, 'Points left: 1', 'INT stops at 10, the most a new character gets');
    assert.equal(wizardOf(dialog).querySelector('.rpg-stat-step[data-stat="int"] .ss-w-stepper-inc').disabled, true);
    inc('luk');
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-push').textContent, 'Points left: 0');
    assert.equal(wizardOf(dialog).querySelector('.rpg-stat-step[data-stat="luk"] .ss-w-stepper-inc').disabled, true, 'no points left');
    click(wizardOf(dialog), 'Reset');
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-push').textContent, 'Points left: 3', 'Reset goes back to the file\'s stats');
    assert.deepEqual(STATS.map(stat => Number(wizardOf(dialog).querySelector(`.rpg-stat-step[data-stat="${stat}"] input`).value)), [14, 12, 11, 10, 8, 9, 10]);

    // The Skills step: the file's skills, their ranks shown and not typeable, the rest editable.
    const skills = await goTo(dialog, 'skills');
    const rows = skills.querySelectorAll('.rpg-wiz-row[data-skill]');
    assert.deepEqual(rows.map(row => row.querySelector('[data-field="name"]').value), ['Iron Breath', 'Short blade']);
    assert.deepEqual(rows.map(row => row.querySelector('[data-field="stat"]').value), ['vit', 'agi']);
    const rank = row => row.querySelector('[data-field="start"]');
    assert.deepEqual(rows.map(row => [rank(row).value, rank(row).disabled]), [['2', true], ['0', true]]);
    assert.deepEqual(rank(rows[0]).querySelectorAll('option').map(node => node.textContent), ['Novice', 'Adept', 'Expert', 'Master']);
    assert.match(skills.textContent, /Ranks come from the saved file/);
    type(rows[0].querySelector('[data-field="name"]'), 'Iron Lung');
    assert.match(wizardOf(dialog).querySelector('.rpg-wiz-sum').textContent, /Iron Lung \(Expert\), Short blade \(Novice\)/, 'a skill can be renamed, its rank stays');
    click(wizardOf(dialog), '+ Add a skill');
    const added = wizardOf(dialog).querySelectorAll('.rpg-wiz-row[data-skill]')[2];
    assert.deepEqual([Boolean(added.querySelector('[data-field="start"]').disabled), added.querySelector('[data-field="start"]').querySelectorAll('option').length], [false, 2], 'a new skill follows the usual rules');
    dialog.close();
});
