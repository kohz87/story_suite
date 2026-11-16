import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCharacterFile } from "../../../../modules/rpg/charfile.js";
import { EXPORT_WIDGET } from "../../../../modules/rpg/view/export.js";
import { reload } from "../../../../packages/story-block/tests/v2/data-modules/helpers.js";
import { begin, fieldsOf, fillBlocks, makeBlocks, page, settle } from "./page.js";
import { cssOf } from "../../../core/helpers/css-parts.js";
import { PARTY_STUB, REN, SAVED, click, companion, createRen, exportDialog, exportOf, goTo, importInto, names, newcomer, oldSkillsBlock, purseOf, carried, saveFrom, story, type, without, wizardOf, wizardWith } from "./char-export.helpers.js";

test('a You takes the things to the bag, a companion with a party actor to that actor', async t => {
    const ctx = await page(t, { persona: 'Wessel', modules: [PARTY_STUB([REN])] });
    await begin(ctx.host);
    let dialog = await wizardWith(ctx, { empty: true });
    await importInto(dialog, SAVED);
    await goTo(dialog, 'review');
    wizardOf(dialog).querySelector('.rpg-wiz-create').click();
    await settle();
    assert.deepEqual([...new Set(ctx.host.sdk.query('inventory.items', {}).map(item => item.owner))], ['party'], 'a You: the party\'s bag');
    assert.equal(fieldsOf(ctx.host, 'pack.chat/wessel').level, 15, 'the file\'s Soul Class II: the level it stands for');
    dialog = await wizardWith(ctx);
    await companion(dialog, 'Ren');
    await importInto(dialog, without('money'));
    await goTo(dialog, 'review');
    wizardOf(dialog).querySelector('.rpg-wiz-create').click();
    await settle();
    assert.deepEqual(ctx.host.sdk.query('inventory.items', { owner: REN.id }).map(item => item.name).sort(), ['Bedroll', 'Oilskin Coat', 'Torch'], 'Ren has an actor: the things are theirs');
    assert.equal(ctx.host.sdk.query('inventory.items', { owner: 'party' }).length, 3, 'and the bag still has Wessel\'s');
});

test('what cannot be added is named in the window, the character is still made, and the rest is added', async t => {
    const wrap = async (type, payload, options, run) => {
        if (type === 'inventory.add' && payload.name === 'Torch') return { ok: false, code: 'REFUSED', message: 'The party cannot carry that much.' };
        if (type === 'wallet.set') return { ok: false, code: 'REFUSED', message: 'The purse is closed today.' };
        return run(type, payload, options);
    };
    const ctx = await newcomer(t, { wrap });
    await createRen(ctx);
    const open = ctx.ui.mounts.dialog.current();
    assert.ok(open, 'the window stays to say what was not added');
    assert.equal(open.root.querySelector('.rpg-wiz-status').textContent, 'Ren is in the party. Not added: Torch ×2 (The party cannot carry that much.); the money (The purse is closed today.).');
    assert.ok(names(ctx.host).includes('pack.chat/ren') && names(ctx.host).includes('pack.chat/ren-skills'), 'the character is made');
    assert.deepEqual(carried(ctx.host), ['Bedroll', 'Oilskin Coat'], 'the rest was added');
    assert.equal(purseOf(ctx.host), 0);
    click(open.root, 'Done');
    assert.equal(ctx.ui.mounts.dialog.current(), null);
});

test('a thing that is refused and blocks with no room are named together in the one window, and the character is still made', async t => {
    // No room for the Combat rules and Foes blocks (twenty own blocks at most) and a refused thing.
    const wrap = async (type, payload, options, run) => (type === 'inventory.add' && payload.name === 'Bedroll' ? { ok: false, message: 'You cannot carry the Bedroll.' } : run(type, payload, options));
    const ctx = await page(t, { persona: 'Wessel', wrap });
    await begin(ctx.host);
    for (const who of ['Wessel', 'Tamsin', 'Mira']) await makeBlocks(ctx.host, { who });
    await fillBlocks(ctx.host, 12);
    await settle();
    await createRen(ctx, without('money'));
    const text = ctx.ui.mounts.dialog.current().root.querySelector('.rpg-wiz-status').textContent;
    assert.match(text, /^Ren is in the party\. Not added: Combat rules, Foes\. .*Also not added: Bedroll \(You cannot carry the Bedroll\.\)\.$/);
    assert.ok(names(ctx.host).includes('pack.chat/ren'));
    assert.deepEqual(carried(ctx.host), ['Oilskin Coat', 'Torch ×2']);
});

