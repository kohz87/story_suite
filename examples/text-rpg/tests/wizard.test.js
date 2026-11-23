import test from 'node:test';
import assert from 'node:assert/strict';
import { textRpgModule } from '../src/module.js';
import { pointsLeft, newDraft, payloadOf, problemsOf } from '../src/wizard/draft.js';
import { flush } from './helpers/fake-dom.js';
import { newHost, astraOf } from './helpers/host.js';
import { wizardPage } from './helpers/wizard-page.js';

const STEPS = ['Who', 'Stats', 'Skills', 'Review'];
const stepOf = page => page.q('.wz-body').dataset.step;
const next = page => page.press('[data-wiz="next"]');
const raise = (page, stat) => page.press(`[data-plus="${stat}"]`);
const lower = (page, stat) => page.press(`[data-minus="${stat}"]`);

test('the wizard draws the RPG wizard\'s markup: the four tabs, the summary row, the step body and the footer, on the sheet\'s wz overlay', () => {
    const page = wizardPage();
    assert.deepEqual(page.all('.wz-steps button').map(tab => tab.textContent), STEPS);
    assert.equal(page.q('.wz-steps [aria-selected="true"]').textContent, 'Who');
    assert.ok(page.q('section.wz-sum'), 'the summary row');
    assert.equal(page.q('.wz-body.wz-who .wz-form label.ef').textContent, 'Name');
    assert.equal(page.q('.wz-foot [data-wiz="next"]').className, 'btn2 pri');
    assert.equal(page.q('.wz-foot [data-wiz="back"]'), null, 'no Back on the first step');
    assert.ok(page.overlay.classList.contains('wz'));
    assert.equal(page.overlay.dataset.sheet, 'new-character');
});

test('each step draws: Stats rows with − and +, Skills with an add button, Review with Create in the footer', () => {
    const page = wizardPage();
    next(page);
    assert.equal(stepOf(page), 'stats');
    assert.equal(page.all('.ps-st').length, 7);
    assert.equal(page.q('.wz-left-pill').textContent, 'Points left: 0');
    assert.equal(page.q('[data-wiz="back"]').textContent, 'Back');
    next(page);
    assert.equal(stepOf(page), 'skills');
    assert.equal(page.q('[data-wiz="add"]').textContent, '+ Add a skill');
    next(page);
    assert.equal(stepOf(page), 'review');
    assert.equal(page.q('.wz-foot [data-wiz="create"]').textContent, 'Create');
    assert.equal(page.q('[data-wiz="next"]'), null);
    page.press('.wz-steps [data-value="who"]');
    assert.equal(stepOf(page), 'who');
});

test('points: all 60 are placed at the start; + needs a free point, − gives one back, each stat stays within 5..15, Reset starts again', () => {
    const page = wizardPage();
    next(page);
    assert.equal(page.q('[data-plus="str"]').hasAttribute('disabled'), true, 'nothing to place yet');
    lower(page, 'str');
    assert.equal(page.q('.wz-left-pill').textContent, 'Points left: 1');
    raise(page, 'cha');
    assert.equal(page.q('.wz-left-pill').textContent, 'Points left: 0');
    for (const stat of ['vit', 'dex', 'agi']) for (let n = 0; n < 6; n += 1) lower(page, stat);
    assert.equal(page.q('[data-stat="vit"] .v').textContent, '5');
    assert.equal(page.q('[data-minus="vit"]').hasAttribute('disabled'), true, 'a stat does not go below 5');
    for (let n = 0; n < 12; n += 1) raise(page, 'int');
    assert.equal(page.q('[data-stat="int"] .v').textContent, '15');
    assert.equal(page.q('[data-plus="int"]').hasAttribute('disabled'), true, 'nor above 15');
    page.press('[data-wiz="reset"]');
    assert.equal(page.q('[data-stat="int"] .v').textContent, '8');
    assert.equal(page.q('.wz-left-pill').textContent, 'Points left: 0');
});

test('the draft: points left, the problems that hold Create back, and the payload', () => {
    const draft = newDraft();
    assert.equal(pointsLeft(draft), 0);
    assert.deepEqual(problemsOf(draft), ['Give the character a name.']);
    draft.name = ' Astra ';
    draft.stats.str = 5;
    assert.match(problemsOf(draft)[0], /Place all 60 points \(4 left\)/);
    draft.stats.str = 14;
    assert.match(problemsOf(draft)[0], /Take back 5 points/);
    draft.stats.str = 9;
    draft.skills = [{ ...draft.skill(), name: ' ' }];
    assert.deepEqual(problemsOf(draft), ['Every skill needs a name.']);
    draft.skills = [{ ...draft.skill(), name: ' Obscure ', about: ' melts ', stat: 'agi', type: 'movement', pool: 'sp', n: 2 }, { ...draft.skill(), name: 'Lore', stat: 'int', type: 'utility' }];
    assert.deepEqual(problemsOf(draft), []);
    assert.deepEqual(payloadOf(draft), { name: 'Astra', stats: { str: 9, vit: 9, agi: 9, dex: 9, int: 8, wis: 8, cha: 8 },
        skills: [{ name: 'Obscure', about: 'melts', stat: 'agi', type: 'movement', cost: { pool: 'sp', n: 2 } }, { name: 'Lore', about: '', stat: 'int', type: 'utility' }] });
});

