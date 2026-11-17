// The Skills template: the base block, the Standard one with the learn guard, the frozen earlier forms, and the additive upgrade.
import { CREATION, STATS_EARLIER as STATS, USES } from '../names.js';
import { SIGNATURE_FIELD, SKILL_SLOTS_MAX } from '../../../core/runtime/skill-slots.js';
import { typedSkills } from '../templates-skills.js';
import { names } from './shared-names.js';
import { get, int, range, text } from './shared-fields.js';

const RANK = names(['Novice', 'Adept', 'Expert', 'Master']);
const SKILLS = Array.from({ length: SKILL_SLOTS_MAX }, (_, at) => at + 1);

const skills = {
    slug: 'skills', name: 'Skills', role: 'skills', schema: 1, stateVersion: 1, scope: 'chat',
    prompt: 'Five skills for one character, a sixth at Lv 20, a seventh at 40 and an eighth at 60. Each has a description, the stat it rolls with, what it uses (stamina or mana), a rank (Novice, Adept, Expert, Master) and practice from 0 to 100. The narrator names a skill with a learn line (name, what it does, stat, uses) and adds practice. At 100 practice the rank rises by one and practice starts again at 0; a Master stays at 100.',
    show: { tab: true, card: false, tabName: 'Skills', icon: 'ph-book-open' },
    state: {
        who: text('Name'),
        ...Object.fromEntries(SKILLS.flatMap(n => [
            [`skill${n}`, text(`Skill ${n}`)],
            [`about${n}`, text(`About ${n}`, CREATION.skillAbout)],
            [`stat${n}`, { type: 'enum', values: [...STATS], default: STATS[0], label: `Stat ${n}` }],
            [`uses${n}`, { type: 'enum', values: [...USES], default: USES[0], label: `Uses ${n}` }],
            [`rank${n}`, int(`Rank ${n}`, 0, 3, 0, { names: RANK, edit: false })],
            [`practice${n}`, int(`Practice ${n}`, 0, 100, 0, { edit: false })],
        ])),
        // (a bit for each slot a pack's cast member brought, names.js signatureAt: the story never renames or replaces those; the reader cannot type it and the narrator is not told it)
        [SIGNATURE_FIELD]: int('Signature skills', 0, 2 ** SKILL_SLOTS_MAX - 1, 0, { edit: false, prompt: false }),
    },
    kinds: Object.fromEntries(SKILLS.flatMap(n => [
        [`learn-${n}`, { op: '~', labels: { name: { type: 'text', max: CREATION.skillName }, about: { type: 'text', max: CREATION.skillAbout }, stat: { type: 'enum', values: [...STATS] }, uses: { type: 'enum', values: [...USES] } },
            effects: [{ op: 'set', path: [`skill${n}`], value: ['arg', 'name'] }, { op: 'set', path: [`about${n}`], value: ['arg', 'about'] },
                { op: 'set', path: [`stat${n}`], value: ['arg', 'stat'] }, { op: 'set', path: [`uses${n}`], value: ['arg', 'uses'] }] }],
        [`practice-${n}`, { op: '+', labels: { amount: range(1, 20) },
            when: ['ne', get(`skill${n}`), ''], refusal: 'Name the skill before it can be practised.',
            effects: [{ op: 'add', path: [`practice${n}`], value: ['arg', 'amount'], bounds: 'clamp' }] }],
    ])),
    rules: SKILLS.map(n => ({ id: `rank-up-${n}`, when: ['and', ['ge', get(`practice${n}`), 100], ['lt', get(`rank${n}`), 3]],
        then: [{ op: 'add', path: [`rank${n}`], value: 1, bounds: 'clamp' }, { op: 'set', path: [`practice${n}`], value: 0 }] })),
};

