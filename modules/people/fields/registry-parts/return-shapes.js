// The return shapes of Refresh, backfill and dossier import as key lists.

const SHAPE_IDENTITY = ['id', 'name', 'aliases'];
const SHAPE_PROFILE = ['role', 'species', 'gender', 'homeBase', 'age', 'apparentAge', 'overallAppearance', 'appearance', 'personality', 'speech',
    'behaviorProfile', 'mannerisms', 'background', 'keyRelationships', 'relationshipSummary'];
const SHAPE_LIVE = ['mood', 'moodV', 'moodA', 'moodD', 'location', 'goal', 'status'];
const SHAPE_LIFE = ['lifeState', 'lifeStateCertainty', 'lifeStateReason'];
export const RETURN_SHAPES = Object.freeze({
    // None of the three asks for relationship numbers: every targeted pass zeroes them in code.
    // Refresh: identity, live and social facts in npcs[]; the evidence-gated profile fields in
    // profileUpdates[]. Refresh ignores presence, so it does not ask for it.
    refresh: Object.freeze({
        npcs: Object.freeze([...SHAPE_IDENTITY, 'role', 'species', 'gender', 'homeBase', 'age', 'apparentAge', 'background', 'keyRelationships',
            'relationshipSummary', ...SHAPE_LIVE, ...SHAPE_LIFE, 'memories', 'memoryRetention']),
        profileUpdates: Object.freeze(['id', 'evidence', 'personality', 'speech', 'appearance', 'overallAppearanceForms', 'appearanceForms', 'currentForm',
            'mannerisms', 'behaviorProfile', 'developmentScale', 'developmentReason']),
        edges: true,
    }),
    backfill: Object.freeze({
        npcs: Object.freeze([...SHAPE_IDENTITY, 'identityKind', ...SHAPE_PROFILE, ...SHAPE_LIVE, ...SHAPE_LIFE, 'memories', 'memoryRetention', 'present', 'worldActive']),
    }),
    // Import fills a dossier from a structured text: no live state but the agenda, no presence.
    import: Object.freeze({
        npcs: Object.freeze([...SHAPE_IDENTITY, ...SHAPE_PROFILE, 'agenda', 'memories']),
    }),
});
