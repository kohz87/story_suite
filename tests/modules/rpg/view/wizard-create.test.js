// The New character wizard (src/v2/lean-rpg/view/wizard.js and wizard-data.js, mockup 41-wizard): Create as two defines, rollback, one You, room, full party, feature toggle, stylesheet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CREATION } from '../../../../modules/rpg/index.js';
import { CHOOSER_TEMPLATES as STANDARD_TEMPLATES } from '../../../../modules/rpg/templates.js';
import { WIZARD_SCREEN_ID } from '../../../../modules/rpg/view/wizard.js';
import { hasRoom, newDraft, problemsOf } from '../../../../modules/rpg/view/wizard-data.js';
import { reload } from '../../data-modules/helpers.js';
import { begin, fieldsOf, fillBlocks, makeBlocks, page, party, settle } from './page.js';
import { PACK, asCompanion, click, goTo, names, openFrom, type, wizardOf } from './wizard.helpers.js';

test('Create makes the two blocks with one dm.define each, the wizard\'s values as defaults, and no dm.set; rank only moves through play', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    const { host, doc, ui } = ctx;
    assert.equal((await host.packs.packs.install(PACK)).ok, true);
    await begin(host);
    const before = names(host);
    const dialog = await openFrom(ctx, { empty: true });
    await goTo(dialog, 'stats');
    for (const [stat, times] of [['str', 5], ['vit', 5]]) for (let n = 0; n < times; n += 1) wizardOf(dialog).querySelector(`.rpg-stat-step[data-stat="${stat}"] .ss-w-stepper-inc`).click();
    await goTo(dialog, 'skills');
    wizardOf(dialog).querySelectorAll('.rpg-wiz-card')[0].click();
    const first = wizardOf(dialog).querySelector('.rpg-wiz-row[data-skill="0"] [data-field="start"]');
    first.value = '1';
    first.dispatch('change');
    await goTo(dialog, 'review');
    wizardOf(dialog).querySelector('.rpg-wiz-create').click();
    await settle();
    assert.equal(ui.mounts.dialog.current(), null, 'created: the dialog closes');
    assert.deepEqual(names(host), [...before, 'pack.chat/combat-rules', 'pack.chat/foes', 'pack.chat/wessel', 'pack.chat/wessel-skills'].sort(), 'the chat had no Combat rules or Foes: Create adds them');
    const made = host.ctx.chat.flatMap(message => message.extra?.storySuite?.receipts ?? []).filter(receipt => receipt.type.startsWith('dm.'));
    assert.deepEqual(made.map(receipt => receipt.type), ['dm.define', 'dm.define', 'dm.define', 'dm.define'], 'four defines and nothing else: no dm.set');
    const character = fieldsOf(host, 'pack.chat/wessel'), skills = fieldsOf(host, 'pack.chat/wessel-skills');
    assert.deepEqual([character.who, character.str, character.vit, character.points, character.level, character.xp, character.hp, character.mp, character.sp, character.alive],
        ['Wessel', 10, 10, 0, 1, 0, 10, 10, 11, true]);   // (full v1 bars: HP 5 + VIT/2, MP 8 + (INT + WIS)/4, SP 8 + (STR + AGI)/4)
    assert.deepEqual([skills.who, skills.skill1, skills.stat1, skills.type1, skills.rank1, skills.practice1, skills.skill2, skills.rank2, skills.skill4, skills.rank4],
        ['Wessel', 'Short blade', 'agi', 'attack', 2, 200, 'Iron Breath', 0, '', 0]);   // (a skill chosen to start at Adept has the practice of that rank)
    const domain = host.head().domains.dataModules;
    const definition = domain.pins[domain.active['pack.chat/wessel-skills'].hash].definition;
    assert.equal(definition.role, 'skills');
    assert.equal(definition.state.rank1.edit, false);
    const refused = await host.sdk.command('dm.set', { module: 'pack.chat/wessel-skills', field: 'rank2', value: 3 });
    assert.equal(refused.ok, false, 'a rank cannot be typed in afterwards either');
    // The Party tab draws the new character as you, with the skills, and the Skills view reads them.
    await settle();
    const card = party(doc).querySelector('.rpg-card[data-character="Wessel"]');
    assert.ok(card);
    assert.equal(card.querySelector('.rpg-sub').textContent, 'you');
    assert.match(card.textContent, /Short blade \(Adept\) · Iron Breath \(Novice\) · Shield work \(Novice\)/);
    assert.ok(!card.textContent.includes('points to spend'), 'every point was spent');
    card.querySelector('.rpg-skills-open').click();
    assert.match(party(doc).querySelector('.rpg-skill[data-slot="1"] .rpg-skill-roll').textContent, /^Rolls with AGI · Adept$/);
    await reload(host);
});

