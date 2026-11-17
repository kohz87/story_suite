// The Character block of Combat Rules v1: seven stats 1 to 30 (WIS, no LUK), HP / MP / SP as plain numbers whose largest value a rule works out from the stats and
// the level (hidden `hp-max`, `mp-max`, `sp-max`; the formulas are combat/bars.js's), one point to spend per level, the death latch, and the recovery kinds.
// The story sets HP, MP and SP by a stage word (a share of the largest value) and can only lower them; a rest, a full rest or a heal raises them.
// Its fields are `hp`, `mp`, `sp`, so the stage-bar layout of the earlier Character (`health`, `mana`, `stamina`) never applies. Pure data.
import { CREATION, LEVEL, STAGES } from '../names.js';
import { V1 } from '../combat/numbers.js';
import { names } from './shared-names.js';
import { get, int, text } from './shared-fields.js';
import { STATS_V1, BAR_START_V1, BAR_MAX_V1 } from './v1-shared.js';

const BARS = [['hp', 'health'], ['mp', 'mana'], ['sp', 'stamina']];
const add2 = (a, b) => ['add', a, b];
const level = (div) => ['floorDiv', get('level'), div];
const pair = (a, b, div) => ['floorDiv', add2(get(a), get(b)), div];
// The largest value of each bar, as combat/bars.js reads it: 5 + level/3 + VIT/2, 8 + level/4 + (INT+WIS)/4, 8 + level/4 + (STR+AGI)/4.
const SIZE = {
    hp: add2(add2(V1.hp.base, level(V1.hp.levelDiv)), ['floorDiv', get('vit'), V1.hp.vitDiv]),
    mp: add2(add2(V1.mp.base, level(V1.mp.levelDiv)), pair('int', 'wis', V1.mp.pairDiv)),
    sp: add2(add2(V1.sp.base, level(V1.sp.levelDiv)), pair('str', 'agi', V1.sp.pairDiv)),
};
const hidden = { prompt: false, edit: false };
const HEAL_WORDS = ['A quarter', 'Half', 'Three quarters'];

// The level rise: XP in whole hundreds raise the level (up to the cap) and each level gained gives ONE point to spend. `rise` is the rule's working number.
const levelUp = () => ({ id: 'level-up', when: ['and', ['ge', get('xp'), LEVEL.xpPerLevel], ['lt', get('level'), get('cap')]],
    then: [{ op: 'set', path: ['rise'], value: ['min', ['floorDiv', get('xp'), LEVEL.xpPerLevel], ['sub', get('cap'), get('level')]] },
        { op: 'add', path: ['points'], value: ['mul', get('rise'), V1.stat.perLevel], bounds: 'clamp' },
        { op: 'add', path: ['level'], value: get('rise'), bounds: 'clamp' }, { op: 'add', path: ['xp'], value: ['mul', get('rise'), -LEVEL.xpPerLevel], bounds: 'clamp' },
        { op: 'set', path: ['rise'], value: 0 }] });
const xpCap = () => ({ id: 'xp-cap', when: ['and', ['ge', get('level'), get('cap')], ['gt', get('xp'), LEVEL.xpPerLevel]], then: [{ op: 'set', path: ['xp'], value: LEVEL.xpPerLevel }] });

// A bar that grew gains the new points full (not while Down), then the stored largest value and the shrink cap (two rules so each expression fits the budget).
const barRules = bar => [
    { id: `${bar}-grow`, when: ['and', ['gt', get(bar), 0], ['gt', SIZE[bar], get(`${bar}-max`)]],
        then: [{ op: 'add', path: [bar], value: ['sub', SIZE[bar], get(`${bar}-max`)], bounds: 'clamp' }] },
    { id: `${bar}-size`, when: ['ne', get(`${bar}-max`), SIZE[bar]],
        then: [{ op: 'set', path: [`${bar}-max`], value: SIZE[bar] }, { op: 'set', path: [bar], value: ['min', get(bar), SIZE[bar]] }] },
];

