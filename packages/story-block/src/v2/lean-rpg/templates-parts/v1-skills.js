// The Skills block of Combat Rules v1: a name, what it does, the stat it rolls with, a type (the eight of combat/numbers.js) and practice 0 to 600 on every slot, and a rank
// 0 to 6 that a rule sets from the practice (a hundred practice a rank). There is no `uses` field: the pool (SP or MP) comes from the stat alone (combat/skills.js).
// The rank stored here is the one practice has earned; the rank in force also needs the character's level (combat/skills.js rankOf, read by read-parts/v1-rows.js).
// One stance skill per owner is held where learn lines are routed (canOwn), not in a rule: a learn kind cannot see the other slots. Pure data; not offered by the chooser yet.
import { CREATION } from '../names.js';
import { SIGNATURE_FIELD, SKILL_FIELDS_MAX } from '../../skill-slots.js';
import { RANKS, V1 } from '../combat/numbers.js';
import { names } from './shared-names.js';
import { get, int, range, text } from './shared-fields.js';
import { STATS_V1 } from './v1-shared.js';

const TYPES = Object.freeze(Object.keys(V1.skill.types));
const SLOTS = Array.from({ length: SKILL_FIELDS_MAX }, (_, at) => at + 1);
const TOP = RANKS.length - 1, STEP = RANKS[1].practice - RANKS[0].practice;
const RANK_NAMES = names(RANKS.map(rank => rank.name));

/** The skill types a Skills block of these rules knows, in the combat table's order. */
export const SKILL_TYPE_NAMES = TYPES;

export const skillsV1 = {
    slug: 'skills', name: 'Skills', role: 'skills', schema: 1, stateVersion: 3, scope: 'chat',
    prompt: 'Skills for one character (five to start, more with levels). Each has what it does, the stat it rolls with, a type (attack, area, defence, evasion, movement, heal, support or utility) and practice 0 to 600; '
        + 'a hundred practice is a rank (Novice, Apprentice, Adept, Expert, Master, Grandmaster, Legend). A learn line names a skill: name, what it does, stat and type. '
        + 'Only one stance skill (defence, evasion, movement or support) may be owned. Utility skills are for the story only.',
    show: { tab: true, card: false, tabName: 'Skills', icon: 'ph-book-open' },
    state: {
        who: text('Name'),
        ...Object.fromEntries(SLOTS.flatMap(n => [
            [`skill${n}`, text(`Skill ${n}`)],
            [`about${n}`, text(`About ${n}`, CREATION.skillAbout)],
            [`stat${n}`, { type: 'enum', values: [...STATS_V1], default: STATS_V1[0], label: `Stat ${n}` }],
            [`type${n}`, { type: 'enum', values: [...TYPES], default: V1.skill.defaultType, label: `Type ${n}` }],
            [`rank${n}`, int(`Rank ${n}`, 0, TOP, 0, { names: RANK_NAMES, edit: false })],
            [`practice${n}`, int(`Practice ${n}`, 0, TOP * STEP, 0, { edit: false })],
        ])),
        // (a bit for each slot a pack's cast member brought; the story never renames or replaces those)
        [SIGNATURE_FIELD]: int('Signature skills', 0, 2 ** SKILL_FIELDS_MAX - 1, 0, { edit: false, prompt: false }),
    },
    kinds: Object.fromEntries(SLOTS.flatMap(n => [
        [`learn-${n}`, { op: '~', when: ['eq', get(`skill${n}`), ''], refusal: 'That slot holds a skill; use a free slot.',
            labels: { name: { type: 'text', max: CREATION.skillName }, about: { type: 'text', max: CREATION.skillAbout }, stat: { type: 'enum', values: [...STATS_V1] }, type: { type: 'enum', values: [...TYPES] } },
            effects: [{ op: 'set', path: [`skill${n}`], value: ['arg', 'name'] }, { op: 'set', path: [`about${n}`], value: ['arg', 'about'] },
                { op: 'set', path: [`stat${n}`], value: ['arg', 'stat'] }, { op: 'set', path: [`type${n}`], value: ['arg', 'type'] }] }],
        [`practice-${n}`, { op: '+', labels: { amount: range(1, 20) }, when: ['ne', get(`skill${n}`), ''], refusal: 'Name the skill before it can be practised.',
            effects: [{ op: 'add', path: [`practice${n}`], value: ['arg', 'amount'], bounds: 'clamp' }] }],
    ])),
    // The rank follows the practice: a hundred practice a rank, up to Legend. (Idempotent: it only writes when the rank is not the one the practice earned.)
    rules: SLOTS.map(n => ({ id: `rank-up-${n}`, when: ['ne', get(`rank${n}`), ['min', TOP, ['floorDiv', get(`practice${n}`), STEP]]],
        then: [{ op: 'set', path: [`rank${n}`], value: ['min', TOP, ['floorDiv', get(`practice${n}`), STEP]] }] })),
};