test('Create costs the reply\'s budget twice: two roots, and a second character after it still fits', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    for (const [who, persona] of [['Wessel', true], ['Ren', false]]) {
        const dialog = await openFrom(ctx, { empty: who === 'Wessel' });
        if (!persona) await asCompanion(dialog, who);
        await goTo(dialog, 'review');
        wizardOf(dialog).querySelector('.rpg-wiz-create').click();
        await settle();
    }
    assert.deepEqual(names(ctx.host), ['pack.chat/combat-rules', 'pack.chat/foes', 'pack.chat/ren', 'pack.chat/ren-skills', 'pack.chat/wessel', 'pack.chat/wessel-skills']);
    const perReply = Object.values(ctx.host.head().domains.dataModules.perReply)[0];
    assert.equal(perReply.roots, 6, 'two defines each, and the Combat rules and Foes once, with the first character');
});

test('nothing half made: if the second define fails the first block is taken back, and the reader is told in plain words', async t => {
    let fail = 'skills';
    const calls = [];
    const wrap = async (type, payload, options, run) => {
        calls.push([type, payload.definition?.slug ?? payload.module]);
        if (type === 'dm.define' && payload.definition.slug.endsWith('-skills') && fail === 'skills') return { ok: false, code: 'DM_SCHEMA', message: 'Wessel\'s skills: A block with this name is already active; nothing applied.' };
        if (type === 'dm.remove' && fail === 'both') return { ok: false, message: 'Nope.' };
        if (type === 'dm.define' && payload.definition.slug.endsWith('-skills') && fail === 'both') return { ok: false, message: 'No skills today.' };
        if (type === 'dm.define' && fail === 'first') return { ok: false, message: 'No characters today.' };
        return run(type, payload, options);
    };
    const ctx = await page(t, { persona: 'Wessel', wrap });
    await begin(ctx.host);
    const before = names(ctx.host);
    let dialog = await openFrom(ctx, { empty: true });
    await goTo(dialog, 'review');
    wizardOf(dialog).querySelector('.rpg-wiz-create').click();
    await settle();
    assert.deepEqual(calls.map(call => call[0]), ['dm.define', 'dm.define', 'dm.remove']);
    assert.deepEqual(calls[2], ['dm.remove', 'pack.chat/wessel'], 'the first block is removed again');
    assert.deepEqual(names(ctx.host), before, 'nothing half made');
    assert.ok(ctx.ui.mounts.dialog.current(), 'the dialog stays open so nothing typed is lost');
    assert.match(wizardOf(ctx.ui.mounts.dialog.current()).querySelector('.rpg-wiz-status').textContent, /^Could not make the skills: Wessel's skills: .*Nothing was created\.$/);
    assert.equal(wizardOf(ctx.ui.mounts.dialog.current()).querySelector('.rpg-wiz-create').disabled, false, 'and Create can be tried again');
    ctx.ui.mounts.dialog.closeAll();

    // The first define fails: nothing to take back.
    fail = 'first';
    calls.length = 0;
    dialog = await openFrom(ctx, { empty: true });
    await goTo(dialog, 'review');
    wizardOf(dialog).querySelector('.rpg-wiz-create').click();
    await settle();
    assert.deepEqual(calls.map(call => call[0]), ['dm.define']);
    assert.match(wizardOf(ctx.ui.mounts.dialog.current()).querySelector('.rpg-wiz-status').textContent, /^Could not make the character: No characters today\.$/);
    assert.deepEqual(names(ctx.host), before);
    ctx.ui.mounts.dialog.closeAll();

    // The skills fail and the first block cannot be removed: the reader is told which block to remove.
    fail = 'both';
    calls.length = 0;
    dialog = await openFrom(ctx, { empty: true });
    await goTo(dialog, 'review');
    wizardOf(dialog).querySelector('.rpg-wiz-create').click();
    await settle();
    assert.match(wizardOf(ctx.ui.mounts.dialog.current()).querySelector('.rpg-wiz-status').textContent, /Could not make the skills \(No skills today\.\) and could not take the character back\. Remove "Wessel" in Settings → Blocks\./);
    ctx.ui.mounts.dialog.closeAll();
});

test('one You to a story: with a character named like the persona already there, the Party tab has no New character button, and the wizard (a You only) refuses a second', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    await makeBlocks(ctx.host, { who: 'Wessel' });
    await ctx.host.send('Go.', 'The quay.');
    ctx.ui.mounts.screen.open('story-block/party');
    await settle();
    assert.equal(party(ctx.doc).querySelector('.rpg-new'), null, 'no New character button while the story has a You');
    const dialog = await openFrom(ctx);
    const who = wizardOf(dialog);
    assert.equal(who.querySelector('.rpg-wiz-seg'), null, 'no You or companion choice');
    assert.equal(who.querySelector('[data-wiz="name"]').value, 'Wessel', 'the persona\'s name');
    const review = await goTo(dialog, 'review');
    assert.ok(review.querySelector('.rpg-wiz-create').disabled);
    const problems = review.querySelectorAll('.rpg-wiz-problems li').map(node => node.textContent).join(' ');
    assert.match(problems, /A character called Wessel is already in this story\./);
    assert.match(problems, /You already have a character in this story\./);
    dialog.close();
});

