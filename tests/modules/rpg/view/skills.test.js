// The Skills view (src/v2/lean-rpg/view/skills.js, mockup 31-skills): rank tones, the mastery bar, the roll line from the live
// sheet, empty slots, the pencil that edits the name and the description only (one multi-field dm.set), and the same on the real page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setupDom } from '../../../ui/view/mounts/helpers.js';
import { CHOOSER_TEMPLATES as STANDARD_TEMPLATES } from '../../../../modules/rpg/templates.js';
import { readParty } from '../../../../modules/rpg/view/party-data.js';
import { createPartyWidget } from '../../../../modules/rpg/view/party.js';
import { RANK_TONES, masteryOf, renderSkills, rollOf } from '../../../../modules/rpg/view/skills.js';
import { reply, rebuilt } from '../../data-modules/helpers.js';
import { fakeState } from './helpers.js';
import { begin, fieldsOf, makeBlocks, page, party, settle } from './page.js';

const template = role => structuredClone(STANDARD_TEMPLATES.find(entry => entry.definition.role === role).definition);
const character = (fields = {}) => ({ definition: template('character'), fields: { who: 'Wessel', str: 14, vit: 12, agi: 11, dex: 10, int: 8, luk: 9, cha: 10, level: 2, ...fields } });
const SKILLS = {
    who: 'Wessel',
    skill1: 'Iron Breath', about1: 'The drill-yard breathing that keeps you on your feet when you are spent.', stat1: 'vit', uses1: 'stamina', rank1: 2, practice1: 40,
    skill2: 'Short blade', about2: 'Quick cuts and guards with a long knife or short sword.', stat2: 'agi', uses2: 'stamina', rank2: 0, practice2: 65,
    skill3: 'Rope work', about3: 'Knots, climbing, hauling, and throwing a line true.', stat3: 'dex', uses3: 'stamina', rank3: 1, practice3: 10,
    skill4: 'River swimming', about4: 'Cold water, currents, and getting a crewmate out alive.', stat4: 'vit', uses4: 'stamina', rank4: 3, practice4: 100,
};
const state = (skills = SKILLS) => fakeState([character(), { definition: template('skills'), fields: skills }]);
const wessel = (skills) => readParty(state(skills), { own: 'Wessel' })[0];

function draw(extra = {}, skills) {
    const doc = setupDom(), el = doc.createElement('div');
    doc.body.appendChild(el);
    const calls = [], back = [];
    const api = { command: async (type, payload) => { calls.push([type, payload]); return extra.result ?? { ok: true }; } };
    const view = renderSkills(el, { character: wessel(skills), api: extra.noCommand ? {} : api, onBack: () => back.push(1), session: extra.session, ...(extra.rolled ? { rolled: () => true } : {}) });
    return { doc, el, view, calls, back };
}
const rows = el => el.querySelectorAll('.rpg-skill');
const tick = () => new Promise(resolve => setImmediate(resolve));

test('mastery: four cells, rank + 1 lit and the next filling with practice; Master is full; the tone follows the rank', () => {
    const at = (rank, practice) => masteryOf({ rank, practice, rankName: ['Novice', 'Adept', 'Expert', 'Master'][rank] });
    assert.deepEqual(at(0, 0), { value: 1, max: 4, tone: 'neutral', text: 'Novice · 0 / 100 to Adept' });
    assert.deepEqual(at(0, 65), { value: 1.65, max: 4, tone: 'neutral', text: 'Novice · 65 / 100 to Adept' });
    assert.deepEqual(at(1, 10), { value: 2.1, max: 4, tone: 'info', text: 'Adept · 10 / 100 to Expert' });
    assert.deepEqual(at(2, 40), { value: 3.4, max: 4, tone: 'accent', text: 'Expert · 40 / 100 to Master' });
    assert.deepEqual(at(3, 100), { value: 4, max: 4, tone: 'good', text: 'Master' });
    assert.deepEqual(at(3, 0), { value: 4, max: 4, tone: 'good', text: 'Master' }, 'Master is always full');
    assert.deepEqual([...RANK_TONES], ['neutral', 'info', 'accent', 'good']);
});

