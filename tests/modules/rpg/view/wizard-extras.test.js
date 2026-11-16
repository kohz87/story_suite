// The New character wizard (src/v2/lean-rpg/view/wizard.js and wizard-data.js, mockup 41-wizard): reply budget (B9), Combat rules & Foes extras, Stats card layout, Starting level.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STATS } from '../../../../modules/rpg/index.js';
import { STANDARD_TEMPLATES } from '../../../../modules/rpg/templates.js';
import { RPG_EXTRAS, buildDefinitions, extraDefinitions, extrasPlan, missingBlocks, newDraft, problemsOf, readDraft } from '../../../../modules/rpg/view/wizard-data.js';
import { reload } from '../../../../packages/story-block/tests/v2/data-modules/helpers.js';
import { begin, fillBlocks, makeBlocks, page, settle } from './page.js';
import { click, companion, createFrom, ctxDialog, goTo, names, openFrom, rolesOf, type, usedReply, wizardOf } from './wizard.helpers.js';

// ---- fix round 4, B9: Create asks the reply for room first -------------------------------------------------------------------------

test('B9: with 31 of the reply\'s 32 block actions used, Create says so plainly and makes nothing (no half-made character)', async t => {
    const ctx = await usedReply(t, 31);
    const before = names(ctx.host);
    const dialog = await companion(ctx, 'Ren');
    const shown = wizardOf(dialog).querySelectorAll('.rpg-wiz-problems li').map(node => node.textContent);
    assert.deepEqual(shown, ['Fix this first:', 'This reply has already used 31 of its 32 block actions, and a new character needs 3. Send your next message, then try again.']);
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-create').disabled, true);
    wizardOf(dialog).querySelector('.rpg-wiz-create').click();
    await settle();
    assert.deepEqual(names(ctx.host), before, 'nothing was made, not even the Character');
    assert.equal(Object.values(ctx.host.head().domains.dataModules.perReply)[0].roots, 31, 'and no action was spent');
    dialog.close();
});

test('B9: the edge: 29 used leaves exactly the three Create may need, 30 does not; a new reply has room again', async t => {
    const tight = await usedReply(t, 30);
    let dialog = await companion(tight, 'Ren');
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-create').disabled, true, '30 used');
    dialog.close();
    const edge = await usedReply(t, 29);
    dialog = await companion(edge, 'Ren');
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-create').disabled, false, '29 used');
    wizardOf(dialog).querySelector('.rpg-wiz-create').click();
    await settle();
    assert.ok(names(edge.host).includes('pack.chat/ren') && names(edge.host).includes('pack.chat/ren-skills'));
    // Three free actions are the character and its skills and the way back: the Combat rules fit after them, the Foes do not, and it is said.
    assert.ok(names(edge.host).includes('pack.chat/combat-rules') && !names(edge.host).includes('pack.chat/foes'));
    assert.equal(wizardOf(ctxDialog(edge)).querySelector('.rpg-wiz-status').textContent.startsWith('Ren is in the party. Not added: Foes. This reply has no block actions left for it.'), true);
    ctxDialog(edge).close();
    // A new reply is a fresh count.
    await tight.host.send('Onward.', 'The next reply.');
    dialog = await companion(tight, 'Ren');
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-create').disabled, false, 'the next reply');
    dialog.close();
});

test('B9: problemsOf says it when the free actions are fewer than three, and only then', () => {
    const ok = { ...newDraft({ persona: 'Wessel' }) };
    const world = { persona: 'Wessel', names: [], room: true, hasYou: false };
    assert.deepEqual(problemsOf(ok, { ...world, free: 3 }), []);
    assert.equal(problemsOf(ok, { ...world, free: 2 }).length, 1);
    assert.deepEqual(problemsOf(ok, world), [], 'without the count nothing is asked');
});

// ---- 2.9.1: Create adds the Combat rules and Foes blocks the chat lacks --------------------------------------------------------------

