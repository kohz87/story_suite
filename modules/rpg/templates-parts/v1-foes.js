// The Foes block of Combat Rules v1: up to six foe groups, one slot each: a name, a count (0 = empty slot, at most six: combat/numbers.js foe.groupMax), a level 1 to 99 and a
// tier (mob, minion, standard, elite, boss, apex). The narrator only sets a slot and clears it; it never writes a hurt: each foe's own HP is the board's (combat/foes.js foeMembers).
// A slot clears as down, fled, gone or captured (no yield). Pure data; not offered by the chooser yet.
import { V1 } from '../combat/numbers.js';
import { get, int, range, text } from './shared-fields.js';
import { TIER_NAMES } from './v1-shared.js';

const SLOTS = [1, 2, 3, 4, 5, 6];
const WHY = ['down', 'fled', 'gone', 'captured'];
const tier = (extra = {}) => ({ type: 'enum', values: [...TIER_NAMES], ...extra });

export const foesV1 = {
    slug: 'foes', name: 'Foes', role: 'foes', schema: 1, stateVersion: 3, scope: 'chat',
    prompt: 'Up to six foe groups in the fight, one slot each: name, count (0 = empty slot, 1 to 6), level 1 to 99 and tier (mob, minion, standard, elite, boss or apex). '
        + 'The narrator sets a slot when a group arrives and clears it when the group is down, fled, gone or captured. It never writes how hurt a foe is: the fight settles that.',
    show: { tab: true, card: false, tabName: 'Foes', icon: 'ph-skull' },
    state: Object.fromEntries(SLOTS.flatMap(n => [
        [`foe${n}`, text(`Foe ${n}`)],
        [`count${n}`, int(`Count ${n}`, 0, V1.foe.groupMax, 0)],
        [`level${n}`, int(`Level ${n}`, V1.level.min, V1.level.max, 1)],
        [`tier${n}`, tier({ default: V1.foe.defaultTier, label: `Tier ${n}` })],
    ])),
    kinds: Object.fromEntries(SLOTS.flatMap(n => [
        [`set-slot-${n}`, { op: '+', when: ['eq', get(`count${n}`), 0], refusal: 'That slot is taken; clear it first.',
            labels: { name: { type: 'text', max: 40 }, count: range(1, V1.foe.groupMax), level: range(V1.level.min, V1.level.max), tier: tier() },
            effects: [{ op: 'set', path: [`foe${n}`], value: ['arg', 'name'] }, { op: 'set', path: [`count${n}`], value: ['arg', 'count'] },
                { op: 'set', path: [`level${n}`], value: ['arg', 'level'] }, { op: 'set', path: [`tier${n}`], value: ['arg', 'tier'] }] }],
        [`clear-${n}`, { op: '-', labels: { why: { type: 'enum', values: WHY } },
            effects: [{ op: 'set', path: [`count${n}`], value: 0 }, { op: 'set', path: [`foe${n}`], value: '' }, { op: 'set', path: [`tier${n}`], value: V1.foe.defaultTier }] }],
    ])),
};
