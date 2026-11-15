// The New character wizard (src/v2/lean-rpg/view/wizard.js and wizard-data.js, mockup 41-wizard): the data: draft, budget, skills, sets, problems, definitions, room, screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DM_OLD_ROOM } from '../../../../src/v2/data-modules/schema.js';
import { validateDataModules } from '../../../../src/v2/data-modules/check.js';
import { STATS } from '../../../../src/v2/lean-rpg/index.js';
import { STANDARD_TEMPLATES, SKILL_SETS } from '../../../../src/v2/lean-rpg/templates.js';
import { createWizardScreen, WIZARD_SCREEN_ID, WIZARD_WIDGET } from '../../../../src/v2/lean-rpg/view/wizard.js';
import { adeptCount, blockNames, buildDefinitions, hasRoom, mayStartAdept, newDraft, pointsLeft, problemsOf, readDraft, setLine, skillSetsOf, statsLine, withSet, withSkill,
    withSkillPatch, withoutSkill } from '../../../../src/v2/lean-rpg/view/wizard-data.js';
import { CHECK, FIGHTER } from './wizard.helpers.js';

// ---- the data: draft, budget, skills, sets, problems, definitions --------------------------------------------------------------

test('a new draft: the persona\'s name, You unless there is one already, every stat at 5 and 10 points to spend', () => {
    const { creation } = newDraft({ persona: 'Wessel' });
    assert.deepEqual([creation.start, creation.budget, creation.min, creation.max, creation.standard], [5, 10, 3, 10, true], 'the Standard numbers');
    assert.deepEqual(newDraft({ persona: 'Wessel' }), { name: 'Wessel', kind: 'you', about: '', stats: Object.fromEntries(STATS.map(stat => [stat, 5])), skills: [], set: '', creation });
    assert.equal(newDraft({ persona: 'Wessel', hasYou: true }).kind, 'companion');
    assert.equal(newDraft().name, '');
    assert.equal(pointsLeft(newDraft()), 10);
});

test('the budget: a stat above 5 costs a point a step, below it gives one back, 3 to 10, and a draft is made whole when read', () => {
    const draft = newDraft({ persona: 'Wessel' });
    assert.equal(pointsLeft({ ...draft, stats: { ...draft.stats, str: 9, vit: 7 } }), 4, '+4 and +2');
    assert.equal(pointsLeft({ ...draft, stats: { ...draft.stats, str: 10, vit: 3, agi: 3 } }), 10 - 5 + 2 + 2, 'two stats at 3 free four points');
    const odd = readDraft({ name: `  ${'x'.repeat(60)}  `, kind: 'boss', about: 'y'.repeat(300), stats: { str: 99, vit: 1, agi: 12.5, dex: 'ten' }, skills: 'many', set: 7 });
    assert.deepEqual([odd.name.length, odd.kind, odd.about.length, odd.set], [40, 'you', 240, '']);
    assert.deepEqual([odd.stats.str, odd.stats.vit, odd.stats.agi, odd.stats.dex, odd.stats.luk], [10, 3, 5, 5, 5], 'clamped to 3 to 10, a bad value is the start');
    assert.deepEqual(odd.skills, []);
    assert.deepEqual(readDraft(null).stats, newDraft().stats);
    assert.equal(statsLine(newDraft()), 'STR 5 · VIT 5 · AGI 5 · DEX 5 · INT 5 · LUK 5 · CHA 5');
});

test('at most five skills and at most one at Adept, however the draft got there', () => {
    let draft = newDraft({ persona: 'Wessel' });
    for (let n = 0; n < 12; n += 1) draft = withSkill(draft);
    assert.equal(draft.skills.length, 8, 'add stops at five combat skills and three utility ones');
    assert.equal(draft.skills.filter(skill => skill.type === 'utility').length, 3);
    draft = withSkillPatch(draft, 0, { start: 1 });
    assert.deepEqual([adeptCount(draft), draft.skills[0].start, mayStartAdept(draft, 0), mayStartAdept(draft, 1)], [1, 1, true, false]);
    draft = withSkillPatch(draft, 1, { start: 1 });
    assert.deepEqual(draft.skills.map(skill => skill.start), [1, 0, 0, 0, 0, 0, 0, 0], 'a second Adept is refused');
    draft = withSkillPatch(draft, 0, { start: 0 });
    draft = withSkillPatch(draft, 1, { start: 1 });
    assert.deepEqual(draft.skills.map(skill => skill.start), [0, 1, 0, 0, 0, 0, 0, 0], 'it moves once the first lets go');
    assert.equal(adeptCount(withoutSkill(draft, 1)), 0);
    const forced = readDraft({ skills: Array.from({ length: 7 }, (_, n) => ({ name: `S${n}`, about: 'a', stat: 'str', uses: 'mana', start: 1 })) });
    assert.deepEqual([forced.skills.length, adeptCount(forced), forced.skills[0].uses], [5, 1, 'mana'], 'a hand-made draft is made whole');
    assert.deepEqual(withSkillPatch(draft, 9, { name: 'x' }), draft, 'no such skill: nothing changes');
});