test('2.9.1: a chat with neither block: the Review says "Also adds: Combat rules, Foes", Create makes all four in one go, and one swipe takes them all back', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    const { dialog, review } = await createFrom(ctx);
    assert.equal(review.querySelector('[data-review="also"]').textContent, 'Also adds: Combat rules, Foes.');
    assert.equal(review.querySelector('[data-review="not-added"]'), null);
    review.querySelector('.rpg-wiz-create').click();
    await settle();
    assert.equal(ctx.ui.mounts.dialog.current(), null, 'everything fit: the dialog closes as before');
    assert.deepEqual(rolesOf(ctx.host), ['character', 'foes', 'rules', 'skills']);
    const defines = ctx.host.ctx.chat.flatMap(message => message.extra?.storySuite?.receipts ?? []).filter(receipt => receipt.type === 'dm.define');
    assert.deepEqual(defines.length, 4);
    const domain = ctx.host.head().domains.dataModules;
    assert.equal(domain.pins[domain.active['pack.chat/combat-rules'].hash].definition.prompt, STANDARD_TEMPLATES.find(entry => entry.name === 'Combat rules').definition.prompt.replace(/\s+/g, ' '), 'the stock Combat rules text (a block keeps it on one line)');
    await ctx.host.swipe('Another opening.');
    assert.deepEqual(rolesOf(ctx.host), [], 'one swipe: character, skills, Combat rules and Foes all go with the reply');
    await reload(ctx.host);
});

test('2.9.1: only the missing ones: with a Combat rules block already there the Review and Create add the Foes alone, and with both nothing extra', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    const rules = structuredClone(STANDARD_TEMPLATES.find(entry => entry.name === 'Combat rules').definition);
    rules.prompt = 'My own combat text.';
    assert.equal((await ctx.host.sdk.command('dm.define', { definition: rules })).ok, true);
    let { dialog, review } = await createFrom(ctx);
    assert.equal(review.querySelector('[data-review="also"]').textContent, 'Also adds: Foes.');
    review.querySelector('.rpg-wiz-create').click();
    await settle();
    assert.deepEqual(rolesOf(ctx.host), ['character', 'foes', 'rules', 'skills']);
    const domain = ctx.host.head().domains.dataModules;
    assert.equal(domain.pins[domain.active['pack.chat/combat-rules'].hash].definition.prompt, 'My own combat text.', 'the reader\'s block is left alone');
    // A second character: both blocks exist, nothing is added and the Review has no "Also adds".
    dialog = await openFrom(ctx);
    click(wizardOf(dialog), 'A companion');
    type(wizardOf(dialog).querySelector('[data-wiz="name"]'), 'Ren');
    review = await goTo(dialog, 'review');
    assert.equal(review.querySelector('[data-review="also"]'), null);
    review.querySelector('.rpg-wiz-create').click();
    await settle();
    assert.deepEqual(rolesOf(ctx.host), ['character', 'character', 'foes', 'rules', 'skills', 'skills']);
});

test('2.9.1: no room for the extras: the character is still made, the Review and the dialog say which block was not added', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    for (const who of ['Ren', 'Tamsin', 'Mira']) await makeBlocks(ctx.host, { who });
    await fillBlocks(ctx.host, 12);
    // Eighteen own blocks: two more fit (the character and its skills) and no more.
    const dialog = await openFrom(ctx);
    click(wizardOf(dialog), 'A companion');
    type(wizardOf(dialog).querySelector('[data-wiz="name"]'), 'Olwen');
    const review = await goTo(dialog, 'review');
    assert.equal(review.querySelector('[data-review="also"]'), null);
    assert.match(review.querySelector('[data-review="not-added"]').textContent, /^Cannot add: Combat rules, Foes\. This story has no room for more blocks \(at most 20\)\./);
    assert.equal(review.querySelector('.rpg-wiz-create').disabled, false);
    review.querySelector('.rpg-wiz-create').click();
    await settle();
    assert.ok(names(ctx.host).includes('pack.chat/olwen') && names(ctx.host).includes('pack.chat/olwen-skills'), 'the character is made');
    assert.equal(rolesOf(ctx.host).includes('rules') || rolesOf(ctx.host).includes('foes'), false);
    const now = ctxDialog(ctx);
    assert.ok(now, 'the window stays so the reader can read it');
    assert.match(wizardOf(now).querySelector('.rpg-wiz-status').textContent, /^Olwen is in the party\. Not added: Combat rules, Foes\. This story has no room for more blocks \(at most 20\)\. Settings → Blocks adds it later, and Settings → RPG adds the Combat rules block\.$/);
    assert.equal(wizardOf(now).querySelector('.rpg-wiz-create'), null, 'no second Create');
    wizardOf(now).querySelector('.rpg-wiz-done').click();
    assert.equal(ctxDialog(ctx), null);
});

