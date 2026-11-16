// The Foes template of the Standard formula: six foe groups with a name, count, level and a bar of health.
import { STAGES } from '../names.js';
import { FOE_LEVEL } from '../foes.js';
import { get, int, range, text } from './shared-fields.js';
import { bar, stageLabel, blocksOf } from './shared-bars.js';

const SLOTS = [1, 2, 3, 4, 5, 6];

// A foe group's Health: 12 + level/30 blocks (the harder-foes rule; the field holds up to 15, which is how the reader tells such a block from an older one, foes.js isHardBar).
const FOE_SIZE = n => ['add', FOE_LEVEL.hardBase, ['floorDiv', get(`level${n}`), FOE_LEVEL.healthStep]];

export const standardFoes = {
    slug: 'foes', name: 'Foes', role: 'foes', schema: 1, stateVersion: 2, scope: 'chat',
    prompt: 'Up to six foe groups in the fight, one slot each: name, count (0 = empty slot), its level from 1 to 99 and health (words). The narrator sets a slot when a group arrives, hurts it as the fight goes and clears it when the group is down, gone, fled, captured or yielded.',
    show: { tab: true, card: false, tabName: 'Foes', icon: 'ph-skull' },
    state: Object.fromEntries(SLOTS.flatMap(n => [
        [`foe${n}`, text(`Foe ${n}`)],
        [`count${n}`, int(`Count ${n}`, 0, 99, 0)],
        [`level${n}`, int(`Level ${n}`, 1, 99, 1)],
        [`hurt${n}`, bar(`Health ${n}`, FOE_LEVEL.hardMax, 'foe', FOE_LEVEL.hardBase)],
    ])),
    kinds: Object.fromEntries(SLOTS.flatMap(n => [
        [`set-slot-${n}`, { op: '+', labels: { name: { type: 'text', max: 40 }, count: range(1, 99), level: range(1, 99) },
            when: ['eq', get(`count${n}`), 0], refusal: 'That slot is taken; clear it first.',
            effects: [{ op: 'set', path: [`foe${n}`], value: ['arg', 'name'] }, { op: 'set', path: [`count${n}`], value: ['arg', 'count'] },
                { op: 'set', path: [`level${n}`], value: ['arg', 'level'] }, { op: 'set', path: [`hurt${n}`], value: ['add', FOE_LEVEL.hardBase, ['floorDiv', ['arg', 'level'], FOE_LEVEL.healthStep]] }] }],
        [`hurt-${n}`, { op: '~', labels: { to: stageLabel(STAGES.health) }, when: ['gt', get(`count${n}`), 0], refusal: 'That slot is empty.',
            effects: [{ op: 'set', path: [`hurt${n}`], value: blocksOf(['arg', 'to'], FOE_SIZE(n), STAGES.health.length) }] }],
        [`clear-${n}`, { op: '-', labels: { why: { type: 'enum', values: ['down', 'fled', 'yielded', 'captured', 'gone'] } },
            effects: [{ op: 'set', path: [`count${n}`], value: 0 }, { op: 'set', path: [`foe${n}`], value: '' }, { op: 'set', path: [`hurt${n}`], value: FOE_LEVEL.hardBase }] }],
    ])),
};

/** The most one Foes group may count: read from the stock Foes definition, so the pre-check never exceeds its own block. */
export const FOE_COUNT_MAX = standardFoes.state.count1.max;