test('a skill set puts its skills in at Novice, up to five, and remembers which it was', () => {
    const draft = withSet(newDraft({ persona: 'Wessel' }), FIGHTER);
    assert.deepEqual(draft.skills.map(skill => [skill.name, skill.stat, skill.uses, skill.start]), [['Short blade', 'agi', 'stamina', 0], ['Iron Breath', 'vit', 'stamina', 0], ['Shield work', 'str', 'stamina', 0]]);
    assert.equal(draft.set, 'guild-fighter');
    const big = withSet(draft, { id: 'big', skills: Array.from({ length: 9 }, (_, n) => ({ name: `S${n}`, about: 'a', stat: 'int', uses: 'mana' })) });
    assert.equal(big.skills.length, 5);
    assert.equal(setLine(SKILL_SETS[2]), 'Spark (INT, mana) · Ward (INT, mana) · Lore (INT)');
});

test('the sets on offer: the five built in, then each pack\'s, with where they are from', () => {
    const alone = skillSetsOf();
    assert.deepEqual(alone.map(set => [set.name, set.source]), SKILL_SETS.map(set => [set.name, 'Built in']));
    const sets = skillSetsOf({ packSets: [{ id: 'pack.ersveil/seal', pack: 'ersveil', slug: 'seal', name: 'Sealwarden recruit', about: 'Ersveil.', skills: [{ name: 'Spear', about: 'a', stat: 'str', uses: 'stamina' }] }, { nonsense: true }], packNames: { ersveil: 'Ersveil' } });
    assert.equal(sets.length, 6);
    assert.deepEqual([sets[5].id, sets[5].name, sets[5].source, sets[5].builtIn], ['pack.ersveil/seal', 'Sealwarden recruit', 'From the Ersveil pack', false]);
    assert.equal(skillSetsOf({ packSets: [{ id: 'x', pack: 'p', name: 'N', skills: [] }] }).at(-1).source, 'From the p pack', 'no name known: the pack id');
});