test('if the character cannot be made nothing of the file is added, and the import is still there to try again', async t => {
    const wrap = async (type, payload, options, run) => (type === 'dm.define' && payload.definition.slug === 'ren' ? { ok: false, message: 'No characters today.' } : run(type, payload, options));
    const ctx = await newcomer(t, { wrap });
    const before = names(ctx.host);
    const dialog = await createRen(ctx);
    assert.deepEqual(carried(ctx.host), []);
    assert.equal(purseOf(ctx.host), 0);
    assert.deepEqual(names(ctx.host), before);
    assert.match(wizardOf(ctx.ui.mounts.dialog.current()).querySelector('.rpg-wiz-status').textContent, /Could not make the character/);
    const again = await goTo(dialog, 'who');
    assert.ok(again.querySelector('[data-wiz="import-done"]'), 'still imported');
    dialog.close();
});

test('an import closed without Create leaves nothing behind: the next wizard starts clean', async t => {
    const ctx = await newcomer(t);
    let dialog = await wizardWith(ctx);
    await importInto(dialog, SAVED);
    dialog.close();
    dialog = await wizardWith(ctx);
    assert.ok(wizardOf(dialog).querySelector('.rpg-import'), 'the row is back');
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-push').textContent, 'Points left: 10');
    assert.deepEqual([carried(ctx.host), purseOf(ctx.host)], [[], 0]);
    dialog.close();
});

test('a file read after the window closed changes nothing', async t => {
    const ctx = await newcomer(t);
    const dialog = await wizardWith(ctx);
    const input = wizardOf(dialog).querySelector('.rpg-import-file');
    let release;
    input.files = [{ name: 'slow.json', size: 10, text: () => new Promise(resolve => { release = () => resolve(SAVED); }) }];
    input.dispatch('change');
    dialog.close();
    release();
    await settle();
    const next = await wizardWith(ctx);
    assert.ok(wizardOf(next).querySelector('.rpg-import'), 'the late file was dropped');
    next.close();
});

// ---- the inventory's reader add takes a kind and a rarity for a new item ----------------------------------------------------------------

test('inventory.add with a kind and rarity: a new item has them, one the chat already knows keeps its own, a bad one is refused', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    const add = payload => ctx.host.sdk.command('inventory.add', payload);
    const row = name => ctx.host.sdk.query('inventory.items', {}).find(item => item.name === name);
    assert.equal((await add({ name: 'Warding Knife', kind: 'equipment', rarity: 'rare' })).ok, true);
    assert.deepEqual([row('Warding Knife').kind, row('Warding Knife').rarity], ['equipment', 'rare']);
    assert.equal((await add({ name: 'Plain Cord' })).ok, true);
    assert.deepEqual([row('Plain Cord').kind, row('Plain Cord').rarity], ['goods', 'common'], 'without them it is as it always was');
    assert.equal((await add({ name: 'plain cord', qty: 2, kind: 'quest', rarity: 'legendary' })).ok, true);
    const cords = ctx.host.sdk.query('inventory.items', {}).filter(item => item.name === 'Plain Cord');
    assert.deepEqual([cords.map(item => item.qty), cords[0].kind, cords[0].rarity], [[3], 'goods', 'common'], 'a known item is not changed by a file');
    const kind = await add({ name: 'Odd Thing', kind: 'relic' });
    assert.deepEqual([kind.ok, kind.code], [false, 'INVALID']);
    assert.match(kind.message, /The kind of an item is one of goods, material, consumable, equipment, quest, money\./);
    const rarity = await add({ name: 'Odd Thing', rarity: 'mythic' });
    assert.deepEqual([rarity.ok, rarity.code], [false, 'INVALID']);
    assert.equal(row('Odd Thing'), undefined, 'nothing was made');
    // Equipment never stacks, whatever the count.
    assert.equal((await add({ name: 'Spare Boot', qty: 2, kind: 'equipment' })).ok, true);
    assert.equal(ctx.host.sdk.query('inventory.items', {}).filter(item => item.name === 'Spare Boot').length, 2);
    await reload(ctx.host);
    assert.deepEqual([row('Warding Knife').kind, row('Warding Knife').rarity], ['equipment', 'rare'], 'reload = live');
});