test('Review holds Create back with the problem until there is a name; skills are up to five', () => {
    const page = wizardPage();
    next(page); next(page);
    for (let n = 0; n < 6; n += 1) page.press('[data-wiz="add"]');
    assert.equal(page.all('.wz-skill').length, 5);
    assert.equal(page.q('[data-wiz="add"]').hasAttribute('disabled'), true);
    assert.equal(page.q('.wz-add .ps-p').textContent, 'All slots are used.');
    next(page);
    assert.equal(page.q('[data-wiz="create"]').hasAttribute('disabled'), true);
    assert.deepEqual(page.all('.wz-problems li').map(li => li.textContent), ['Fix this first:', 'Give the character a name.', 'Every skill needs a name.']);
    assert.equal(page.q('.wz-hint').textContent, 'Fix the problem above, then Create.');
});

test('Create sends textRpg.create with the typed name, the stats and the skills (type and cost too), and a made character closes the sheet', async () => {
    const calls = [];
    const page = wizardPage(async (type, payload) => (calls.push([type, payload]), { ok: true }));
    page.type('[data-wiz="name"]', ' Astra ');
    next(page);
    lower(page, 'str'); raise(page, 'agi');
    next(page);
    page.press('[data-wiz="add"]');
    page.type('[data-skill="0"] [data-field="name"]', 'Obscure');
    page.type('[data-skill="0"] [data-field="about"]', 'melts into shadow');
    page.type('[data-skill="0"] [data-field="stat"]', 'agi');
    page.type('[data-skill="0"] [data-field="type"]', 'movement');
    page.type('[data-skill="0"] [data-field="cost"]', 'sp');
    page.type('[data-skill="0"] [data-field="cost-n"]', '2');
    next(page);
    assert.equal(page.q('.wz-list li').textContent, 'Obscure · AGI · Movement · costs 2 Stamina');
    page.press('[data-wiz="create"]');
    await flush();
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'textRpg.create');
    assert.deepEqual(calls[0][1], { name: 'Astra', stats: { str: 8, vit: 9, agi: 10, dex: 9, int: 8, wis: 8, cha: 8 },
        skills: [{ name: 'Obscure', about: 'melts into shadow', stat: 'agi', type: 'movement', cost: { pool: 'sp', n: 2 } }] });
    assert.equal(page.closed(), 1);
});

test('a refusal is shown as the command said it, Create works again and the sheet stays open', async () => {
    const page = wizardPage(async () => ({ ok: false, message: 'There is a character already.' }));
    page.type('[data-wiz="name"]', 'A');
    next(page); next(page); next(page);
    page.press('[data-wiz="create"]');
    await flush();
    assert.equal(page.q('.wz-status').textContent, 'There is a character already.');
    assert.equal(page.q('[data-wiz="create"]').hasAttribute('disabled'), false);
    assert.equal(page.closed(), 0);
});

test('typing a name keeps the field and updates the summary; the tab strip marks the steps behind as done', () => {
    const page = wizardPage();
    page.type('[data-wiz="name"]', 'Astra');
    assert.equal(page.q('.wz-who b').textContent, 'Astra');
    assert.equal(page.q('.wz-ava').textContent, 'A');
    next(page); next(page);
    assert.deepEqual(page.all('.wz-steps button').map(tab => tab.classList.contains('done')), [true, true, false, false]);
    assert.equal(page.q('.wz-pill').textContent, '0 of 5 skills');
});

test('the widget and its screen are registered, the screen names the widget, and the wizard makes the character through the host', async t => {
    t.mock.method(console, 'warn', () => {});
    const def = textRpgModule(null);
    assert.deepEqual(def.screens.map(screen => screen.id), ['text-rpg/new-character']);
    assert.match(def.screens[0].template, /ss-widget name="text-rpg\.new-character"/);
    const host = await newHost();
    try {
        const page = wizardPage();
        const live = textRpgModule({ command: (...args) => host.sdk.command(...args) });
        const el = page.body;
        live.widgets['text-rpg.new-character'].render(el, {}, {});
        page.type('[data-wiz="name"]', 'Astra');
        next(page); next(page); next(page);
        page.press('[data-wiz="create"]');
        await flush();
        assert.equal(astraOf(host).name, 'Astra');
        assert.equal(host.sdk.query('textRpg.view').pcId, astraOf(host).id);
    } finally {
        host.close();
    }
});