test('what holds Create up, in plain words', () => {
    const ok = { ...newDraft({ persona: 'Wessel' }), skills: [{ name: 'Spark', about: 'A burst.', stat: 'int', uses: 'mana', start: 0 }] };
    const world = { persona: 'Wessel', names: ['Ren'], room: true, hasYou: false };
    assert.deepEqual(problemsOf(ok, world), []);
    assert.deepEqual(problemsOf({ ...ok, name: '' }, world), ['Give the character a name.']);
    assert.deepEqual(problemsOf({ ...ok, name: 'REN', kind: 'companion' }, world), ['A character called REN is already in this story.'], 'the same name, folded');
    assert.deepEqual(problemsOf({ ...ok, skills: [{ ...ok.skills[0], name: '' }] }, world), ['Every skill needs a name.']);
    assert.deepEqual(problemsOf({ ...ok, skills: [ok.skills[0], { ...ok.skills[0], name: 'spark' }] }, world), ['Two skills are called spark.']);
    assert.deepEqual(problemsOf({ ...ok, skills: [{ ...ok.skills[0], about: '' }] }, world), ['Spark needs a line about what it does.']);
    assert.deepEqual(problemsOf(ok, { ...world, room: false }), ['This story has no room for two more blocks (at most 20). Remove one in Settings → Blocks first.']);
    assert.deepEqual(problemsOf(ok, { ...world, hasYou: true }), ['You already have a character in this story.']);
    assert.match(problemsOf({ ...ok, name: 'Wess' }, world)[0], /You are shown as the character named like your persona \(Wessel\)/);
    assert.match(problemsOf({ ...ok, kind: 'companion' }, world)[0], /A companion cannot have your persona's name \(Wessel\)/);
    assert.deepEqual(problemsOf({ ...ok, name: 'Wess' }, { ...world, persona: '' }), [], 'no persona name known: nothing to hold the name to');
});

test('Create\'s two definitions come from the templates with the wizard\'s values as the field defaults, and the checker takes both', () => {
    const base = withSet(newDraft({ persona: 'Wessel' }), FIGHTER);
    const draft = { ...base, about: 'A drill-yard washout.', stats: { ...base.stats, str: 9, vit: 7, agi: 6, int: 3 }, skills: base.skills.map((skill, at) => (at === 0 ? { ...skill, start: 1 } : skill)) };
    assert.equal(pointsLeft(draft), 10 - 4 - 2 - 1 + 2, 'STR +4, VIT +2, AGI +1, INT -2');
    const { character, skills } = buildDefinitions(draft, { used: [] });
    assert.deepEqual([character.slug, character.name, character.role, skills.slug, skills.name, skills.role], ['wessel', 'Wessel', 'character', 'wessel-skills', 'Wessel\'s skills', 'skills']);
    assert.deepEqual(blockNames('Wessel'), { character: 'Wessel', skills: 'Wessel\'s skills' });
    const state = character.state;
    assert.deepEqual([state.who.default, state.about.default, state.str.default, state.vit.default, state.agi.default, state.dex.default, state.int.default], ['Wessel', 'A drill-yard washout.', 9, 7, 6, 5, 3]);
    assert.deepEqual([state.points.default, state.level.default, state.xp.default, state.health.default, state.mana.default, state.stamina.default, state.alive.default], [5, 1, 0, 10, 8, 10, true], 'full bars (they grow with VIT, AGI and INT), Level 1, 0 XP and the unspent points');
    assert.deepEqual([state.cap.default, state.soul], [99, undefined], 'the cap is 99 unless the story says another; no Soul Class');
    const sk = skills.state;
    assert.deepEqual([sk.who.default, sk.skill1.default, sk.about1.default, sk.stat1.default, sk.uses1.default, sk.rank1.default, sk.practice1.default], ['Wessel', 'Short blade', FIGHTER.skills[0].about, 'agi', 'stamina', 1, 0], 'the Adept one starts at rank 1');
    assert.deepEqual([sk.rank2.default, sk.rank3.default, sk.skill4.default, sk.rank4.default], [0, 0, '', 0]);
    assert.equal(sk.rank1.edit, false, 'rank stays a field only play can move');
    assert.equal(sk.practice1.edit, false);
    for (const definition of [character, skills]) {
        const checked = validateDataModules([definition], CHECK);
        assert.equal(checked.ok, true, `${definition.slug}: ${JSON.stringify(checked.errors)}`);
    }
    // The templates themselves are untouched, and a second character gets slugs of its own.
    assert.equal(STANDARD_TEMPLATES[0].definition.state.who.default, '');
    const second = buildDefinitions({ ...draft, name: 'Wessel' }, { used: ['pack.chat/wessel', 'pack.chat/wessel-skills'] });
    assert.deepEqual([second.character.slug, second.skills.slug], ['wessel-2', 'wessel-skills-2']);
    assert.deepEqual([second.character.name, second.skills.name], ['Wessel', 'Wessel\'s skills']);
});

test('room for two more blocks: a story holds at most twenty of its own', () => {
    const state = count => ({ domains: { dataModules: { active: Object.fromEntries(Array.from({ length: count }, (_, n) => [`pack.chat/b${n}`, { hash: `h${n}` }])), pins: Object.fromEntries(Array.from({ length: count }, (_, n) => [`h${n}`, { packId: 'chat' }])) } } });
    assert.equal(hasRoom(state(18)), true);
    assert.equal(hasRoom(state(19)), false);
    assert.equal(hasRoom(state(7), DM_OLD_ROOM), false, 'a reply from before the room mark: eight');
    assert.equal(hasRoom(state(6), DM_OLD_ROOM), true);
    assert.equal(hasRoom(null), true, 'no story yet');
});

test('the screen: a wide dialog with four steps, Who, Stats, Skills, Review, each the wizard widget', () => {
    const screen = createWizardScreen();
    assert.equal(screen.id, WIZARD_SCREEN_ID);
    assert.deepEqual([screen.mounts, screen.width, screen.title], [['dialog'], 'wide', 'New character']);
    assert.deepEqual(screen.steps.map(step => [step.id, step.title]), [['who', 'Who'], ['stats', 'Stats'], ['skills', 'Skills'], ['review', 'Review']]);
    for (const step of screen.steps) assert.match(step.template, new RegExp(`name="${WIZARD_WIDGET}" data-props='\\{"step":"${step.id}"\\}'`));
    assert.equal(WIZARD_WIDGET, 'rpg.wizard');
});