// The share of the bar a stage word stands for: round(word × largest / (words − 1)), half up (blocks.js wordToBlocks); the story may lower a bar to it, never raise.
const lowerTo = (bar, count) => ({ op: 'set', path: [bar], value: ['min', get(bar), ['floorDiv', add2(['mul', ['arg', 'to'], get(`${bar}-max`)], Math.floor((count - 1) / 2)), count - 1]] });
const stageKind = (bar, words) => ({ op: '~', labels: { to: { type: 'int', min: 0, max: words.length - 1, names: names(words) } }, effects: [lowerTo(bar, words.length)] });
const refill = bars => bars.map(bar => ({ op: 'set', path: [bar], value: get(`${bar}-max`) }));

export const characterV1 = {
    slug: 'character', name: 'Character', role: 'character', schema: 1, stateVersion: 3, scope: 'chat',
    prompt: 'One character: who they are, seven stats 1 to 30 (STR VIT AGI DEX INT WIS CHA), HP, MP and SP (numbers; the narrator never writes a number: it lowers one with a health, mana or stamina stage word and a rest, '
        + 'full-rest or heal raises it), points, Level 1 to 99 and XP. They die only when Down before a reply and still Down at its end. The reader sets stats and spends points; every Level gives one point.',
    show: { tab: true, card: false, tabName: 'Character', icon: 'ph-user' },
    state: {
        who: text('Name'),
        about: text('Who they are', CREATION.about),
        hp: int('HP', 0, BAR_MAX_V1.hp, BAR_START_V1.hp),
        mp: int('MP', 0, BAR_MAX_V1.mp, BAR_START_V1.mp),
        sp: int('SP', 0, BAR_MAX_V1.sp, BAR_START_V1.sp),
        ...Object.fromEntries(STATS_V1.map(stat => [stat, int(stat.toUpperCase(), V1.stat.min, V1.stat.max, V1.stat.start)])),
        points: int('Points', 0, (V1.level.max - 1) * V1.stat.perLevel, 0),
        level: int('Level', LEVEL.min, LEVEL.max, 1),
        xp: int('XP', 0, LEVEL.xpMax, 0),
        rise: int('Rise', 0, LEVEL.max, 0, hidden),
        cap: int('Level cap', LEVEL.min, LEVEL.max, LEVEL.max, { prompt: false }),
        ...Object.fromEntries(BARS.map(([bar]) => [`${bar}-max`, int(`${bar.toUpperCase()} largest`, 0, BAR_MAX_V1[bar], BAR_START_V1[bar], hidden)])),
        down: { type: 'bool', default: false, label: 'Down', prompt: false },
        alive: { type: 'bool', default: true, label: 'Alive' },
        // A companion who left the party (a `- party Name` line, join.js): kept on the Party tab, greyed, and no longer rolled for.
        left: { type: 'bool', default: false, label: 'Left' },
    },
    kinds: {
        'set-health': stageKind('hp', STAGES.health), 'set-mana': stageKind('mp', STAGES.mana), 'set-stamina': stageKind('sp', STAGES.stamina),
        'button-rest': { op: '!', ui: true, title: 'Rest', labels: {}, effects: refill(['sp', 'mp']) },
        rest: { op: '~', labels: {}, effects: refill(['sp', 'mp']) },
        'full-rest': { op: '~', labels: {}, effects: refill(['hp', 'sp', 'mp']) },
        // `amount` quarters of the largest HP (1 to 3), up to the largest; the story says it in words (a quarter, half, three quarters), never a number.
        heal: { op: '~', labels: { amount: { type: 'int', min: 1, max: 3, names: names(HEAL_WORDS, 1) } }, effects: [{ op: 'add', path: ['hp'], value: ['mul', ['floorDiv', get('hp-max'), 4], ['arg', 'amount']], bounds: 'clamp' }] },
    },
    // The level rise first (the sizes read the new level), then each bar's size; the death latch below.
    rules: [levelUp(), xpCap(), ...BARS.flatMap(([bar]) => barRules(bar))],
    replyEnd: [
        { type: 'reply-end', when: ['and', ['eq', get('hp'), 0], get('down')], effects: [{ op: 'set', path: ['alive'], value: false }] },
        { type: 'reply-end', when: true, effects: [{ op: 'set', path: ['down'], value: ['eq', get('hp'), 0] }] },
    ],
    cards: [{ type: 'card', when: ['not', get('alive')], tone: 'end', title: 'The story ends here',
        text: 'This character has died. Swipe or delete the reply that ended it to take that back.' }],
};