test('the roll: d20 + half the stat + rank + level ÷ 5 (rounded down), worked out from the live sheet', () => {
    const [iron, blade, rope, swim] = wessel().skills;
    // Wessel is Level 2 (stored as a Soul Class, read as the level): level ÷ 5 is 0.
    assert.deepEqual(rollOf(iron, wessel()), { total: 8, stat: 'VIT', value: 12, half: 6, rank: 2, bonus: 0 });
    assert.equal(rollOf(blade, wessel()).total, 5, 'AGI 11 → +5, Novice +0, level ÷ 5 = 0');
    assert.equal(rollOf(rope, wessel()).total, 6);
    // Level 14 (the Level field): 14 ÷ 5 = 2.
    const high = readParty(fakeState([character({ level: 14 }), { definition: template('skills'), fields: SKILLS }]), { own: 'Wessel' })[0];
    assert.deepEqual(rollOf(high.skills[0], high), { total: 6 + 2 + 2, stat: 'VIT', value: 12, half: 6, rank: 2, bonus: 2 });
    assert.equal(rollOf(swim, wessel()).total, 9);
    const none = rollOf({ ...iron, stat: null }, wessel());
    assert.deepEqual([none.stat, none.total], [null, 2], 'a skill with no stat of its own: rank and level only');
});

test('the legend uses the same tones as the rank pills', () => {
    const { el } = draw();
    const pills = el.querySelectorAll('.rpg-skill-legend .ss-pill');
    assert.deepEqual(pills.map(node => node.textContent), ['Novice +0', 'Adept +1', 'Expert +2', 'Master +3']);
    assert.deepEqual(pills.map(node => ['info', 'accent', 'good'].find(tone => node.classList.contains(`rpg-tone-${tone}`)) ?? 'neutral'), ['neutral', 'info', 'accent', 'good']);
    assert.match(el.querySelector('.rpg-skill-legend').textContent, /^Mastery:.*to rolls with that skill$/);
});

test('the footer note follows the rule: with Rolls automatic practice comes from rolled uses, with Rolls off the story adds it', () => {
    const rolled = draw({ rolled: true }).el.querySelector('.rpg-skill-note').textContent;
    assert.match(rolled, /^Practice comes from rolled skill uses: fights and checks\./);
    assert.doesNotMatch(rolled, /The story adds practice/);
    assert.match(draw().el.querySelector('.rpg-skill-note').textContent, /^The story adds practice when a skill is used;/);
});

test('Back to the party calls back; the note says rank and practice only move through play', () => {
    const { el, back } = draw();
    el.querySelector('.rpg-skills-back').click();
    assert.equal(back.length, 1);
    assert.match(el.querySelector('.rpg-skill-note').textContent, /Rank and practice only move through play/);
});

