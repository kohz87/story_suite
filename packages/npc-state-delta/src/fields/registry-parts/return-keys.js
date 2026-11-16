// How each key a targeted prompt asks the model to return is written in its return shape.

// (cleanup step 13) How each key a targeted prompt asks the model to return is written in its return
// shape, and the shapes of Refresh, backfill and dossier import as key lists. A key's entry:
//   value   the allowed words ('a|b'), '[]' for a list, or a literal; absent = free text
//   states  the state words normalizeScanNpc reads for it (the same ones the scan uses); the shape
//           then lists `${key}State` (or stateKey) after it. As in the scan's rules, the matching
//           reason key is named by the prompt's legend, not listed.
//   key     the key written, when the entry name differs
// core-mechanics returnShape() writes the shapes from these; nothing here decides anything.
export const RETURN_KEYS = Object.freeze({
    id: {}, name: {}, aliases: { value: '[]' }, identityKind: { value: 'proper_name|role_label' },
    role: {}, species: {},
    gender: { value: 'male|female|""', states: 'keep|correct' },
    homeBase: { states: 'keep|update' },
    age: { states: 'keep|advance|correct' },
    apparentAge: { states: 'keep|evolve' },
    overallAppearance: {},
    appearance: { states: 'refine|change' },
    personality: { states: 'refine|evolve' },
    speech: { states: 'refine|evolve' },
    behaviorProfile: { value: '[]', states: 'refine|evolve' },
    mannerisms: { value: '[]', states: 'refine|evolve', stateKey: 'mannerismState' },
    background: { states: 'keep|update' },
    keyRelationships: { value: '["Name — their role to this NPC | durable dynamic"]', states: 'keep|update|evolve' },
    relationshipSummary: {},
    mood: { states: 'keep|clear' },
    moodV: { value: '-3..3' }, moodA: { value: '-3..3' }, moodD: { value: '-3..3' },
    location: { states: 'keep|clear' },
    goal: { states: 'keep|clear' },
    status: { states: 'keep|clear' },
    agenda: { key: 'goal' },
    lifeState: { value: 'unknown|alive|deceased' }, lifeStateCertainty: { value: 'explicit|inferred|""' }, lifeStateReason: {},
    // Refresh's optional tastes (asked only while hosted with the notes feature on): the stored taste shape (src/npc-notes-tastes.js).
    tastes: { value: '[{sign:+ likes, values or collects|- dislikes,item,from:short source from the scenes}]' },
    memories: { value: '[]' }, memoryRetention: { value: '[]' },
    present: { value: 'true|false' }, worldActive: { value: 'true|false' },
    // Refresh's profile channel, with the Stage 4 form keys.
    evidence: { value: '{field:[short quotes]}' },
    overallAppearanceForms: { key: 'overallAppearance', states: 'keep|refine|change' },
    appearanceForms: { value: '[{name,appearance,state:refine|change,reason}]' },
    currentForm: { states: 'keep|select|unknown' },
    developmentScale: { value: 'gradual|explicit|batch' }, developmentReason: {},
});
