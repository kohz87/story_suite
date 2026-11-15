// The New character wizard (src/v2/lean-rpg/view/wizard.js and wizard-data.js, mockup 41-wizard): the dialog on the real page — opening, Who, Stats, Skills, Review.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATS } from '../../../../src/v2/lean-rpg/index.js';
import { WIZARD_SCREEN_ID } from '../../../../src/v2/lean-rpg/view/wizard.js';
import { begin, makeBlocks, page, party } from './page.js';
import { FIGHTER, PACK, click, goTo, openFrom, type, wizardOf } from './wizard.helpers.js';

// ---- the dialog on the real page -------------------------------------------------------------------------------------------------

test('"Create your character" in the empty state and "+ New character" in the header both open the wide dialog', async t => {
    const empty = await page(t, { persona: 'Wessel' });
    await begin(empty.host);
    const first = await openFrom(empty, { empty: true });
    assert.ok(first, 'the empty state has the button');
    assert.equal(first.screenId, WIZARD_SCREEN_ID);
    assert.ok(first.root.classList.contains('ss-dialog-wide'));
    assert.equal(first.root.querySelector('.ss-dialog-title').textContent, 'New character');
    assert.deepEqual(first.root.querySelectorAll('.ss-dialog-step').map(node => node.textContent), ['Who', 'Stats', 'Skills', 'Review']);
    assert.equal(first.root.querySelector('.ss-dialog-step[aria-current="step"]').textContent, 'Who');
    assert.ok(!party(empty.doc).querySelector('.rpg-new'), 'no header button while there is nobody (the empty state has its own)');
    first.close();

    const some = await page(t, { persona: 'Wessel' });
    await begin(some.host);
    await makeBlocks(some.host, { who: 'Ren' });
    await some.host.send('Go.', 'The quay.');
    const second = await openFrom(some);
    assert.ok(second, '"+ New character" in the header');
    assert.equal(party(some.doc).querySelector('.rpg-new').textContent, '+ New character');
    second.close();
    assert.equal(some.ui.mounts.dialog.current(), null);
});

test('Who: the persona\'s name, You or A companion, who they are with its count; Back and Next keep what was typed', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    const dialog = await openFrom(ctx, { empty: true });
    const who = wizardOf(dialog);
    assert.equal(who.querySelector('[data-wiz="name"]').value, 'Wessel');
    assert.match(who.textContent, /From your persona\. You can change it here\./);
    assert.deepEqual(who.querySelectorAll('.rpg-wiz-seg button').map(node => [node.textContent, node.getAttribute('aria-pressed')]), [['You', 'true'], ['A companion', 'false']]);
    assert.equal(who.querySelector('.rpg-wiz-sum .rpg-wiz-name').textContent, 'Wessel');
    assert.match(who.querySelector('.rpg-wiz-sub').textContent, /^You · Lv 1$/);
    assert.equal(who.querySelector('.rpg-wiz-push').textContent, 'Points left: 10');
    const about = who.querySelector('[data-wiz="about"]');
    assert.equal(about.getAttribute('maxlength'), '240');
    type(about, 'A drill-yard washout from Bluewatch.');
    assert.equal(who.querySelector('.rpg-wiz-count').textContent, '36 / 240');
    type(who.querySelector('[data-wiz="name"]'), 'Wess');
    assert.equal(who.querySelector('.rpg-wiz-sum .rpg-wiz-name').textContent, 'Wess', 'the summary row follows');
    const stats = await goTo(dialog, 'stats');
    assert.ok(stats);
    const again = await goTo(dialog, 'who');
    assert.equal(again.querySelector('[data-wiz="name"]').value, 'Wess');
    assert.equal(again.querySelector('[data-wiz="about"]').value, 'A drill-yard washout from Bluewatch.');
    click(again, 'A companion');
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-sub').textContent, 'Companion · Lv 1');
    assert.equal(wizardOf(dialog).querySelector('[data-wiz="name"]').value, 'Wess');
    click(wizardOf(dialog), 'You');
    assert.equal(wizardOf(dialog).querySelector('[data-wiz="name"]').value, 'Wessel', 'You takes the persona\'s name');
    dialog.close();
});