test('2.9.1: an extra block that is refused does not take the character back; it is named in plain words', async t => {
    const wrap = async (type, payload, options, run) => (type === 'dm.define' && payload.definition.slug === 'foes' ? { ok: false, code: 'DM_SCHEMA', message: 'Foes: not today; nothing applied.' } : run(type, payload, options));
    const ctx = await page(t, { persona: 'Wessel', wrap });
    await begin(ctx.host);
    const { review } = await createFrom(ctx);
    review.querySelector('.rpg-wiz-create').click();
    await settle();
    assert.deepEqual(rolesOf(ctx.host), ['character', 'rules', 'skills']);
    assert.match(wizardOf(ctxDialog(ctx)).querySelector('.rpg-wiz-status').textContent, /^Wessel is in the party\. Not added: Foes\. .*Settings → RPG adds the Combat rules block\.$/);
});

test('2.9.1: the pure planner: what is missing, in the order Combat rules then Foes, and what fits beside the two blocks of a character', () => {
    const state = (roles, { own = roles.length } = {}) => ({ domains: { dataModules: {
        active: Object.fromEntries(Array.from({ length: own }, (_, n) => [`pack.chat/b${n}`, { hash: `h${n}` }])),
        pins: Object.fromEntries(Array.from({ length: own }, (_, n) => [`h${n}`, { packId: 'chat', definition: { id: `pack.chat/b${n}`, role: roles[n] ?? null } }])) } } });
    assert.deepEqual(missingBlocks(null), ['rules', 'foes']);
    assert.deepEqual(extrasPlan(null), { add: ['rules', 'foes'], skipped: [] });
    assert.deepEqual(extraDefinitions(['rules', 'foes']).map(definition => [definition.slug, definition.role]), [['combat-rules', 'rules'], ['foes', 'foes']]);
    assert.deepEqual(extraDefinitions(['foes'], { used: ['pack.chat/foes'] }).map(definition => definition.slug), ['foes-2'], 'a taken slug is not reused');
    assert.deepEqual(extrasPlan(null, { free: 3 }), { add: ['rules'], skipped: [{ role: 'foes', why: 'actions' }] });
    assert.deepEqual(extrasPlan(null, { free: 2 }).add, []);
    assert.deepEqual(extrasPlan(null, { free: 32 }).skipped, []);
    assert.equal(RPG_EXTRAS.length, 2);
});

// ---- 2.9.1 item 4: the Stats step's layout -----------------------------------------------------------------------------------------

