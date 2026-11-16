// Settings → RPG (src/v2/lean-rpg/view/settings.js and settings-data.js): the page in the settings window, Rolls, Difficulty with the
// Custom numbers and the live odds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom } from '../../../ui/view/mounts/helpers.js';
import { CORE_FEATURE } from '../../../../core/features.js';
import { DIFFICULTY_SETTING, STANDARD_PRESETS, STANDARD_SETTING } from '../../../../modules/rpg/index.js';
import { renderRpgSettings, rollsOf, rpgSection } from '../../../../modules/rpg/view/settings.js';
import { makeBlocks, settle } from './page.js';
import { characterDefinition, fakeState, foesDefinition, roleOf, skillsDefinition } from './helpers.js';
import { oddsText, open, rail, typeInto } from './settings.helpers.js';

test('the page is its own rail entry after Features, with its cards in order and the words of the mockup', async t => {
    const { doc, root, card } = await open(t);
    assert.deepEqual(rail(doc).slice(0, 3), ['Look', 'Features', 'RPG']);
    assert.equal(root.querySelector('.ss-settings-page-sub').textContent, 'How the dice work, and what the narrator is told.');
    assert.deepEqual(root.querySelectorAll('.rpg-set-title').map(node => node.textContent), ['Stat formula', 'Levels and practice', 'Gear in fights', 'Rolls', 'Difficulty', 'What the narrator is told about combat', 'Companions who join']);
    assert.match(card('formula').textContent, /New character bars: Health 2 × \(4 \+ VIT\/5\)/);
    assert.match(card('formula').textContent, /Earlier characters keep Health 4 \+ VIT\/5/);
    assert.deepEqual(card('rolls').querySelectorAll('.rpg-chip').map(node => node.textContent), ['Automatic', 'Off']);
    assert.match(card('rolls').textContent, /Automatic: code rolls the dice for the fights you play on the fight board\. Off: no dice; the story decides\./);
    assert.equal(card('checks').querySelector('b').textContent, 'Story checks');
    assert.equal(card('checks').querySelector('.rpg-set-help').textContent, 'Rolls for attempts outside a fight, before the reply. Off: the narrator decides them, as now.');
    assert.deepEqual(card('difficulty').querySelectorAll('.rpg-chip').map(node => node.textContent), ['Gentle', 'Standard', 'Harsh', 'Custom']);
    assert.equal(card('difficulty').querySelector('[aria-pressed="true"]').textContent, 'Standard', 'Standard until the reader says otherwise');
    assert.equal(card('difficulty').querySelectorAll('.rpg-set-nums').length, 0, 'the numbers are for Custom');
    assert.match(card('difficulty').textContent, /Changes count from the next reply; rolls already made keep the numbers they were rolled with, and a Re-read keeps them too\./);
});

test('Story checks has a visible switch, on by default, which saves both choices', async t => {
    const { card, stored, root } = await open(t);
    const toggle = () => root.querySelector('[data-card="checks"] [role="switch"]');
    assert.equal(toggle().getAttribute('aria-label'), 'Story checks');
    assert.equal(toggle().getAttribute('aria-checked'), 'true');
    toggle().click();
    await settle();
    assert.equal(stored().rpgChecks, false);
    assert.equal(toggle().getAttribute('aria-checked'), 'false');
    toggle().click();
    await settle();
    assert.equal(stored().rpgChecks, true);
    assert.equal(toggle().getAttribute('aria-checked'), 'true');
    assert.ok(card('checks').textContent.includes('Story checks'));
});

test('Rolls: Automatic or Off, through the existing setting', async t => {
    const { card, stored, root } = await open(t);
    assert.equal(rollsOf(() => stored()), 'automatic');
    card('rolls').querySelector('.rpg-chip[data-value="off"]').click();
    await settle();
    assert.equal(stored().rpgRolls, 'off');
    assert.equal(root.querySelector('[data-card="rolls"] [aria-pressed="true"]').textContent, 'Off');
    root.querySelector('[data-card="rolls"] .rpg-chip[data-value="automatic"]').click();
    assert.equal(stored().rpgRolls, 'automatic');
});

