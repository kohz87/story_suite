// The closed descriptor tables of a data module definition, the entry effects and the block bars.
import { OPS } from '../../../../../../core/capture.js';
import { freeze } from './shared-freeze.js';

export const DM_DESCRIPTORS = freeze({
    definition: { required: ['slug', 'name', 'schema', 'stateVersion', 'scope', 'state', 'kinds'],
        optional: ['imports', 'rules', 'timers', 'rewards', 'exports', 'screens', 'layouts', 'migrations', 'prompt', 'show', 'role', 'cards', 'replyEnd', 'layout', 'roles', 'tones'] },
    defaults: { imports: {}, rules: [], timers: [], rewards: {}, exports: {}, screens: [], layouts: [], migrations: [] },
    scope: ['chat', 'character'],
    fields: {
        int: { required: ['type', 'min', 'max', 'default'], optional: ['edit', 'label', 'names', 'prompt', 'blocks', 'scale'] }, bool: { required: ['type', 'default'], optional: ['edit', 'label', 'prompt'] },
        enum: { required: ['type', 'values', 'default'], optional: ['edit', 'label', 'prompt'] }, text: { required: ['type', 'max', 'default'], optional: ['edit', 'list', 'label', 'prompt'] },
        map: { required: ['type', 'keys', 'values'], optional: ['edit', 'label', 'prompt'] },
        // A list of entries: `of` holds the sub-fields (text, int or enum, no `edit`/`prompt`/`label` of their own to speak of), `max` the most entries.
        entries: { required: ['type', 'of'], optional: ['max', 'edit', 'label', 'prompt'] },
    },
    // (`optional: true` on a label of an entries line: the line may leave it out)
    labels: { int: { required: ['type', 'min', 'max'], optional: ['names', 'optional'] }, bool: ['type'], enum: { required: ['type', 'values'], optional: ['optional'] }, text: { required: ['type', 'max'], optional: ['optional'] } },
    layouts: ['cards', 'bars', 'fields'],
    roleKeys: ['field', 'title', 'status', 'step'],
    toneNames: ['active', 'done', 'failed', 'neutral'],
    kind: { required: ['op', 'labels', 'effects'], optional: ['when', 'refusal', 'oncePerReply', 'ui', 'check', 'title'] },
    ops: [...OPS],
    effects: {
        set: { required: ['op', 'path', 'value'], optional: [] },
        add: { required: ['op', 'path', 'value'], optional: ['bounds'] },
        clamp: { required: ['op', 'path', 'min', 'max'], optional: [] },
        reward: { required: ['op', 'template', 'bind'], optional: [] },
        offer: { required: ['op', 'template', 'key', 'bind'], optional: [] },
        award: { required: ['op', 'offer'], optional: [] },
        // The three lines of a List of entries field: add an entry, change one (`at`: its number or title), drop one.
        entryAdd: { required: ['op', 'path'], optional: [] },
        entrySet: { required: ['op', 'path'], optional: [] },
        entryDrop: { required: ['op', 'path'], optional: [] },
    },
    arities: { get: 1, arg: 1, bind: 1, input: 2, reward: 1, check: 1, timer: 1,
        eq: 2, ne: 2, lt: 2, le: 2, gt: 2, ge: 2, and: 2, or: 2, not: 1,
        add: 2, sub: 2, mul: 2, min: 2, max: 2, floorDiv: 2, clamp: 3 },
    rule: { required: ['id', 'when', 'then'], optional: [] },
    // A card under the head reply (derived from its state, never stored) and a rule settled once at the end of each reply.
    card: { required: ['when', 'tone', 'title', 'text'], optional: ['id', 'type', 'button'] },
    cardTones: ['info', 'warn', 'end'],
    replyEnd: { required: ['when', 'effects'], optional: ['id', 'type'] },
    timer: { required: ['id', 'clock', 'every', 'effects'], optional: [] },
    reward: { required: ['bindings', 'values', 'effects'], optional: ['when'] },
    range: { required: ['min', 'max', 'pick'], optional: [] },
    rangeTable: { required: ['binding', 'table'], optional: [] },
    pick: ['min', 'max', 'midpoint'],
    import: { required: ['query', 'mode', 'projection'], optional: ['args'] },
    adapters: {
        'director.time': { modes: ['prefix', 'recorded'], projection: ['minutes'], args: [] },
        'checks.policy': { modes: ['prefix', 'recorded'], projection: ['actors.id', 'actors.name'], args: [] },
        'dataModules.public': { modes: ['prefix', 'recorded'], projection: null, args: ['module', 'export', 'who'] },
    },
    export: { required: ['fields'], optional: [] },
    migration: { required: ['from', 'to', 'add'], optional: [] },
    v11Effects: ['grantCoin', 'grantItem', 'grantXp'],
});

/** The effects that work a List of entries field (the interpreter reads the line's labels itself). */
export const DM_ENTRY_EFFECTS = Object.freeze(['entryAdd', 'entrySet', 'entryDrop']);

/** What an int field's `blocks` may say: a character's bar (its stored value counts the blocks left) or a foe group's health. */
export const DM_BLOCK_BARS = Object.freeze(['health', 'stamina', 'mana', 'foe']);