// The Skills block with one more guard (the base definition below, and so its hash, never changes). A filled slot is never
// overwritten: the host sends a `learn-N` line to the slot already holding that name (updating it) or to a free one (data-modules/part.js
// skillRoute), so what reaches this condition is a free slot.
const standardSkills = {
    ...skills,
    // (Shorter text than the base block's, whose definition and hash stay as they were; a chat that already pinned the Standard Skills block keeps the text it was made with.)
    prompt: 'Five skills for one character (a sixth at Lv 20, a seventh at 40, an eighth at 60): what it does, its stat, what it uses (stamina or mana), a rank (Novice, Adept, Expert, Master) and practice 0 to 100. The narrator names a skill with a learn line and adds practice; 100 practice raises the rank.',
    kinds: Object.fromEntries(Object.entries(skills.kinds).map(([name, kind]) => [name, /^learn-/u.test(name)
        ? { ...kind, when: ['eq', get(`skill${name.slice(6)}`), ''], refusal: 'That slot holds a skill; use a free slot.' } : kind])),
};

// The Skills templates as 2.21 made them (five slots, no `sig`, the earlier text): frozen, derived from today's by taking the later slots and the signature mark out, so
// a Re-read of a join made before the extra slots builds the block that reply made (same fields, same pin) and not today's. Used only with `legacy` (join.js).
const FIVE = [1, 2, 3, 4, 5];
const upTo5 = key => !/^(skill|about|stat|uses|rank|practice)[6-9]$/u.test(key) && key !== SIGNATURE_FIELD;
const frozenSkills = (from, prompt) => ({
    ...from, prompt,
    state: Object.fromEntries(Object.entries(from.state).filter(([key]) => upTo5(key))),
    kinds: Object.fromEntries(Object.entries(from.kinds).filter(([name]) => FIVE.includes(Number(name.slice(name.lastIndexOf('-') + 1))))),
    rules: from.rules.filter(rule => FIVE.includes(Number(rule.id.slice(rule.id.lastIndexOf('-') + 1)))),
});
const standardSkillsV1 = frozenSkills(standardSkills, 'Up to five skills for one character: what it does, its stat, what it uses (stamina or mana), a rank (Novice, Adept, Expert, Master) and practice 0 to 100. The narrator names a skill with a learn line and adds practice; 100 practice raises the rank.');
/** The Skills template as 2.21 had it (a join made before the extra slots, read again). */
export const skillsV1For = () => structuredClone(standardSkillsV1);

/** The Skills template as the eight-slot release had it (no types): a Re-read of a join made before them, and a block in a chat that has only such blocks. */
export const skillsV2For = () => structuredClone(standardSkills);
// The Skills template new blocks are made from: the eight slots plus three utility ones, a type on every slot (templates-skills.js).
export const typedStandardSkills = typedSkills(standardSkills, 'Five combat skills (more with levels) and three utility ones, for the story only. Each has a description, a stat, what it uses, a rank and practice 0 to 100. A learn line names a skill (type combat or utility, combat if left out); 100 practice raises the rank.');

/**
 * The additive upgrade of a Skills block made before the extra skill slots (five slots, no `sig`): the same definition with the fields, kinds and rules of the slots
 * and the signature mark it lacks added from today's template (Standard's learn guard when the block has it). Nothing is removed, renamed or changed, and the text
 * (`prompt`) stays as it was. → the extended definition, or null when it lacks nothing (or is not a Skills block). Pure.
 */
export function grownSkills(definition) {
    if (definition?.role !== 'skills' || typeof definition.state !== 'object' || typeof definition.kinds !== 'object') return null;
    const base = definition.kinds['learn-1']?.when ? standardSkills : skills;
    const state = { ...definition.state }, kinds = { ...definition.kinds }, rules = [...(definition.rules ?? [])];
    let changed = false;
    for (const [key, schema] of Object.entries(base.state)) if (!Object.hasOwn(state, key)) { state[key] = structuredClone(schema); changed = true; }
    for (const [name, kind] of Object.entries(base.kinds)) if (!Object.hasOwn(kinds, name)) { kinds[name] = structuredClone(kind); changed = true; }
    for (const rule of base.rules) if (!rules.some(other => other.id === rule.id)) { rules.push(structuredClone(rule)); changed = true; }
    return changed ? { ...definition, state, kinds, rules } : null;
}