test('Fight board uses the same feature switch as Features', async t => {
    const { host, card, root } = await open(t);
    assert.equal(host.registry.featureOn(CORE_FEATURE.fightBoard), true);
    assert.ok(card('rolls').querySelector('[data-card="board"]'), 'the switch is beside Rolls');
    card('board').querySelector('[role="switch"]').click();
    assert.equal(host.registry.featureOn(CORE_FEATURE.fightBoard), false);
    assert.equal(root.querySelector('[data-card="board"] [role="switch"]').getAttribute('aria-checked'), 'false');
    root.querySelector('[data-card="board"] [role="switch"]').click();
    assert.equal(host.registry.featureOn(CORE_FEATURE.fightBoard), true);
});

test('Companions who join: Ask by default, then Automatically or Off, through the rpgJoin setting', async t => {
    const { card, stored, root } = await open(t);
    assert.deepEqual(card('join').querySelectorAll('.rpg-chip').map(node => node.textContent), ['Ask', 'Automatically', 'Off']);
    assert.equal(card('join').querySelector('[aria-pressed="true"]').textContent, 'Ask', 'the default');
    assert.equal(stored().rpgJoin, undefined, 'nothing is stored until the reader chooses');
    assert.match(card('join').textContent, /When the story says someone joins the party for good, the RPG can make their character\./);
    card('join').querySelector('.rpg-chip[data-value="auto"]').click();
    assert.equal(stored().rpgJoin, 'auto');
    assert.equal(root.querySelector('[data-card="join"] [aria-pressed="true"]').textContent, 'Automatically');
    root.querySelector('[data-card="join"] .rpg-chip[data-value="off"]').click();
    assert.equal(stored().rpgJoin, 'off');
    root.querySelector('[data-card="join"] .rpg-chip[data-value="ask"]').click();
    assert.equal(root.querySelector('[data-card="join"] [aria-pressed="true"]').textContent, 'Ask');
});

test('Difficulty: a preset is one tap and the odds follow it live; the others are compared on a line', async t => {
    const { root, card, stored } = await open(t);
    assert.equal(card('difficulty').querySelector('.rpg-odds-title').textContent, 'Wessel (STR 12 with DEX 5, Soul Class I, Adept) against a Class I foe');
    assert.equal(oddsText(card('difficulty')), 'Success 69%At a cost 7%Fail 25%');
    assert.equal(card('difficulty').querySelector('.rpg-odds-bar').getAttribute('aria-label'), 'Success 69%, at a cost 7%, fail 25%');
    assert.deepEqual(['success', 'cost', 'fail'].map(kind => card('difficulty').querySelector(`.rpg-odds-bar .rpg-odds-${kind}`).style.getPropertyValue('--rpg-odds')), ['69', '7', '25']);
    assert.equal(card('difficulty').querySelector('.rpg-odds-compare').textContent, 'For comparison, same fight: Gentle 76 / 6 / 19 · Harsh 61 / 8 / 31.');
    card('difficulty').querySelector('.rpg-chip[data-value="gentle"]').click();
    assert.equal(stored()[DIFFICULTY_SETTING], 'gentle');
    assert.equal(oddsText(root.querySelector('[data-card="difficulty"]')), 'Success 76%At a cost 6%Fail 19%');
    assert.equal(root.querySelector('.rpg-odds-compare').textContent, 'For comparison, same fight: Standard 69 / 7 / 25 · Harsh 61 / 8 / 31.');
    root.querySelector('[data-card="difficulty"] .rpg-chip[data-value="harsh"]').click();
    assert.equal(oddsText(root.querySelector('[data-card="difficulty"]')), 'Success 61%At a cost 8%Fail 31%');
    assert.equal(root.querySelector('[data-card="difficulty"] [aria-pressed="true"]').textContent, 'Harsh');
});

