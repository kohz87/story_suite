import test from 'node:test';
import assert from 'node:assert/strict';
import { textRpgModule } from '../src/module.js';
import { newDraft, payloadOf, problemsOf } from '../src/wizard/draft.js';
import { pointsLeft } from '../src/wizard/points.js';
import { flush } from './helpers/fake-dom.js';
import { newHost, astraOf } from './helpers/host.js';
import { wizardPage } from './helpers/wizard-page.js';

const STEPS = ['Who', 'Stats', 'Skills', 'Review'];
const stepOf = page => page.q('.wz-body').dataset.step;
const next = page => page.press('[data-wiz="next"]');
const raise = (page, stat) => page.press(`[data-plus="${stat}"]`);
const lower = (page, stat) => page.press(`[data-minus="${stat}"]`);
const spend = (page, stat, n) => { for (let at = 0; at < n; at += 1) raise(page, stat); };
// Every stat starts at 5 and 10 points are placed on the Stats step: Create is held until they are.
const placeAll = page => { page.press('.wz-steps [data-value="stats"]'); spend(page, 'str', 5); spend(page, 'vit', 5); };

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
    assert.equal(page.q('.wz-left-pill').textContent, 'Points left: 10');
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

test('points: every stat starts at 5 and 10 are to place; + needs a free point, − gives one back, a stat stays within 5..10, Reset starts again', () => {
    const page = wizardPage();
    next(page);
    assert.deepEqual(page.all('.ps-st .v').map(node => node.textContent), ['5', '5', '5', '5', '5', '5', '5']);
    assert.equal(page.q('.wz-left-pill').textContent, 'Points left: 10');
    assert.match(page.q('[data-wiz="stats-note"]').textContent, /Every stat starts at 5, the minimum\. Spend 10 points; a stat can go up to 10 now\. Each level you gain later gives 1 more point\./);
    assert.equal(page.q('[data-minus="str"]').hasAttribute('disabled'), true, 'a stat does not go below 5');
    spend(page, 'str', 7);
    assert.equal(page.q('[data-stat="str"] .v').textContent, '10');
    assert.equal(page.q('[data-plus="str"]').hasAttribute('disabled'), true, 'nor above 10');
    assert.equal(page.q('.wz-left-pill').textContent, 'Points left: 5');
    spend(page, 'vit', 9);
    assert.equal(page.q('[data-stat="vit"] .v').textContent, '10');
    assert.equal(page.q('.wz-left-pill').textContent, 'Points left: 0');
    assert.equal(page.q('[data-plus="agi"]').hasAttribute('disabled'), true, 'no point left to place');
    lower(page, 'vit');
    assert.equal(page.q('.wz-left-pill').textContent, 'Points left: 1');
    page.press('[data-wiz="reset"]');
    assert.deepEqual(page.all('.ps-st .v').map(node => node.textContent), ['5', '5', '5', '5', '5', '5', '5']);
    assert.equal(page.q('.wz-left-pill').textContent, 'Points left: 10');
});

test('the draft: points left, the problems that hold Create back, and the payload', () => {
    const draft = newDraft();
    assert.equal(pointsLeft(draft), 10);
    assert.deepEqual(problemsOf(draft), ['Give the character a name.', 'Place all 10 points (10 left).']);
    draft.name = ' Astra ';
    draft.stats.str = 7;
    assert.match(problemsOf(draft)[0], /Place all 10 points \(8 left\)/);
    draft.stats.str = 20;
    assert.match(problemsOf(draft)[0], /Take back 5 points/);
    Object.assign(draft.stats, { str: 10, vit: 10 });
    draft.skills = [{ ...draft.skill(), name: ' ' }];
    assert.deepEqual(problemsOf(draft), ['Every skill needs a name.']);
    draft.skills = [{ ...draft.skill(), name: ' Obscure ', about: ' melts ', stat: 'agi', type: 'movement', pool: 'sp', n: 2 }, { ...draft.skill(), name: 'Lore', stat: 'int', type: 'utility' }];
    assert.deepEqual(problemsOf(draft), []);
    assert.deepEqual(payloadOf(draft), { name: 'Astra', stats: { str: 10, vit: 10, agi: 5, dex: 5, int: 5, wis: 5, cha: 5 },
        skills: [{ name: 'Obscure', about: 'melts', stat: 'agi', type: 'movement', cost: { pool: 'sp', n: 2 } }, { name: 'Lore', about: '', stat: 'int', type: 'utility' }] });
});