test('the pencil edits the name and the description and nothing else: two fields, one multi-field dm.set', async () => {
    const { el, calls } = draw();
    const pencil = rows(el)[0].querySelector('.rpg-skill-pencil');
    assert.match(pencil.getAttribute('aria-label'), /Edit Iron Breath's name or description/);
    pencil.click();
    const form = rows(el)[0].querySelector('.rpg-skill-form');
    assert.ok(form);
    assert.deepEqual(form.querySelectorAll('[data-skill-field]').map(node => node.getAttribute('data-skill-field')), ['name', 'about'], 'no stat, uses, rank or practice to type');
    assert.equal(form.querySelectorAll('select').length, 0);
    assert.equal(form.querySelector('[data-skill-field="name"]').value, 'Iron Breath');
    assert.equal(form.querySelector('[data-skill-field="name"]').getAttribute('maxlength'), '40');
    assert.equal(form.querySelector('[data-skill-field="about"]').getAttribute('maxlength'), '120');
    form.querySelector('[data-skill-field="name"]').value = '  Iron   Breath II ';
    form.querySelector('[data-skill-field="name"]').dispatch('input');
    form.querySelector('[data-skill-field="about"]').value = 'Breathing drills.';
    form.querySelector('[data-skill-field="about"]').dispatch('input');
    form.querySelector('.rpg-skill-save').click();
    await tick();
    assert.deepEqual(calls, [['dm.set', { module: 'pack.chat/skills', fields: { skill1: 'Iron Breath II', about1: 'Breathing drills.' } }]]);
});

test('an empty name is refused in plain words, an unchanged skill sends nothing, Cancel closes the editor, a failed save says why and keeps it', async () => {
    const one = draw();
    rows(one.el)[1].querySelector('.rpg-skill-pencil').click();
    const form = () => rows(one.el)[1].querySelector('.rpg-skill-form');
    form().querySelector('[data-skill-field="name"]').value = '   ';
    form().querySelector('[data-skill-field="name"]').dispatch('input');
    form().querySelector('.rpg-skill-save').click();
    await tick();
    assert.deepEqual(one.calls, []);
    assert.equal(one.el.querySelector('.rpg-skill-status').textContent, 'A skill needs a name.');
    assert.ok(form(), 'the editor stays open');
    one.el.querySelector('.rpg-skill-cancel').click();
    assert.ok(!form());
    assert.equal(one.calls.length, 0);

    const same = draw();
    rows(same.el)[0].querySelector('.rpg-skill-pencil').click();
    rows(same.el)[0].querySelector('.rpg-skill-save').click();
    await tick();
    assert.deepEqual(same.calls, [], 'nothing changed: nothing sent');
    assert.ok(!rows(same.el)[0].querySelector('.rpg-skill-form'), 'and the editor closes');

    const refused = draw({ result: { ok: false, code: 'REFUSED', message: 'Skills: that is locked; nothing applied.' } });
    rows(refused.el)[0].querySelector('.rpg-skill-pencil').click();
    const input = rows(refused.el)[0].querySelector('[data-skill-field="name"]');
    input.value = 'Other';
    input.dispatch('input');
    rows(refused.el)[0].querySelector('.rpg-skill-save').click();
    await tick();
    assert.equal(refused.el.querySelector('.rpg-skill-status').textContent, 'Skills: that is locked; nothing applied.');
    assert.ok(rows(refused.el)[0].querySelector('.rpg-skill-form'), 'a refused save keeps the editor and its text');
    assert.equal(rows(refused.el)[0].querySelector('[data-skill-field="name"]').value, 'Other');
});

test('Escape in the skill editor closes it and stops there: the Game view behind it stays open', () => {
    const one = draw();
    rows(one.el)[1].querySelector('.rpg-skill-pencil').click();
    const form = () => rows(one.el)[1].querySelector('.rpg-skill-form');
    const event = form().dispatch('keydown', { key: 'Escape' });
    assert.ok(!form(), 'the editor closed');
    assert.ok(event.defaultPrevented && event.stopped, 'the key does not travel on to the Game view\'s own Escape');
});

test('without a command there is no pencil; the Skills view then only reads', () => {
    const { el } = draw({ noCommand: true });
    assert.equal(el.querySelectorAll('.rpg-skill-pencil').length, 0);
    assert.equal(rows(el).length, 4);
});

test('names and descriptions from the story are text, never markup', () => {
    const mark = '<img src=x onerror="globalThis.pwned=1"><b>bold</b>';
    const { el } = draw({}, { who: 'Wessel', skill1: mark, about1: mark, stat1: 'str', uses1: 'mana' });
    assert.ok(el.textContent.includes(mark));
    assert.equal(el.querySelectorAll('img, script, iframe, style, a').length, 0);
    assert.equal(globalThis.pwned, undefined);
});

test('the stylesheet: the rank tones, a two-column list on a wide container, theme tokens only', () => {
    const css = readFileSync(new URL('../../../../modules/rpg/view/lean-rpg.css', import.meta.url), 'utf8');
    for (const tone of ['info', 'accent', 'good']) assert.match(css, new RegExp(`\\.rpg-tone-${tone} \\{[^}]*var\\(--ss-${tone}\\)`));
    assert.match(css, /\.rpg-skill-empty \{[^}]*dashed/);
    assert.match(css, /@container \(min-width: 760px\) \{\s*\.rpg-skill-list \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
    assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
    assert.doesNotMatch(css, /\brgba?\(/);
});

test('feature off: no Party tab, no Skills view, nothing loaded', async t => {
    const { doc, host, ui, loads } = await page(t, { feature: false });
    await begin(host);
    await makeBlocks(host);
    assert.equal(loads.length, 0);
    assert.equal(ui.screens.resolve('story-block/party'), null);
    assert.equal(ui.screens.resolve('story-block/new-character'), null);
    ui.mounts.screen.open();
    assert.equal(doc.querySelectorAll('.rpg-skills-view').length, 0);
});
