// The interpreter's version, its budgets (limits) and the diagnostic texts.
import { freeze } from './shared-freeze.js';

export const DATA_MODULES_CAPABILITY = 'data-modules-v1';
export const DM_LIMITS = freeze({
    interpreter: 1, definitions: 20, pins: 28, subjects: 16,
    definitionBytes: 32768, pinsBytes: 262144, instanceBytes: 16384,
    fields: 32, kinds: 16, rules: 32, timers: 8, templates: 16,
    expressionDepth: 6, expressionNodes: 64, effects: 16, imports: 8, offers: 64,
    rootVisits: 2048, replyRoots: 32, replyVisits: 16384,
    patchOps: 128, actionBytes: 8192, pinBytes: 131072,
    staticCharacters: 2000, tailTokens: 100,
    slug: 40, enumValues: 32, mapKeys: 16, text: 240, migrations: 4,
    elapsedMinutes: 525600, integer: 1000000000, errors: 20,
    // Added with the RPG (the frozen interpreter-1 basis in hash-basis-v1.js keeps its own copy): the block prompt cap,
    // the display names of a number field, and the card and reply-end functions of a block.
    prompt: 1200, names: 32, nameText: 40, cards: 4, replyEnd: 4, cardTitle: 60, cardText: 240,
    // A block with a `role` (a Character or Skills sheet) says more in the tail: five skills with what each does, or a character with who they are.
    roleTailTokens: 300,
    // A Skills block (role `skills`) holds up to eight skill slots of six fields each, their `who` and the signature mark: more than other blocks' 32 (names.js SKILL_SLOTS_MAX).
    // Its tail may be longer too, by 47 tokens for each skill it holds past five (tailRoom in part.js: the longest line one skill makes, measured).
    // A Skills block made with the types holds eleven slots (eight combat, three utility) of seven fields each (a `type` per slot), their `who` and the mark: 79 fields and a learn and
    // a practice line per slot, so `skillsFields` 80 and `skillsKinds` 22 (a block of the earlier eight slots is far inside both).
    skillsLegacyFields: 56, skillsFields: 80, skillsKinds: 22, skillTailTokens: 47,
    // A Foes block (role `foes`) holds up to six groups of three kinds each (set, hurt, clear): 18 kinds, two over the others' 16 (its fields, 24, are inside 32).
    foesKinds: 18,
    // The most stages a role block's bar field (health, mana, stamina, a foe's health) may have, counted up from 0.
    stages: 10,
    // The same for a character's bar that carries `scale: 2` (the doubled sizes, lean-rpg/templates-bars.js): the most it holds is 2 x (4 + 20/5) = 16 at the stat
    // maximum 20, so 17 stages (0 to 16); a test holds this to the template's own maximum.
    scaledStages: 17,
    // The same for a foe's health that carries `blocks: "foe"` (the harder-foes rule: 12 + level/30 blocks, at most 15, so 16 stages; lean-rpg/foes.js hardMax).
    foeStages: 16,
    // A List of entries field (`type: "entries"`): the sub-fields of one entry, the entries a story may add (default and most), and the longest `at` a line may write.
    entrySubs: 8, entriesDefault: 30, entriesMax: 50, entryAt: 60,
    // A block with a List of entries says more in the tail (its open entries by number and title): 250 tokens instead of 100.
    listTailTokens: 250,
});

export const DM_DIAGNOSTICS = freeze({
    DM_SCHEMA: 'Invalid data module definition or reference.',
    DM_BOUNDS: 'A value or arithmetic result is outside its declared bounds.',
    DM_LABEL: 'A line label or claim label is invalid.',
    DM_CONDITION: 'A condition must be boolean; a false kind condition refuses the line.',
    DM_BUDGET: 'The data module exceeds a version 1 budget.',
});