test('Stats: steppers under 10 points, a stat down to 3 frees a point and up to 10, with the radar and the summary row following', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    const dialog = await openFrom(ctx, { empty: true });
    let stats = await goTo(dialog, 'stats');
    const step = (stat, dir) => wizardOf(dialog).querySelector(`.rpg-stat-step[data-stat="${stat}"] .ss-w-stepper-${dir}`);
    const value = stat => wizardOf(dialog).querySelector(`.rpg-stat-step[data-stat="${stat}"] input`)?.value ?? wizardOf(dialog).querySelector(`.rpg-stat-step[data-stat="${stat}"]`).textContent;
    assert.deepEqual(stats.querySelectorAll('.rpg-stat-step').map(node => node.getAttribute('data-stat')), [...STATS]);
    assert.ok(stats.querySelector('.rpg-radar .ss-w-radar'), 'the radar');
    for (let n = 0; n < 5; n += 1) step('str', 'inc').click();
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-push').textContent, 'Points left: 5');
    assert.match(wizardOf(dialog).querySelector('.rpg-wiz-sum').textContent, /STR 10/, 'the summary row');
    assert.equal(step('str', 'inc').disabled, true, 'STR stops at 10');
    assert.equal(step('vit', 'inc').disabled, false, 'five points left');
    for (let n = 0; n < 5; n += 1) step('vit', 'inc').click();
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-push').textContent, 'Points left: 0');
    assert.equal(step('agi', 'inc').disabled, true, 'no points left');
    step('dex', 'dec').click();
    step('dex', 'dec').click();
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-push').textContent, 'Points left: 2', 'DEX 3 frees two');
    assert.equal(step('dex', 'dec').disabled, true, 'nothing goes below 3');
    assert.match(wizardOf(dialog).querySelector('.rpg-wiz-sum').textContent, /STR 10 · VIT 10 · AGI 5 · DEX 3/);
    // Back and forth keeps them; Reset puts every stat back at 5.
    stats = await goTo(dialog, 'skills');
    stats = await goTo(dialog, 'stats');
    assert.match(stats.querySelector('.rpg-wiz-sum').textContent, /STR 10 · VIT 10 · AGI 5 · DEX 3/);
    click(stats, 'Reset');
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-push').textContent, 'Points left: 10');
    assert.match(wizardOf(dialog).querySelector('.rpg-wiz-sum').textContent, /STR 5 · VIT 5 · AGI 5 · DEX 5/);
    assert.match(wizardOf(dialog).textContent, /Every stat starts at 5\. Spend 10 points; a stat can go down to 3 to free a point and up to 10 now\./);
    dialog.close();
});