// ---- the dialogs are opaque -----------------------------------------------------------------------------------------------------------

test('the RPG\'s dialogs are opaque: the party cards behind the New character window must not show through it', () => {
    const css = readFileSync(new URL('../../../../modules/rpg/view/lean-rpg.css', import.meta.url), 'utf8');
    const rule = /\.ss-dialog:has\(([^)]*)\) \{([^}]*)\}/.exec(css);
    assert.ok(rule, 'a rule for the dialogs that hold the RPG widgets');
    for (const widget of ['.ss-w-rpg-wizard', '.ss-w-rpg-export', '.ss-w-rpg-hold']) assert.ok(rule[1].includes(widget), `${widget} dialogs`);
    const body = rule[2];
    assert.match(body, /background-color: var\(--ss-sheet-floor, var\(--ss-surface\)\);/, 'an opaque floor under the glass tint');
    assert.match(body, /background-image: linear-gradient\(var\(--ss-sheet-bg, var\(--ss-surface\)\), var\(--ss-sheet-bg, var\(--ss-surface\)\)\);/, 'the glass tint laid over it');
    assert.match(body, /backdrop-filter: none;/);
    assert.doesNotMatch(body, /transparent|rgba|opacity/, 'nothing in it lets the page through');
    // The floor is the one the Game view's own window uses, so the dialog and its surroundings agree.
    assert.match(cssOf('mounts'), /background-color: var\(--ss-sheet-floor, var\(--ss-surface\)\);/);
    // The widgets named are the ones the dialogs really draw.
    assert.equal(EXPORT_WIDGET.replace('.', '-'), 'rpg-export');
});

// ---- a skill with no stat of its own is never given one ---------------------------------------------------------------------------------

test('a skill whose block has no stat is exported without one: the key is left out, never guessed', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    await oldSkillsBlock(ctx.host);
    await settle();
    const saved = await saveFrom(ctx);
    const data = JSON.parse(saved.text);
    assert.equal(data.skills.length, 1);
    assert.deepEqual(Object.keys(data.skills[0]), ['name', 'about', 'uses', 'rank'], 'no stat key');
    assert.equal(data.skills[0].name, 'Iron Breath');
    assert.equal(parseCharacterFile(saved.text).ok, true, 'and it reads back');
});

test('the Review asks for the stat of an imported skill that has none, like the missing "what it does" line, and Create waits', async t => {
    const ctx = await newcomer(t);
    const saved = JSON.parse(SAVED);
    delete saved.skills[0].stat;
    saved.skills[1].stat = null;
    saved.skills[0].about = '';
    const dialog = await wizardWith(ctx);
    await companion(dialog);
    await importInto(dialog, JSON.stringify(saved));
    const skills = await goTo(dialog, 'skills');
    const rows = skills.querySelectorAll('.rpg-wiz-row[data-skill]');
    assert.deepEqual(rows.map(row => row.querySelector('[data-field="stat"]').value), ['', ''], 'an empty Stat, not STR');
    assert.deepEqual(rows[0].querySelector('[data-field="stat"]').querySelectorAll('option').map(node => node.textContent), ['—', 'STR', 'VIT', 'AGI', 'DEX', 'INT', 'LUK', 'CHA']);
    let review = await goTo(dialog, 'review');
    assert.deepEqual(review.querySelectorAll('.rpg-wiz-problems li').map(node => node.textContent),
        ['Fix this first:', 'Iron Breath needs a line about what it does.', 'Iron Breath needs a stat.', 'Short blade needs a stat.']);
    assert.equal(review.querySelector('.rpg-wiz-create').disabled, true);
    // Picking the stats (and writing the line) lets Create go; what was picked is what is made.
    await goTo(dialog, 'skills');
    const row = n => wizardOf(dialog).querySelectorAll('.rpg-wiz-row[data-skill]')[n];
    type(row(0).querySelector('[data-field="about"]'), 'Steadies the lungs.');
    for (const [n, stat] of [[0, 'vit'], [1, 'agi']]) { row(n).querySelector('[data-field="stat"]').value = stat; row(n).querySelector('[data-field="stat"]').dispatch('change'); }
    review = await goTo(dialog, 'review');
    assert.ok(wizardOf(dialog).querySelector('.rpg-wiz-problems').hidden);
    review.querySelector('.rpg-wiz-create').click();
    await settle();
    const made = fieldsOf(ctx.host, 'pack.chat/ren-skills');
    assert.deepEqual([made.stat1, made.stat2, made.rank1], ['vit', 'agi', 2]);
});

