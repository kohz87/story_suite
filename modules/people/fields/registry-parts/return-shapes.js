// The return shapes of Refresh, backfill and dossier import as key lists.

const SHAPE_IDENTITY = ['id', 'name', 'aliases'];
// Refresh writes each key's words without `keep` (an unchanged field is left out) and with the quote shape of its evidence map.
export const REFRESH_KEYS = Object.freeze({
    gender: { value: 'male|female', states: 'correct' },
    homeBase: { states: 'update' },
    age: { states: 'advance|correct' },
    apparentAge: { states: 'evolve' },
    background: { states: 'update' },
    keyRelationships: { states: 'update|evolve' },
    mood: { states: 'clear' }, location: { states: 'clear' }, goal: { states: 'clear' }, status: { states: 'clear' },
    lifeState: { value: 'alive|deceased' }, lifeStateCertainty: { value: 'explicit' },
    evidence: { value: '{field:["[mN] short quote"]}' },
    overallAppearanceForms: { states: 'refine|change' },
    currentForm: { states: 'select|unknown' },
});
const SHAPE_PROFILE = ['role', 'species', 'gender', 'homeBase', 'age', 'apparentAge', 'overallAppearance', 'appearance', 'personality', 'speech',
    'behaviorProfile', 'mannerisms', 'background', 'keyRelationships', 'relationshipSummary'];
const SHAPE_LIVE = ['mood', 'moodV', 'moodA', 'moodD', 'location', 'goal', 'status'];
const SHAPE_LIFE = ['lifeState', 'lifeStateCertainty', 'lifeStateReason'];
export const RETURN_SHAPES = Object.freeze({
    // None of the three asks for relationship numbers: every targeted pass zeroes them in code.
    // Refresh: identity, live and social facts in npcs[]; the evidence-gated profile fields in
    // profileUpdates[]. Refresh ignores presence, so it does not ask for it.
    refresh: Object.freeze({
        // (NSD11) Only changed fields: no `keep` states, no mood numbers (code derives them from the mood word), no tastes (the story's lines record them), no edges (`~ tie` lines do).
        npcs: Object.freeze([...SHAPE_IDENTITY, 'role', 'species', 'gender', 'homeBase', 'age', 'apparentAge', 'background', 'keyRelationships',
            'relationshipSummary', 'mood', 'location', 'goal', 'status', ...SHAPE_LIFE, 'memories', 'memoryRetention']),
        profileUpdates: Object.freeze(['id', 'evidence', 'personality', 'speech', 'appearance', 'overallAppearanceForms', 'appearanceForms', 'currentForm',
            'mannerisms', 'behaviorProfile', 'developmentScale', 'developmentReason']),
    }),
    backfill: Object.freeze({
        npcs: Object.freeze([...SHAPE_IDENTITY, 'identityKind', ...SHAPE_PROFILE, ...SHAPE_LIVE, ...SHAPE_LIFE, 'memories', 'memoryRetention', 'present', 'worldActive']),
    }),
    // Import fills a dossier from a structured text: no live state but the agenda, no presence.
    import: Object.freeze({
        npcs: Object.freeze([...SHAPE_IDENTITY, ...SHAPE_PROFILE, 'agenda', 'memories']),
    }),
});
