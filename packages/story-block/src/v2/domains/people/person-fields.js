// The closed list of the fields a person's record may hold in the people domain (NPC State's dossier fields). A key outside the list is refused, so a
// dropped field (archive and retention fields, `status`-style leftovers of old versions) cannot come back through a writer that still sets it.
// Sorted; add a field here in the same change that adds it to NPC State's record (tests/people/ checks real records against this list).
export const PERSON_FIELDS = new Set([
    'age', 'aliases', 'apparentAge', 'appearance', 'appearanceForms', 'appearanceModelVersion', 'background', 'behaviorProfile',
    'birthDate', 'birthDateCalendarFingerprint', 'birthDateDisplay', 'birthDatePrecision', 'birthDateReason', 'birthDateSource',
    'birthDateSourceMessageId', 'birthDateYearSource', 'birthday', 'calendarAge', 'castFrom', 'createdAt', 'currentForm', 'currentFormUnknown',
    'customFields', 'deathCorrection', 'fieldChangeDays', 'fieldChangeMessages', 'fieldChanges', 'followed', 'gender', 'goal', 'homeBase', 'id',
    'identityKind', 'impactDay', 'keyRelationships', 'lastRelationshipChange', 'lookGuess', 'lastSeenTurn', 'lastWorldActiveTurn', 'lifeState',
    'lifeStateCertainty', 'lifeStateReason', 'location', 'mannerisms', 'manualMemories', 'manualProfileFields', 'manualProfileLocksExplicit',
    'memories', 'memoryFacts', 'memoryStamps', 'meterSetup', 'minor', 'mood', 'name', 'overallAppearance', 'personality',
    'personalityDevelopment', 'portrait', 'portraitPromptNegative', 'portraitPromptPositive', 'portraitPromptReplace', 'portraitSeed',
    'present', 'profileEvidence', 'relationship', 'relationshipEventHistory', 'relationshipMilestones', 'relationshipProgress',
    'relationshipSummary', 'role', 'secrets', 'seenCount', 'species', 'speech', 'speechDevelopment', 'status', 'tieSeen',
    'unclassifiedAppearance', 'updatedAt', 'worldActive',
]);