test('a companion cannot take the persona\'s name, and You must have it; no persona name known: any name goes', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    const dialog = await openFrom(ctx, { empty: true });
    await asCompanion(dialog, 'Wessel');
    let review = await goTo(dialog, 'review');
    assert.match(review.querySelectorAll('.rpg-wiz-problems li').map(node => node.textContent).join(' '), /A companion cannot have your persona's name \(Wessel\)/);
    assert.ok(review.querySelector('.rpg-wiz-create').disabled);
    await goTo(dialog, 'who');
    type(wizardOf(dialog).querySelector('[data-wiz="name"]'), 'Ren');
    review = await goTo(dialog, 'review');
    assert.equal(review.querySelector('.rpg-wiz-create').disabled, false);
    dialog.close();

    const bare = await page(t, { persona: '' });
    await begin(bare.host);
    const second = await openFrom(bare, { empty: true });
    type(wizardOf(second).querySelector('[data-wiz="name"]'), 'Pip');
    review = await goTo(second, 'review');
    assert.equal(review.querySelector('.rpg-wiz-create').disabled, false);
    second.close();
});

test('no room for two more blocks: the Review says so and Create stays off', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    for (const who of ['Ren', 'Tamsin', 'Mira']) await makeBlocks(ctx.host, { who });
    await fillBlocks(ctx.host, 12);
    const foes = structuredClone(STANDARD_TEMPLATES.find(entry => entry.name === 'Foes').definition);
    assert.equal((await ctx.host.sdk.command('dm.define', { definition: foes })).ok, true);
    await ctx.host.send('Go.', 'The quay.');
    assert.equal(hasRoom(ctx.host.head()), false);
    const dialog = await openFrom(ctx);
    const review = await goTo(dialog, 'review');
    assert.match(review.textContent, /This story has no room for two more blocks \(at most 20\)\. Remove one in Settings → Blocks first\./);
    assert.ok(review.querySelector('.rpg-wiz-create').disabled);
    dialog.close();
});

