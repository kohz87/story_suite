// The field table: every stored NPC field and what each list derived from it needs to know.

const APPEARANCE_PARTS = Object.freeze(['appearance', 'overallAppearance', 'unclassifiedAppearance', 'appearanceForms', 'currentForm', 'currentFormUnknown', 'appearanceModelVersion', 'lookGuess', 'lookLockedAt']);

export const FIELDS = Object.freeze({
    id: { kind: 'identity', snapshot: [0, 'raw'], v2: 0 },
    name: { kind: 'identity', editorLock: 0, lock: [0, ['name', 'identityKind']], refreshChanged: 0, snapshot: [1, 'text'], v2: 1 },
    identityKind: { kind: 'part' },
    aliases: { kind: 'list', editorLock: 14, lock: [15, ['aliases']], revertList: 4, snapshot: [2, 'list'], v2: 2 },
    role: { kind: 'text', text: 0, editorLock: 1, lock: [1, ['role']], aliasMerge: 0, refreshChanged: 1, snapshot: [3, 'text'], v2: 3 },
    species: { kind: 'text', text: 1, editorLock: 2, lock: [2, ['species']], aliasMerge: 1, refreshChanged: 2, snapshot: [4, 'text'], v2: 4 },
    gender: { kind: 'text', text: 2, editorLock: 3, lock: [3, ['gender']], refreshChanged: 3, snapshot: [5, 'text'], v2: 5 },
    homeBase: { kind: 'text', text: 3, tracked: 4, dayTracked: 4, editorLock: 4, lock: [4, ['homeBase']], refreshChanged: 4, snapshot: [6, 'text'], v2: 9 },
    age: {
        kind: 'text', text: 4, tracked: 5, editorLock: 5, lock: [5, ['age']], aliasMerge: 2, refreshChanged: 5, snapshot: [7, 'text'], v2: 6,
        revertGroup: [2, ['age', 'apparentAge', 'birthDate', 'birthDateSource', 'birthDatePrecision', 'birthDateYearSource', 'birthDateReason',
            'birthDateSourceMessageId', 'birthDateCalendarFingerprint', 'birthDateDisplay', 'calendarAge', 'apparentAgeAnchor']],
    },
    apparentAge: { kind: 'text', text: 5, tracked: 6, editorLock: 6, lock: [6, ['apparentAge', 'apparentAgeAnchor']], aliasMerge: 3, refreshChanged: 6, snapshot: [8, 'text'], v2: 7 },
    birthDate: { kind: 'part', tracked: 18, v2: 8 },
    appearance: {
        kind: 'text', text: 6, evidence: 2, tracked: 12, lock: [7, APPEARANCE_PARTS], revertGroup: [1, APPEARANCE_PARTS],
        aliasMerge: 6, refreshChanged: 7, snapshot: [9, 'text'], v2: 10,
    },
    appearanceForms: { kind: 'part', v2: 11 },
    currentForm: { kind: 'part', v2: 12 },
    personality: {
        kind: 'text', text: 7, evidence: 0, tracked: 8, dayTracked: 0, editorLock: 7, lock: [8, ['personality']], revertGroup: [4, ['personality', 'personalityDevelopment']],
        aliasMerge: 4, refreshChanged: 8, snapshot: [10, 'text'], v2: 13,
    },
    speech: {
        kind: 'text', text: 8, evidence: 1, tracked: 9, dayTracked: 1, editorLock: 8, lock: [9, ['speech']], revertGroup: [5, ['speech', 'speechDevelopment']],
        aliasMerge: 5, refreshChanged: 9, snapshot: [11, 'text'], v2: 14,
    },
    mannerisms: { kind: 'list', evidence: 3, tracked: 11, editorLock: 11, lock: [12, ['mannerisms']], revertList: 1, refreshChanged: 19, snapshot: [21, 'list'], v2: 15 },
    behaviorProfile: { kind: 'list', evidence: 4, tracked: 10, dayTracked: 2, editorLock: 9, lock: [10, ['behaviorProfile']], revertList: 2, refreshChanged: 10, snapshot: [12, 'list'], v2: 16 },
    background: { kind: 'text', text: 9, tracked: 15, dayTracked: 3, editorLock: 10, lock: [11, ['background']], aliasMerge: 7, refreshChanged: 11, snapshot: [13, 'text'], v2: 17 },
    memories: { kind: 'list', tracked: 17, editorLock: 20, lock: [21, ['memories', 'manualMemories', 'memoryFacts']], revertList: 0, refreshChanged: 20, snapshot: [20, 'list'], v2: 18 },
    // The memories the reader entered by hand: a later scan never evicts them (core-mechanics mergeImportantMemories).
    manualMemories: { kind: 'part', userMeta: 6 },
    // Where and when each memory was recorded: { normalized text: { m: reply, d: story date } }, beside the list (core-record-shared.js stampMemories).
    memoryStamps: { kind: 'part' },
    // Code-derived memory facts (src/memory-fact-*.js): entries aligned to the memories above and a bounded suppression ledger. Absent on a dossier without facts.
    memoryFacts: { kind: 'part' },
    keyRelationships: { kind: 'list', tracked: 16, editorLock: 12, lock: [13, ['keyRelationships']], revertList: 3, refreshChanged: 12, snapshot: [22, 'list'], v2: 19 },
    relationshipSummary: { kind: 'text', text: 10, tracked: 14, editorLock: 15, lock: [16, ['relationshipSummary']], terminalFrozen: 9, aliasMerge: 8, refreshChanged: 13, snapshot: [14, 'text'], v2: 20 },
    relationship: {
        kind: 'meter', tracked: 13, terminalFrozen: 4, snapshot: [32, 'shallow'], v2: 21,
        revertGroup: [0, ['relationship', 'relationshipProgress', 'relationshipMilestones', 'relationshipEventHistory', 'lastRelationshipChange', 'impactDay']],
    },
    relationshipProgress: { kind: 'part', terminalFrozen: 5 },
    relationshipMilestones: { kind: 'part', terminalFrozen: 6 },
    relationshipEventHistory: { kind: 'part', terminalFrozen: 7 },
    lastRelationshipChange: { kind: 'part', terminalFrozen: 8, snapshot: [33, 'relationshipChange'] },
    // The events counted for the story day (src/relationship-pacing.js): reverts with the relationship it paces (not frozen by a death).
    impactDay: { kind: 'part' },
    mood: { kind: 'text', text: 11, tracked: 0, editorLock: 16, lock: [17, ['mood']], terminalFrozen: 0, aliasMerge: 9, refreshChanged: 14, snapshot: [15, 'text'], v2: 22 },
    location: { kind: 'text', text: 12, tracked: 1, editorLock: 17, lock: [18, ['location']], terminalFrozen: 1, aliasMerge: 10, refreshChanged: 15, snapshot: [16, 'text'], v2: 23 },
    goal: { kind: 'text', text: 13, tracked: 2, editorLock: 18, lock: [19, ['goal']], terminalFrozen: 2, aliasMerge: 11, refreshChanged: 16, snapshot: [17, 'text'], v2: 24 },
    status: { kind: 'text', text: 14, tracked: 3, editorLock: 19, lock: [20, ['status']], terminalFrozen: 3, aliasMerge: 12, refreshChanged: 17, snapshot: [18, 'text'], v2: 25 },
    customFields: { kind: 'map', editorLock: 13, lock: [14, ['customFields']], v2: 26 },
    lifeState: {
        kind: 'life', tracked: 7, refreshChanged: 18, snapshot: [25, 'lifeState'], v2: 27,
        revertGroup: [3, ['lifeState', 'lifeStateCertainty', 'lifeStateReason', 'archived', 'archiveReason', 'archivedAt', 'archiveSourceMessageId']],
    },
    lifeStateCertainty: { kind: 'life', snapshot: [26, 'text'] },
    lifeStateReason: { kind: 'life', aliasMerge: 13, snapshot: [27, 'text'] },
    present: { kind: 'meta', snapshot: [23, 'bool'], v2: 28 },
    worldActive: { kind: 'meta', snapshot: [24, 'bool'], v2: 29 },
    archived: { kind: 'life', snapshot: [28, 'bool'], v2: 30 },
    archiveReason: { kind: 'life', snapshot: [29, 'text'] },
    archivedAt: { kind: 'life', snapshot: [30, 'nullable'] },
    archiveSourceMessageId: { kind: 'life', snapshot: [31, 'messageId'] },
    minor: { kind: 'meta', userMeta: 5, snapshot: [38, 'bool'], v2: 31 },
    retentionProtected: { kind: 'meta', userMeta: 4, snapshot: [37, 'bool'] },
    portraitPromptPositive: { kind: 'meta', userMeta: 0, prompt: 'never' },
    portraitPromptNegative: { kind: 'meta', userMeta: 1, prompt: 'never' },
    portraitPromptReplace: { kind: 'meta', userMeta: 2, prompt: 'never' },
    portraitSeed: { kind: 'meta', userMeta: 3, prompt: 'never' },
    updatedAt: { kind: 'meta', snapshot: [34, 'now'] },
    seenCount: { kind: 'meta', terminalFrozen: 10, snapshot: [35, 'count'] },
    lastSeenTurn: { kind: 'meta', terminalFrozen: 11 },
    lastWorldActiveTurn: { kind: 'meta', terminalFrozen: 12 },
    manualProfileFields: { kind: 'meta', snapshot: [36, 'list'] },
    // (v2 meters) The hidden notes: [{ id, meter?, at?, when?, title?, text }]. No scanner, Refresh, import or
    // injection prompt of Delta's carries them; they reach the story only through the v2 module's tail, while the
    // NPC is present: an opened one as known to the player, a locked one worded "hidden: never state or reveal".
    secrets: { kind: 'secret', prompt: 'tail' },
    // (v2 meters) The reader's meter setup for this NPC: { track (a preset or ladder track), limits:
    // { meter: { ceiling?, floor? } } }. Read by the v2 slice's handlers only; never model-facing.
    meterSetup: { kind: 'meta', prompt: 'never' },
    // (the living cast) Where a dossier made from the pack's cast came from: { key, pack, id, packName?, packVersion?, met: { on, where },
    // goal, routine, stages? } (src/cast-dossier.js). The person's own stage ladder (`stages`) is read by the v2 slice's handlers only.
    castFrom: { kind: 'meta', prompt: 'never' },
});