test('Skills: the five built-in sets and a pack\'s, rows with Stat, Uses and Starts at, one Adept at most, up to five, remove, never a rank to type', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    assert.equal((await ctx.host.packs.packs.install(PACK)).ok, true);
    await begin(ctx.host);
    const dialog = await openFrom(ctx, { empty: true });
    let skills = await goTo(dialog, 'skills');
    const cards = () => wizardOf(dialog).querySelectorAll('.rpg-wiz-card');
    assert.deepEqual(cards().map(card => card.querySelector('b').textContent), ['Guild fighter', 'River scout', 'Hedge mage', 'Field medic', 'Silver tongue', 'Sealwarden recruit']);
    assert.deepEqual(cards().map(card => card.querySelector('.rpg-wiz-card-src').textContent), ['Built in', 'Built in', 'Built in', 'Built in', 'Built in', 'From the Ersveil pack']);
    assert.equal(cards()[2].querySelector('.rpg-wiz-card-skills').textContent, 'Spark (INT, mana) · Ward (INT, mana) · Lore (INT)');
    assert.equal(cards()[5].querySelector('.rpg-wiz-card-skills').textContent, 'Spear (STR) · Ward-reading (INT, mana) · Gatecraft (VIT)');
    assert.deepEqual(cards().map(card => card.getAttribute('aria-pressed')), ['false', 'false', 'false', 'false', 'false', 'false']);
    assert.match(skills.textContent, /Up to 8 skills, each with what it does, the stat it rolls with and what it uses\. Up to three can be utility skills, for the story only: they stay off the fight board and take no combat slot\. One may start at Adept, the rest are Novice\./);
    cards()[0].click();
    skills = wizardOf(dialog);
    assert.deepEqual(cards().map(card => card.getAttribute('aria-pressed')), ['true', 'false', 'false', 'false', 'false', 'false']);
    assert.equal(cards()[0].querySelector('.rpg-wiz-tag').textContent, 'Used');
    const rows = () => wizardOf(dialog).querySelectorAll('.rpg-wiz-row[data-skill]');
    assert.equal(rows().length, 3);
    assert.deepEqual(rows().map(row => row.querySelector('[data-field="name"]').value), ['Short blade', 'Iron Breath', 'Shield work']);
    assert.equal(rows()[0].querySelector('[data-field="about"]').value, FIGHTER.skills[0].about);
    assert.deepEqual(rows().map(row => [row.querySelector('[data-field="stat"]').value, row.querySelector('[data-field="uses"]').value, row.querySelector('[data-field="start"]').value]),
        [['agi', 'stamina', '0'], ['vit', 'stamina', '0'], ['str', 'stamina', '0']]);
    assert.deepEqual(rows()[0].querySelector('[data-field="stat"]').querySelectorAll('option').map(node => node.textContent), ['STR', 'VIT', 'AGI', 'DEX', 'INT', 'LUK', 'CHA']);
    assert.deepEqual(rows()[0].querySelector('[data-field="uses"]').querySelectorAll('option').map(node => node.textContent), ['Stamina', 'Mana']);
    assert.deepEqual(rows()[0].querySelector('[data-field="start"]').querySelectorAll('option').map(node => node.textContent), ['Novice', 'Adept']);
    assert.equal(wizardOf(dialog).querySelectorAll('input, select, textarea').filter(node => /rank|practice/i.test(`${node.getAttribute('data-field')} ${node.getAttribute('aria-label')}`)).length, 0, 'rank and practice are never typed');
    // Edit a row, change its stat and resource: the summary row follows.
    type(rows()[0].querySelector('[data-field="name"]'), 'Blade work');
    rows()[1].querySelector('[data-field="stat"]').value = 'int';
    rows()[1].querySelector('[data-field="stat"]').dispatch('change');
    rows()[1].querySelector('[data-field="uses"]').value = 'mana';
    rows()[1].querySelector('[data-field="uses"]').dispatch('change');
    assert.match(wizardOf(dialog).querySelector('.rpg-wiz-sum').textContent, /Blade work, Iron Breath, Shield work/);
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-push').textContent, '3 of 8 skills');
    // One Adept: the others' Adept option is off once one is taken.
    rows()[0].querySelector('[data-field="start"]').value = '1';
    rows()[0].querySelector('[data-field="start"]').dispatch('change');
    const adept = row => row.querySelector('[data-field="start"]').querySelectorAll('option').find(node => node.textContent === 'Adept');
    assert.deepEqual(rows().map(row => adept(row).hasAttribute('disabled')), [false, true, true], 'only the Adept one may keep Adept');
    assert.equal(rows()[0].querySelector('[data-field="start"]').value, '1');
    rows()[1].querySelector('[data-field="start"]').value = '1';
    rows()[1].querySelector('[data-field="start"]').dispatch('change');
    assert.deepEqual(rows().map(row => row.querySelector('[data-field="start"]').value), ['1', '0', '0'], 'a second Adept is refused');
    // Add up to five, then no more; remove frees the slot (and the Adept).
    for (let more = 0; more < 5; more += 1) click(wizardOf(dialog), '+ Add a skill');
    assert.equal(rows().length, 8);
    assert.equal(wizardOf(dialog).querySelector('.rpg-wiz-add-button').disabled, true);
    assert.match(wizardOf(dialog).querySelector('.rpg-wiz-add .rpg-wiz-note').textContent, /^All slots are used\./);
    rows()[0].querySelector('.rpg-wiz-x').click();
    assert.equal(rows().length, 7);
    assert.deepEqual(rows().map(row => adept(row).hasAttribute('disabled')), Array(7).fill(false), 'the Adept one is gone: Adept is free again');
    assert.match(wizardOf(dialog).querySelector('.rpg-wiz-add .rpg-wiz-note').textContent, /^1 slot left\./);
    // A pack set replaces the rows.
    cards()[5].click();
    assert.deepEqual(rows().map(row => row.querySelector('[data-field="name"]').value), ['Spear', 'Ward-reading', 'Gatecraft']);
    assert.equal(rows()[1].querySelector('[data-field="uses"]').value, 'mana');
    assert.equal(cards()[5].querySelector('.rpg-wiz-tag').textContent, 'Used');
    dialog.close();
});

test('Review shows everything and what is in the way; Create waits for a name and for every skill to say what it does', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    const dialog = await openFrom(ctx, { empty: true });
    let skills = await goTo(dialog, 'skills');
    click(skills, '+ Add a skill');
    type(wizardOf(dialog).querySelector('.rpg-wiz-row[data-skill] [data-field="name"]'), 'Spark');
    let review = await goTo(dialog, 'review');
    assert.match(review.textContent, /Wessel · You/);
    assert.match(review.textContent, /Makes two blocks: "Wessel" and "Wessel's skills"\./);
    assert.match(review.textContent, /10 unspent points go to Spend points on the Party tab\./);
    assert.match(review.textContent, /Spark · STR · Stamina · starts at Novice/);
    const create = () => wizardOf(dialog).querySelector('.rpg-wiz-create');
    assert.equal(create().disabled, true);
    assert.deepEqual(wizardOf(dialog).querySelectorAll('.rpg-wiz-problems li').map(node => node.textContent), ['Fix this first:', 'Spark needs a line about what it does.']);
    skills = await goTo(dialog, 'skills');
    type(skills.querySelector('.rpg-wiz-row[data-skill] [data-field="about"]'), 'A small burst.');
    review = await goTo(dialog, 'review');
    assert.equal(create().disabled, false);
    assert.ok(wizardOf(dialog).querySelector('.rpg-wiz-problems').hidden);
    dialog.close();
});