// ---- where the things will go is said plainly -------------------------------------------------------------------------------------------

test('the things "to the party\'s bag" for a You and for a companion with no party actor; "carried by <name>" only when an actor of that name holds them', async t => {
    // A You: the bag.
    const you = await page(t, { persona: 'Wessel' });
    await begin(you.host);
    let dialog = await wizardWith(you, { empty: true });
    await importInto(dialog, SAVED);
    assert.match(wizardOf(dialog).querySelector('[data-wiz="import-done"]').textContent, /also adds 3 things to the party's bag and 50 gold to the purse\./);
    let review = await goTo(dialog, 'review');
    assert.equal(review.querySelector('[data-review="import-also"]').textContent, 'Also adds: 3 things to the party\'s bag · 50 gold to the purse. One swipe of this reply takes it all back.');
    assert.ok(!review.textContent.includes('carried by'));
    dialog.close();

    // A companion and no party actor: still the bag.
    const none = await newcomer(t);
    dialog = await wizardWith(none);
    await companion(dialog, 'Ren');
    await importInto(dialog, SAVED);
    review = await goTo(dialog, 'review');
    assert.match(review.querySelector('[data-review="import-also"]').textContent, /^Also adds: 3 things to the party's bag · /);
    assert.ok(!(await goTo(dialog, 'who')).textContent.includes('carried by'));
    dialog.close();

    // A companion with a party actor of that name: carried by them (the name is read as it is typed).
    const actors = await page(t, { persona: 'Wessel', modules: [PARTY_STUB([REN])] });
    await begin(actors.host);
    await makeBlocks(actors.host, { who: 'Wessel' });
    await settle();
    dialog = await wizardWith(actors);
    await companion(dialog, 'Ren');
    await importInto(dialog, SAVED);
    assert.match(wizardOf(dialog).querySelector('[data-wiz="import-done"]').textContent, /also adds 3 things carried by Ren and 50 gold to the purse\./);
    review = await goTo(dialog, 'review');
    assert.equal(review.querySelector('[data-review="import-also"]').textContent, 'Also adds: 3 things carried by Ren · 50 gold to the purse. One swipe of this reply takes it all back.');
    // Another name: no actor, so the bag.
    await goTo(dialog, 'who');
    type(wizardOf(dialog).querySelector('[data-wiz="name"]'), 'Brae');
    assert.match((await goTo(dialog, 'review')).querySelector('[data-review="import-also"]').textContent, /^Also adds: 3 things to the party's bag · /);
    dialog.close();
});

// ---- templates do not silently replace imported skills ------------------------------------------------------------------------------------

test('after an import a skill template asks first: Keep leaves the imported skills, Replace puts the template in; with no imported skills it just goes in', async t => {
    const ctx = await newcomer(t);
    const dialog = await wizardWith(ctx);
    await companion(dialog);
    await importInto(dialog, SAVED);
    const rows = () => wizardOf(dialog).querySelectorAll('.rpg-wiz-row[data-skill]').map(row => row.querySelector('[data-field="name"]').value);
    const cards = () => wizardOf(dialog).querySelectorAll('.rpg-wiz-card');
    await goTo(dialog, 'skills');
    assert.equal(wizardOf(dialog).querySelector('[data-wiz="replace"]'), null, 'nothing asked until a template is picked');
    cards()[0].click();
    const ask = wizardOf(dialog).querySelector('[data-wiz="replace"]');
    assert.equal(ask.querySelector('.rpg-wiz-replace-text').textContent, 'Replace the imported skills? Their ranks will be lost.');
    assert.deepEqual(ask.querySelectorAll('button').map(node => node.textContent), ['Replace', 'Keep']);
    assert.deepEqual(rows(), ['Iron Breath', 'Short blade'], 'nothing changed yet');
    click(ask, 'Keep');
    assert.equal(wizardOf(dialog).querySelector('[data-wiz="replace"]'), null);
    assert.deepEqual(rows(), ['Iron Breath', 'Short blade'], 'Keep leaves them');
    assert.match(wizardOf(dialog).querySelector('.rpg-wiz-sum').textContent, /Iron Breath \(Expert\)/, 'ranks and all');
    assert.deepEqual(cards().map(card => card.getAttribute('aria-pressed')), ['false', 'false', 'false', 'false', 'false']);
    cards()[2].click();
    click(wizardOf(dialog).querySelector('[data-wiz="replace"]'), 'Replace');
    assert.deepEqual(rows(), ['Spark', 'Ward', 'Lore'], 'Replace puts the template in');
    assert.equal(wizardOf(dialog).querySelector('[data-wiz="replace"]'), null);
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-row[data-skill] [data-field="start"]').disabled, undefined, 'new skills are the usual ones again');
    // With no imported skills left a template goes in without a question.
    cards()[0].click();
    assert.equal(wizardOf(dialog).querySelector('[data-wiz="replace"]'), null);
    assert.deepEqual(rows(), ['Short blade', 'Iron Breath', 'Shield work']);
    dialog.close();

    // A question left open is dropped once the imported skills are gone (Undo import).
    const again = await wizardWith(ctx);
    await companion(again, 'Brae');
    await importInto(again, SAVED);
    await goTo(again, 'skills');
    wizardOf(again).querySelectorAll('.rpg-wiz-card')[0].click();
    await goTo(again, 'who');
    click(wizardOf(again), 'Undo import');
    await goTo(again, 'skills');
    assert.equal(wizardOf(again).querySelector('[data-wiz="replace"]'), null);
    again.close();
});

test('the money in the note and the Review is "to the purse", in the wallet\'s own words with thousands separators', async t => {
    const ctx = await newcomer(t);
    const dialog = await wizardWith(ctx);
    await companion(dialog);
    await importInto(dialog, JSON.stringify({ ...JSON.parse(SAVED), money: 10_000_000 }));
    assert.match(wizardOf(dialog).querySelector('[data-wiz="import-done"]').textContent, /adds 3 things to the party's bag and 10,000,000 gold to the purse\. Give/);
    assert.ok(!wizardOf(dialog).querySelector('[data-wiz="import-done"]').textContent.includes('this chat'));
    const review = await goTo(dialog, 'review');
    assert.equal(review.querySelector('[data-review="import-also"]').textContent, 'Also adds: 3 things to the party\'s bag · 10,000,000 gold to the purse. One swipe of this reply takes it all back.');
    dialog.close();
    // Mixed coins: each long number gets its separators, short ones are left alone.
    const coins = await newcomer(t);
    coins.host.settings.set('story-block', 'coins', [{ name: 'copper', value: 1 }, { name: 'silver', value: 10 }, { name: 'gold', value: 100 }]);
    const w = await wizardWith(coins);
    await companion(w);
    await importInto(w, JSON.stringify({ ...JSON.parse(SAVED), money: 123_456_705 }));
    assert.match(wizardOf(w).querySelector('[data-wiz="import-done"]').textContent, /and 1,234,567 gold 5 copper to the purse\./);
    w.close();
    // The Export dialog words it the same way.
    const first = await story(t, { purse: 12_345_678 });
    const exp = await exportDialog(first);
    assert.match(exportOf(exp).querySelector('[data-option="money"]').textContent, /Money · 12,345,678 gold/);
});
