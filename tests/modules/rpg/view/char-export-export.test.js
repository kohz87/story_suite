import test from "node:test";
import assert from "node:assert/strict";
import { CHAR_FILE, parseCharacterFile } from "../../../../modules/rpg/charfile.js";
import { STATS } from "../../../../modules/rpg/index.js";
import { EXPORT_SCREEN_ID, EXPORT_WIDGET } from "../../../../modules/rpg/view/export.js";
import { WIZARD_SCREEN_ID } from "../../../../modules/rpg/view/wizard.js";
import { begin, makeBlocks, page, party, settle } from "./page.js";
import { PARTY_STUB, REN, SAVED, WESSEL, WESSEL_SKILLS, captureSaves, click, companion, exportDialog, exportOf, goTo, importInto, newcomer, saveFrom, story, type, wizardOf, wizardWith } from "./char-export.helpers.js";

// ---- Export ------------------------------------------------------------------------------------------------------------------------

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

// ---- Import (the New character wizard) ----------------------------------------------------------------------------------------------

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

test('a good file fills the stats, the unspent points, the level and the skills; the name stays', async t => {
    const ctx = await newcomer(t);
    const dialog = await wizardWith(ctx);
    await companion(dialog);
    await importInto(dialog, SAVED);
    const who = wizardOf(dialog);
    assert.deepEqual([who.querySelector('[data-wiz="name"]').value, who.querySelector('[data-wiz="about"]')], ['Ren', null], 'the name is not touched, and there is no who-they-are box');
    assert.equal(who.querySelector('.rpg-wiz-seg'), null, 'no You or companion choice');
    assert.equal(ctx.rpg().wizard.session().draft.kind, 'companion', 'still a companion');
    assert.equal(who.querySelector('.rpg-import'), null, 'the row gives way to the note');
    const done = who.querySelector('[data-wiz="import-done"]');
    assert.equal(done.textContent, 'Imported from wessel.character.json: stats, 3 unspent points, Lv 15 and 2 skills. When you press Create it also adds 3 things to the party\'s bag and 50 gold to the purse. Give the character a name below.Undo import');
    assert.equal(done.getAttribute('role'), 'status');
    assert.equal(who.querySelector('.rpg-wiz-sum .rpg-wiz-sub').textContent, 'Companion · Lv 15');
    assert.equal(who.querySelector('.rpg-wiz-push').textContent, 'Points left: 3');
    assert.match(who.querySelector('.rpg-wiz-sum').textContent, /STR 14 · VIT 12 · AGI 11 · DEX 10 · INT 8 · WIS 9 · CHA 10/);
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
    inc('wis');
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-push').textContent, 'Points left: 0');
    assert.equal(wizardOf(dialog).querySelector('.rpg-stat-step[data-stat="wis"] .ss-w-stepper-inc').disabled, true, 'no points left');
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
    assert.deepEqual(rank(rows[0]).querySelectorAll('option').map(node => node.textContent), ['Novice', 'Apprentice', 'Adept', 'Expert', 'Master', 'Grandmaster', 'Legend']);
    assert.match(skills.textContent, /Ranks come from the saved file/);
    type(rows[0].querySelector('[data-field="name"]'), 'Iron Lung');
    assert.match(wizardOf(dialog).querySelector('.rpg-wiz-sum').textContent, /Iron Lung \(Expert\), Short blade \(Novice\)/, 'a skill can be renamed, its rank stays');
    click(wizardOf(dialog), '+ Add a skill');
    const added = wizardOf(dialog).querySelectorAll('.rpg-wiz-row[data-skill]')[2];
    assert.deepEqual([Boolean(added.querySelector('[data-field="start"]').disabled), added.querySelector('[data-field="start"]').querySelectorAll('option').length], [false, 2], 'a new skill follows the usual rules');
    dialog.close();
});
