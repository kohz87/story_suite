// The Character template: the base definition, the Standard one with its blocks, and the two exported forms (before and after the doubled bars).
import { CREATION, LEVEL, STATS_EARLIER as STATS, STAGES } from '../names.js';
import { STANDARD_NUMBERS } from '../formula.js';
import { scaledCharacter } from '../templates-bars.js';
import { withRecovery } from '../templates-recovery.js';
import { names } from './shared-names.js';
import { get, int, range, text } from './shared-fields.js';
import { bar, hiddenSize, stageLabel, blocksOf } from './shared-bars.js';
import { SIZE, sizeRule } from './shared-size.js';

const HEALTH = names(STAGES.health);
const MANA = names(STAGES.mana);
const STAMINA = names(STAGES.stamina);
const SOUL = names(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'], 1);

// The level rise. The XP field holds up to LEVEL.xpMax, so XP above 100 is kept: a reply that gives 95 + 40 leaves 35 over. The rise is worked out once from the
// XP and the room under the cap, `rise` = min(floor(xp / 100), cap − level) levels, and carries the remainder: it gives one point to spend for every multiple of
// LEVEL.pointEvery (3) the new levels cross (floor((level + rise) / 3) − floor(level / 3)), raises the level by `rise` and takes 100 XP for each. `rise` is the
// rule's own working number (hidden, not in the prompt). A second rule holds the XP at 100 at the cap, so the XP past the cap is not kept.
const levelUp = () => ({ id: 'level-up', when: ['and', ['ge', get('xp'), LEVEL.xpPerLevel], ['lt', get('level'), get('cap')]],
    then: [{ op: 'set', path: ['rise'], value: ['min', ['floorDiv', get('xp'), LEVEL.xpPerLevel], ['sub', get('cap'), get('level')]] },
        { op: 'add', path: ['points'], value: ['sub', ['floorDiv', ['add', get('level'), get('rise')], LEVEL.pointEvery], ['floorDiv', get('level'), LEVEL.pointEvery]], bounds: 'clamp' },
        { op: 'add', path: ['level'], value: get('rise'), bounds: 'clamp' }, { op: 'add', path: ['xp'], value: ['mul', get('rise'), -LEVEL.xpPerLevel], bounds: 'clamp' },
        { op: 'set', path: ['rise'], value: 0 }] });
const xpCap = () => ({ id: 'xp-cap', when: ['and', ['ge', get('level'), get('cap')], ['gt', get('xp'), LEVEL.xpPerLevel]], then: [{ op: 'set', path: ['xp'], value: LEVEL.xpPerLevel }] });

const character = {
    slug: 'character', name: 'Character', role: 'character', schema: 1, stateVersion: 1, scope: 'chat',
    prompt: 'One character: who they are, health, mana and stamina (words, shown as bars), seven stats from 1 to 20, unspent points, Level 1 to 99 and XP to 100. The narrator sets health, mana, stamina and XP; the story cannot kill a character outright: they die only when they were already Down before a reply and are still Down at its end. The reader sets stats and points. XP at 100 raises the Level by one, up to the Level cap, and every third Level gives a point to spend on stats.',
    show: { tab: true, card: false, tabName: 'Character', icon: 'ph-user' },
    state: {
        who: text('Name'),
        about: text('Who they are', CREATION.about),
        health: int('Health', 0, 5, 5, { names: HEALTH }),
        mana: int('Mana', 0, 4, 4, { names: MANA }),
        stamina: int('Stamina', 0, 4, 4, { names: STAMINA }),
        ...Object.fromEntries(STATS.map(stat => [stat, int(stat.toUpperCase(), 1, 20, 10)])),
        points: int('Points', 0, 60, 0),
        level: int('Level', LEVEL.min, LEVEL.max, 1),
        xp: int('XP', 0, LEVEL.xpMax, 0),
        rise: int('Rise', 0, LEVEL.max, 0, { prompt: false, edit: false }),
        cap: int('Level cap', LEVEL.min, LEVEL.max, LEVEL.max, { prompt: false }),
        down: { type: 'bool', default: false, label: 'Down', prompt: false },
        alive: { type: 'bool', default: true, label: 'Alive' },
        // A companion who left the party (a `- party Name` line, join.js): kept on the Party tab, greyed, and no longer rolled for.
        left: { type: 'bool', default: false, label: 'Left' },
    },
    kinds: {
        'set-health': { op: '~', labels: { to: range(0, 5) }, effects: [{ op: 'set', path: ['health'], value: ['arg', 'to'] }] },
        'set-mana': { op: '~', labels: { to: range(0, 4) }, effects: [{ op: 'set', path: ['mana'], value: ['arg', 'to'] }] },
        'set-stamina': { op: '~', labels: { to: range(0, 4) }, effects: [{ op: 'set', path: ['stamina'], value: ['arg', 'to'] }] },
        'add-xp': { op: '+', labels: { amount: range(0, 100) }, effects: [{ op: 'add', path: ['xp'], value: ['arg', 'amount'], bounds: 'clamp' }] },
        'button-rest': { op: '!', ui: true, title: 'Rest', labels: {}, effects: [{ op: 'set', path: ['stamina'], value: 4 }, { op: 'set', path: ['mana'], value: 4 }] },
    },
    rules: [levelUp(), xpCap()],
    // The story has no kind that sets `alive`: death comes only through this latch. (The reader may still fix `alive` with the pencil.)
    // Death is a latch over two reply-end functions, run in this order: the first ends the story only when the
    // character was already Down when the reply started; the second then records whether they are Down now.
    replyEnd: [
        { type: 'reply-end', when: ['and', ['eq', get('health'), 0], get('down')], effects: [{ op: 'set', path: ['alive'], value: false }] },
        { type: 'reply-end', when: true, effects: [{ op: 'set', path: ['down'], value: ['eq', get('health'), 0] }] },
    ],
    cards: [
        { type: 'card', when: ['not', get('alive')], tone: 'end', title: 'The story ends here',
            text: 'This character has died. Swipe or delete the reply that ended it to take that back.' },
    ],
};

const STANDARD_STAT = STANDARD_NUMBERS.startStat;

const standardCharacterV1 = {
    slug: 'character', name: 'Character', role: 'character', schema: 1, stateVersion: 2, scope: 'chat',
    prompt: 'One character: who they are, health, stamina and mana (words, shown as bars), seven stats 1 to 20, points, Level 1 to 99 and XP to 100. The narrator sets health, mana, stamina and XP by words. The story cannot kill them outright: they die only when Down before a reply and still Down at its end. The reader sets stats and points; XP at 100 raises the Level, and every third Level gives a point.',
    show: character.show,
    state: {
        who: text('Name'),
        about: text('Who they are', CREATION.about),
        health: bar('Health', 8, 'health', 5),
        mana: bar('Mana', 7, 'mana', 4),
        stamina: bar('Stamina', 7, 'stamina', 4),
        ...Object.fromEntries(STATS.map(stat => [stat, int(stat.toUpperCase(), 1, STANDARD_NUMBERS.statMax, STANDARD_STAT)])),
        points: int('Points', 0, 60, 0),
        level: int('Level', LEVEL.min, LEVEL.max, 1),
        xp: int('XP', 0, LEVEL.xpMax, 0),
        rise: int('Rise', 0, LEVEL.max, 0, { prompt: false, edit: false }),
        cap: int('Level cap', LEVEL.min, LEVEL.max, LEVEL.max, { prompt: false }),
        down: { type: 'bool', default: false, label: 'Down', prompt: false },
        alive: { type: 'bool', default: true, label: 'Alive' },
        left: { type: 'bool', default: false, label: 'Left' },
        'health-blocks': hiddenSize('Health blocks', 8, 5),
        'stamina-blocks': hiddenSize('Stamina blocks', 7, 4),
        'mana-blocks': hiddenSize('Mana blocks', 7, 4),
    },
    kinds: {
        'set-health': { op: '~', labels: { to: stageLabel(STAGES.health) }, effects: [{ op: 'set', path: ['health'], value: blocksOf(['arg', 'to'], SIZE.health, STAGES.health.length) }] },
        'set-mana': { op: '~', labels: { to: stageLabel(STAGES.mana) }, effects: [{ op: 'set', path: ['mana'], value: blocksOf(['arg', 'to'], SIZE.mana, STAGES.mana.length) }] },
        'set-stamina': { op: '~', labels: { to: stageLabel(STAGES.stamina) }, effects: [{ op: 'set', path: ['stamina'], value: blocksOf(['arg', 'to'], SIZE.stamina, STAGES.stamina.length) }] },
        'add-xp': character.kinds['add-xp'],
        'button-rest': { op: '!', ui: true, title: 'Rest', labels: {}, effects: [{ op: 'set', path: ['stamina'], value: SIZE.stamina }, { op: 'set', path: ['mana'], value: SIZE.mana }] },
    },
    // The bars first (they read the stats as they stand), then the level rise (a point to spend with every third level).
    rules: [sizeRule('health-bar', 'health', 'health-blocks', SIZE.health), sizeRule('stamina-bar', 'stamina', 'stamina-blocks', SIZE.stamina),
        sizeRule('mana-bar', 'mana', 'mana-blocks', SIZE.mana),
        levelUp(), xpCap()],
    replyEnd: character.replyEnd,
    cards: character.cards,
};

/** The Character template as it was before the doubled bars (no `scale` mark: Health 4 + VIT/5, Stamina 3 + AGI/5, Mana 3 + INT/5): a chat's earlier characters, and a companion joining a chat that has only those. */
export const characterV1For = () => structuredClone(standardCharacterV1);
// The template the chooser, the wizard and an import make blocks from: the same Character with the doubled bars (templates-bars.js).
export const standardCharacter = withRecovery(scaledCharacter(standardCharacterV1, SIZE));