test('2.9.1: the Stats step is one card with an even grid of label-over-stepper cells and the radar beside it; Reset and the help share the grid\'s edge; no "Points left" under a stat', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    const dialog = await openFrom(ctx, { empty: true });
    const stats = await goTo(dialog, 'stats');
    const card = stats.querySelector('.rpg-wiz-stats-card');
    assert.ok(card, 'the card');
    const body = card.querySelector('.rpg-wiz-stats-body');
    assert.deepEqual([...body.children].map(node => node.className.split(' ')[0]), ['rpg-steppers', 'rpg-radar'], 'the steppers, then the radar');
    const grid = body.querySelector('.rpg-wiz-steppers');
    assert.deepEqual(grid.querySelectorAll('.rpg-stat-step').map(node => node.getAttribute('data-stat')), [...STATS]);
    for (const cell of grid.querySelectorAll('.rpg-stat-step')) {
        const kids = [...cell.querySelector('.ss-w-stepper').children].map(node => String(node.className));
        assert.ok(kids[0].includes('ss-w-stepper-label') && kids[1].includes('ss-w-stepper-row'), 'label above, stepper below');
        const note = cell.querySelector('.ss-w-stepper-budget');
        assert.equal(note.hidden, true, 'the budget line is left out');
        assert.equal(note.textContent, '');
    }
    assert.doesNotMatch(stats.textContent, /Points left: 10[\s\S]*Points left: 10/, 'the pill says it once');
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-push').textContent, 'Points left: 10');
    const actions = card.querySelector('.rpg-wiz-stats-actions');
    assert.deepEqual([...actions.children].map(node => node.className.split(' ').find(name => name.startsWith('rpg-'))), ['rpg-wiz-reset', 'rpg-sheet-note'], 'Reset, then the help, in the card');
    assert.deepEqual([...card.children].map(node => String(node.className).split(' ')[0]), ['rpg-sheet-body', 'rpg-actions', 'rpg-wiz-growth'], 'the card is the grid, them, then the growth line');
    // The budget still limits: spend all ten and the next + is off.
    for (const stat of ['str', 'vit']) for (let n = 0; n < 5; n += 1) wizardOf(dialog).querySelector(`.rpg-stat-step[data-stat="${stat}"] .ss-w-stepper-inc`).click();
    assert.equal(wizardOf(dialog).querySelector('.rpg-stat-step[data-stat="agi"] .ss-w-stepper-inc').disabled, true);
    dialog.close();
});

test('2.9.2: after a + or a − the Stats step still shows no "Points left" under a stat; Reset and Back/Next keep it out too', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    const dialog = await openFrom(ctx, { empty: true });
    let stats = await goTo(dialog, 'stats');
    const notes = () => wizardOf(dialog).querySelectorAll('.rpg-stat-step .ss-w-stepper-budget');
    const noneShown = why => {
        assert.equal(notes().length, STATS.length, why);
        for (const note of notes()) { assert.equal(note.hidden, true, why); assert.equal(note.textContent, '', why); }
    };
    wizardOf(dialog).querySelector('.rpg-stat-step[data-stat="agi"] .ss-w-stepper-inc').click();
    noneShown('after a +');
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-push').textContent, 'Points left: 9', 'the pill still counts');
    wizardOf(dialog).querySelector('.rpg-stat-step[data-stat="luk"] .ss-w-stepper-dec').click();
    noneShown('after a −');
    stats = await goTo(dialog, 'skills');
    stats = await goTo(dialog, 'stats');
    noneShown('after Back and Next');
    click(stats, 'Reset');
    wizardOf(dialog).querySelector('.rpg-stat-step[data-stat="str"] .ss-w-stepper-inc').click();
    noneShown('after Reset and a +');
    dialog.close();
});

test('2.9.3: the wizard\'s own root gets the grid and the 12px gap, so the summary row and the step below are spaced apart', async t => {
    const css = readFileSync(new URL('../../../../modules/rpg/view/lean-rpg.css', import.meta.url), 'utf8');
    assert.match(css, /(^|\n)\.ss-w-rpg-wizard \{ display: grid; gap: 12px; min-width: 0; \}/, 'the rule names the class the root really has');
    assert.doesNotMatch(css, /(^|\n)\.rpg-wizard \{/, 'no rule for a class nothing carries');
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    const dialog = await openFrom(ctx, { empty: true });
    await goTo(dialog, 'stats');
    const root = wizardOf(dialog);
    assert.ok(root.classList.contains('ss-w-rpg-wizard'));
    assert.deepEqual([...root.children].map(node => String(node.className).split(' ')[0]), ['rpg-wiz-sum', 'rpg-wiz-body'], 'the summary row, then the step, both children of that root');
    dialog.close();
});

test('2.9.1: the Stats card\'s stylesheet: padding in the card, an even grid beside the radar centred, two columns then the radar below on a phone; the Spend points view is untouched', () => {
    const css = readFileSync(new URL('../../../../modules/rpg/view/lean-rpg.css', import.meta.url), 'utf8');
    assert.match(css, /\.rpg-wiz-stats-card \{[^}]*padding: 14px 16px;[^}]*background: var\(--ss-tile\)/);
    assert.match(css, /\.rpg-wiz-stats-body \{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 300px\);[^}]*align-items: center;/);
    assert.match(css, /\.rpg-wiz-steppers \{[^}]*grid-template-columns: repeat\(auto-fill, minmax\(112px, 1fr\)\);/);
    const phone = css.slice(css.indexOf('@media (max-width: 600px) {\n    .rpg-wiz-grid'));
    assert.match(phone, /\.rpg-wiz-stats-body \{ grid-template-columns: minmax\(0, 1fr\);/);
    assert.match(phone, /\.rpg-wiz-steppers \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
    assert.match(phone, /\.rpg-wiz-stats-card \.rpg-radar \{ justify-self: center; \}/);
    assert.match(css, /\.rpg-steppers \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); gap: 10px 14px; \}/, 'the Party tab\'s grid is as it was');
});