test('a full party (4 active): the Review refuses another character with the join line\'s sentence; someone who left makes room', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    for (const who of ['Ren', 'Tamsin', 'Mira', 'Ilse']) await makeBlocks(ctx.host, { who });
    await ctx.host.send('Go.', 'The quay.');
    const dialog = await openFrom(ctx);
    await asCompanion(dialog, 'Olwen');
    const review = await goTo(dialog, 'review');
    assert.match(review.textContent, /the party is full \(4 active\); someone must leave first/);
    assert.ok(review.querySelector('.rpg-wiz-create').disabled, 'Create stays off');
    dialog.close();
    assert.deepEqual(problemsOf(newDraft(), { full: true }).filter(line => /party is full/.test(line)), ['the party is full (4 active); someone must leave first']);
    assert.equal(problemsOf(newDraft(), { full: false }).some(line => /party is full/.test(line)), false);
});

test('closing the dialog drops the draft: the next one starts fresh', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    let dialog = await openFrom(ctx, { empty: true });
    type(wizardOf(dialog).querySelector('[data-wiz="name"]'), 'Something');
    dialog.close();
    dialog = await openFrom(ctx, { empty: true });
    assert.equal(wizardOf(dialog).querySelector('[data-wiz="name"]').value, 'Wessel');
    assert.equal(ctx.ui.mounts.dialog.current(), dialog);
    dialog.close();
});

test('feature off: no wizard screen, no button, nothing of it loaded', async t => {
    const ctx = await page(t, { feature: false });
    await begin(ctx.host);
    assert.equal(ctx.loads.length, 0);
    assert.equal(ctx.ui.screens.resolve(WIZARD_SCREEN_ID), null);
    assert.equal(ctx.ui.mounts.dialog.open(WIZARD_SCREEN_ID), null, 'a dialog for a screen that is not there opens nothing');
    ctx.host.features.set('story-block.rpg', true);
    await settle();
    assert.ok(ctx.ui.screens.resolve(WIZARD_SCREEN_ID));
    ctx.host.features.set('story-block.rpg', false);
    assert.equal(ctx.ui.screens.resolve(WIZARD_SCREEN_ID), null, 'switched off: the screen is gone again');
});

test('the stylesheet: the summary row, the template cards in three columns, rows that stack on a phone, theme tokens only', () => {
    const css = readFileSync(new URL('../../../../modules/rpg/view/lean-rpg.css', import.meta.url), 'utf8');
    assert.match(css, /\.rpg-wiz-grid \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    assert.match(css, /\.rpg-wiz-row \{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1\.7fr\) 78px 124px 104px 36px/);
    const phone = css.slice(css.indexOf('@media (max-width: 600px) {\n    .rpg-wiz-grid'));
    assert.match(phone, /\.rpg-wiz-grid \{ grid-template-columns: 1fr; \}/);
    assert.match(phone, /\.rpg-wiz-row \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\) 36px;/);
    assert.match(phone, /\.rpg-wiz-row \.rpg-wiz-n \{ grid-column: 1 \/ 4; \}/);
    assert.match(phone, /\.rpg-wiz-row \.rpg-wiz-d \{ grid-column: 1 \/ -1; \}/);
    assert.match(phone, /\.rpg-wiz-headrow \{ display: none; \}/);
    assert.doesNotMatch(css, /position:\s*fixed/);
    assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
    assert.doesNotMatch(css, /\brgba?\(/);
    assert.equal(CREATION.skills, 5);
});