test('Custom: thirteen fields with their ranges, started from the numbers in force; typed numbers are held to range and move the odds live', async t => {
    const { root, card, stored } = await open(t);
    card('difficulty').querySelector('.rpg-chip[data-value="harsh"]').click();
    root.querySelector('[data-card="difficulty"] .rpg-chip[data-value="custom"]').click();
    assert.equal(stored()[DIFFICULTY_SETTING], 'custom');
    assert.deepEqual(stored()[STANDARD_SETTING], STANDARD_PRESETS.harsh, 'a first switch to Custom starts where the reader was');
    const grid = card('difficulty').querySelector('.rpg-set-nums');
    assert.deepEqual(grid.querySelectorAll('.rpg-set-num > span').map(node => node.textContent),
        ['Foe\'s base', 'Foe adds per class', 'Level divisor', '"At a cost" when short by', 'Decisive at a margin of', 'Most exchanges per reply', 'Quick start at a lead of',
            'Stats start at', 'Points to spend at creation', 'Lowest stat at creation', 'Highest stat at creation', 'Points per Soul Class rise', 'Highest a stat can be']);
    assert.deepEqual(grid.querySelectorAll('small').slice(0, 3).map(node => node.textContent), ['Gentle 2 · Standard 4 · Harsh 6', '1 to 5', 'a roll adds level ÷ this (3 to 8, 5 unset); foes on a new Foes block (harder foes) always use ÷ 4']);
    const input = key => root.querySelector(`[data-rule="${key}"]`);
    assert.deepEqual(['foeBase', 'costMargin', 'decisiveMargin', 'roundCap'].map(key => [input(key).getAttribute('min'), input(key).getAttribute('max')]), [['0', '15'], ['0', '5'], ['4', '15'], ['1', '8']]);
    assert.deepEqual(input('levelDivisor').querySelectorAll('option').map(node => node.textContent), ['÷3', '÷4', '÷5', '÷6', '÷7', '÷8']);
    assert.equal(input('levelDivisor').value, '5', 'the divisor starts at 5');
    assert.equal(input('classWeight'), null, 'no Soul Class weight row: it is not Standard\'s');
    assert.equal(input('statDivisor'), null, 'no stat divisor row: Classic is gone');
    assert.equal(oddsText(root), 'Success 61%At a cost 8%Fail 31%', 'Harsh\'s numbers, so Harsh\'s odds');
    typeInto(input('foeBase'), '2');
    assert.deepEqual(stored()[STANDARD_SETTING], { ...STANDARD_PRESETS.gentle }, 'foe base 2 is Gentle');
    assert.equal(oddsText(root), 'Success 76%At a cost 6%Fail 19%', 'the odds follow at once, with no redraw of the box');
    typeInto(input('foeBase'), '40');
    assert.equal(stored()[STANDARD_SETTING].foeBase, 15, 'held to its range');
    assert.equal(input('foeBase').value, '15');
    typeInto(input('roundCap'), '0');
    assert.equal(stored()[STANDARD_SETTING].roundCap, 1);
    typeInto(input('decisiveMargin'), '2');
    assert.equal(stored()[STANDARD_SETTING].decisiveMargin, 4);
    typeInto(input('costMargin'), '3');
    typeInto(input('costMargin'), 'many');
    assert.equal(stored()[STANDARD_SETTING].costMargin, 3, 'not a number: put back');
    assert.equal(input('costMargin').value, '3');
    input('levelDivisor').value = '3';
    input('levelDivisor').dispatch('change');
    assert.equal(stored()[STANDARD_SETTING].levelDivisor, 3, 'the divisor is written to rpgStandard.levelDivisor');
    assert.equal(root.querySelector('.rpg-odds-title').textContent.includes('Wessel'), true);
    // The numbers that roll are these, held to range, whatever was typed.
    assert.deepEqual(Object.keys(stored()[STANDARD_SETTING]), [...Object.keys(STANDARD_PRESETS.gentle), 'levelDivisor']);
});