test('Levels: the Who step has "Starting level" (1 unless changed, 1 to 99); the header says "Lv N", a draft keeps it, and Create writes it as the block\'s level default', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    const dialog = await openFrom(ctx, { empty: true });
    const who = wizardOf(dialog);
    const level = who.querySelector('[data-wiz="level"]');
    assert.equal(level.value, '1', 'the default');
    assert.deepEqual([level.getAttribute('type'), level.getAttribute('min'), level.getAttribute('max')], ['number', '1', '99']);
    assert.match(who.textContent, /Starting level/);
    assert.match(who.textContent, /1 to 99\. The story can set a level cap \(default 99\)\./);
    assert.match(who.querySelector('.rpg-wiz-sub').textContent, /^You · Lv 1$/);
    assert.match(who.textContent, /Starts at Lv 1 with 0 XP\./);
    type(level, '7');
    assert.match(wizardOf(dialog).querySelector('.rpg-wiz-sub').textContent, /^You · Lv 7$/, 'the header follows');
    assert.match(wizardOf(dialog).textContent, /Starts at Lv 7 with 0 XP\./);
    const again = await goTo(await (async () => { await goTo(dialog, 'stats'); return dialog; })(), 'who');
    assert.equal(again.querySelector('[data-wiz="level"]').value, '7', 'Back keeps it');
    const review = await goTo(dialog, 'review');
    assert.match(review.textContent, /Starts at Lv 7, 0 XP, full Health, Mana and Stamina\./);
    dialog.close();
});

test('Levels: the starting level of a draft is held 1 to 99, 1 is not stored, and the Character block gets it as its level default', () => {
    assert.equal(readDraft({ level: 120 }).level, 99);
    assert.equal(readDraft({ level: 1 }).level, undefined);
    assert.equal(readDraft({ soul: 3 }).level, 25, 'a companion\'s or an old file\'s Soul Class stands for the level 10n - 5');
    assert.equal(newDraft({ persona: 'Wessel' }).level, undefined, 'a new character starts at Level 1');
    const state = buildDefinitions({ ...newDraft({ persona: 'Wessel' }), level: 5 }, { used: [] }).character.state;
    assert.equal((state.level ?? state.soul).default, 5);
    assert.equal((buildDefinitions(newDraft({ persona: 'Wessel' }), { used: [] }).character.state.level ?? { default: 1 }).default, 1);
});

test('F13: the Starting level is held to the story\'s level cap (the setting here), in the box and in the block it makes', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await ctx.host.settings.set('story-block', 'rpgLevelCap', 40);
    await begin(ctx.host);
    const dialog = await openFrom(ctx, { empty: true });
    const level = wizardOf(dialog).querySelector('[data-wiz="level"]');
    assert.equal(level.getAttribute('max'), '40');
    type(level, '70');
    assert.match(wizardOf(dialog).querySelector('.rpg-wiz-sub').textContent, /^You · Lv 40$/, 'the header holds it to the cap');
    wizardOf(dialog).querySelector('[data-wiz="level"]').dispatch('change');
    assert.equal(wizardOf(dialog).querySelector('[data-wiz="level"]').value, '40', 'and so does the box once it settles');
});