test('Review holds Create back with the problem until there is a name and the points are placed; skills are up to five', () => {
    const page = wizardPage();
    next(page); next(page);
    for (let n = 0; n < 6; n += 1) page.press('[data-wiz="add"]');
    assert.equal(page.all('.wz-skill').length, 5);
    assert.equal(page.q('[data-wiz="add"]').hasAttribute('disabled'), true);
    assert.equal(page.q('.wz-add .ps-p').textContent, 'All slots are used.');
    next(page);
    assert.equal(page.q('[data-wiz="create"]').hasAttribute('disabled'), true);
    assert.deepEqual(page.all('.wz-problems li').map(li => li.textContent), ['Fix this first:', 'Give the character a name.', 'Place all 10 points (10 left).', 'Every skill needs a name.']);
    assert.equal(page.q('.wz-hint').textContent, 'Fix the problem above, then Create.');
});

test('Create sends textRpg.create with the typed name, the stats and the skills (type and cost too), and a made character closes the sheet', async () => {
    const calls = [];
    const page = wizardPage(async (type, payload) => (calls.push([type, payload]), { ok: true }));
    page.type('[data-wiz="name"]', ' Astra ');
    next(page);
    spend(page, 'str', 3); spend(page, 'agi', 5); spend(page, 'vit', 2);
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
    assert.deepEqual(calls[0][1], { name: 'Astra', stats: { str: 8, vit: 7, agi: 10, dex: 5, int: 5, wis: 5, cha: 5 },
        skills: [{ name: 'Obscure', about: 'melts into shadow', stat: 'agi', type: 'movement', cost: { pool: 'sp', n: 2 } }] });
    assert.equal(page.closed(), 1);
});

test('a refusal is shown as the command said it, Create works again and the sheet stays open', async () => {
    const page = wizardPage(async () => ({ ok: false, message: 'There is a character already.' }));
    page.type('[data-wiz="name"]', 'A');
    placeAll(page);
    next(page); next(page);
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
        placeAll(page);
        next(page); next(page);
        page.press('[data-wiz="create"]');
        await flush();
        assert.equal(astraOf(host).name, 'Astra');
        assert.equal(host.sdk.query('textRpg.view').pcId, astraOf(host).id);
    } finally {
        host.close();
    }
});

test('the summary draws the reader\'s portrait from persona.portrait once there is a name, and keeps the letter when the query answers null or an unsafe URL', () => {
    const asked = [];
    const withPortrait = value => wizardPage(async () => ({ ok: true }), { query: name => { asked.push(name); return name === 'persona.portrait' ? value : ''; } });
    const page = withPortrait('/User%20Avatars/astra.png');
    const persona = () => asked.filter(name => name.startsWith('persona.'));
    assert.deepEqual(persona(), ['persona.portrait', 'persona.name'], 'asked once each, when the wizard opens');
    assert.equal(page.q('.wz-ava').classList.contains('wz-pic'), false, 'no name yet: the "?" tile');
    page.type('[data-wiz="name"]', 'Astra');
    assert.ok(page.q('.wz-ava').classList.contains('wz-pic'));
    assert.equal(page.q('.wz-ava').style.getPropertyValue('--wz-pic'), 'url("/User%20Avatars/astra.png")');
    next(page);
    assert.ok(page.q('.wz-ava').classList.contains('wz-pic'), 'the Stats step shows it too');
    assert.equal(persona().length, 2);
    for (const none of [null, 'javascript:alert(1)"x']) {
        const plain = withPortrait(none);
        plain.type('[data-wiz="name"]', 'Astra');
        assert.equal(plain.q('.wz-ava').classList.contains('wz-pic'), false);
        assert.equal(plain.q('.wz-ava').textContent, 'A');
    }
});