test('the odds are for the persona\'s own character, else the first Character block; no character, no odds', async t => {
    const ctx = await open(t, { blocks: false });
    assert.equal(ctx.card('difficulty').querySelector('.rpg-odds').hidden, true, 'no character yet');
    assert.equal(ctx.card('difficulty').querySelector('.rpg-odds-compare').hidden, true);
    // A character appears while the page is open: the odds follow the story.
    await makeBlocks(ctx.host, { who: 'Wessel', character: { str: 12, soul: 1 }, skills: { skill1: 'Iron Breath', stat1: 'str', rank1: 1 } });
    await settle();
    assert.equal(oddsText(ctx.root.querySelector('[data-card="difficulty"]')), 'Success 69%At a cost 7%Fail 25%');
    // The odds also follow the sheet: a Soul Class of II against a Class II foe.
    const set = await ctx.host.sdk.command('dm.set', { module: 'pack.chat/wessel', field: 'soul', value: 2 });
    assert.equal(set.ok, true);
    await settle();
    assert.match(ctx.root.querySelector('.rpg-odds-title').textContent, /Soul Class II, Adept\) against a Class II foe/);
});

test('searching finds the page by what it says; the page is hidden when nothing matches or the feature is off', async t => {
    const { host, root, win } = await open(t);
    const body = renderRpgSettings(root.parentNode, { settings: host.settings, doc: root.ownerDocument, headState: () => host.head(), readerName: () => 'Wessel', roleOf });
    assert.equal(body.filter('harsh'), 1, 'Difficulty');
    assert.equal(body.filter('planner'), 0, 'the roll planner is gone');
    assert.equal(body.filter('combat rules'), 1);
    assert.equal(body.filter('gentle harsh'), 1);
    assert.equal(body.filter('automatic'), 2, 'Rolls, and Companions who join (Automatically)');
    assert.equal(body.filter('story checks'), 1, 'Rolls includes the Story checks switch');
    assert.equal(body.filter('companions'), 1);
    assert.equal(body.filter('nothing like it'), 0);
    assert.equal(body.el.querySelectorAll('.rpg-set-card').filter(node => !node.hidden).length, 0);
    assert.equal(body.filter(''), 6);
    assert.equal(body.filter('xp rate'), 1, 'Levels and practice');
    assert.equal(body.filter('level cap'), 1);
    body.destroy();
    host.features.set(CORE_FEATURE.leanRpg, false);
    await settle();
    assert.equal(win.section(), 'features');
    assert.ok(!rail(root.ownerDocument).includes('RPG'));
});

test('the section record: its place, its words, and hidden with the feature', () => {
    const on = { value: true };
    const section = rpgSection({ featureOn: () => on.value });
    assert.deepEqual([section.id, section.label, section.title, section.after, section.icon], ['rpg', 'RPG', 'RPG', 'features', 'fa-dice-d20']);
    assert.equal(section.visible(), true);
    on.value = false;
    assert.equal(section.visible(), false);
    assert.equal(typeof section.body, 'function');
});

test('names from the story are text in the odds line and the prompt, never markup', async t => {
    const MARK = '<img src=x onerror="globalThis.pwned=1"><b>bold</b>';
    const state = fakeState([
        { definition: { ...characterDefinition('wessel', MARK), role: 'character' }, fields: { who: MARK, str: 12 } },
        { definition: { ...skillsDefinition('wessel-skills', MARK), role: 'skills' }, fields: { who: MARK, skill1: MARK, rank1: 1 } },
        { definition: { ...foesDefinition(), role: 'foes' }, fields: { foe1: MARK, count1: 2 } },
    ]);
    const doc = setupDom(), pane = doc.createElement('div');
    doc.body.appendChild(pane);
    const settings = Object.assign(() => ({}), { set: () => '' });
    const body = renderRpgSettings(pane, { settings, doc, headState: () => state, readerName: () => MARK, roleOf });
    assert.ok(pane.textContent.includes(MARK), 'shown as text');
    assert.equal(pane.querySelectorAll('img, script, iframe, style, a').length, 0);
    assert.equal(globalThis.pwned, undefined);
    body.destroy();
    void t;
});

test('Levels and practice holds Practice per skill use: a whole number from 1 to 5 (3 unset), typed numbers held to range, saved as a setting for later rolls', async t => {
    const { card, stored } = await open(t);
    assert.equal(card('rolls').querySelector('[data-setting="rpgPracticePerUse"]'), null, 'moved out of the Rolls card');
    const input = card('levels').querySelector('[data-setting="rpgPracticePerUse"]');
    assert.equal(input.value, '3');
    assert.equal(input.getAttribute('min'), '1');
    assert.equal(input.getAttribute('max'), '5');
    assert.match(card('levels').textContent, /Practice per skill use/);
    for (const [typed, kept] of [['1', 1], ['5', 5], ['9', 5], ['0', 1], ['4.4', 4]]) {
        typeInto(input, typed);
        assert.equal(stored().rpgPracticePerUse, kept, typed);
        assert.equal(input.value, String(kept));
    }
    typeInto(input, 'abc');
    assert.equal(stored().rpgPracticePerUse, 4, 'not a number: put back');
});

test('Levels and practice: Level cap 1 to 99 (99 unset), Practice, and XP rate 50 to 300 % in steps of 25 (100 unset), each held to its range and saved', async t => {
    const { card, stored } = await open(t);
    const box = card('levels');
    assert.deepEqual(box.querySelectorAll('.rpg-set-num > span').map(node => node.textContent), ['Level cap', 'Practice per skill use', 'XP rate']);
    const cap = box.querySelector('[data-setting="rpgLevelCap"]'), rate = box.querySelector('[data-setting="rpgXpRate"]');
    assert.deepEqual([cap.value, cap.getAttribute('min'), cap.getAttribute('max')], ['99', '1', '99']);
    assert.deepEqual([rate.value, rate.getAttribute('min'), rate.getAttribute('max'), rate.getAttribute('step')], ['100', '50', '300', '25']);
    assert.match(box.textContent, /1 to 99, default 99\. A story or a pack can set its own cap\. 100 XP per level\./);
    assert.match(box.textContent, /1 to 5, default 3\./);
    assert.match(box.textContent, /50 to 300 %, in steps of 25, default 100\./);
    for (const [typed, kept] of [['40', 40], ['1', 1], ['150', 99], ['0', 1], ['12.4', 12]]) {
        typeInto(cap, typed);
        assert.equal(stored().rpgLevelCap, kept, `cap ${typed}`);
        assert.equal(cap.value, String(kept));
    }
    typeInto(cap, 'abc');
    assert.equal(stored().rpgLevelCap, 12, 'not a number: put back');
    for (const [typed, kept] of [['150', 150], ['10', 50], ['999', 300], ['130', 125], ['137', 125], ['138', 150]]) {
        typeInto(rate, typed);
        assert.equal(stored().rpgXpRate, kept, `rate ${typed}`);
        assert.equal(rate.value, String(kept));
    }
    typeInto(rate, '');
    assert.equal(stored().rpgXpRate, 150, 'empty: put back');
});

test('the roll table and the tiles say level: level ÷ 5 in every row, "1 per 3 levels", "4 + level ÷ 5"', async t => {
    const { card, root } = await open(t);
    assert.equal(root.querySelector('[data-card="formula"] .rpg-chip'), null, 'Standard is the only formula: no chips');
    const rows = root.querySelector('[data-card="formula"]').querySelectorAll('.rpg-formula-table tr').map(row => row.textContent);
    assert.ok(rows.length >= 6 && rows.every(row => /level ÷ 5/.test(row)), rows.join(' | '));
    assert.match(rows.find(row => row.startsWith('Turn order')), /d20 \+ level ÷ 5 \+ AGI\/2.*foes the same with their own level/);
    assert.deepEqual(root.querySelector('[data-card="formula"]').querySelectorAll('.rpg-formula-num').slice(2).map(node => node.textContent), ['1 per 3 levelsStat points', '4 + level ÷ 5 (÷ 4 on a new Foes block)Foe\'s base']);
    assert.doesNotMatch(root.querySelector('[data-card="formula"]').textContent, /Soul/i);
});

test('F15: the Level cap is one row in Settings: the RPG page draws it, the Modules page does not draw the module schema\'s copy', async t => {
    const { doc, win, root } = await open(t);
    const rows = node => node.querySelectorAll('*').filter(item => item.children.length === 0 && item.textContent.trim() === 'Level cap');
    assert.equal(rows(root).length, 1, 'the RPG page: one Level cap row');
    win.select('modules');
    await settle();
    assert.equal(rows(doc).filter(node => !root.contains(node)).length, 0, 'the Modules page has none');
});
