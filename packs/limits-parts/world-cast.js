// The world pack: cast kinds, fields, tie tags and limits.

export const WORLD_CAST_FIELDS = Object.freeze(['kind', 'id', 'name', 'aliases', 'role', 'species', 'gender', 'age', 'apparentAge', 'look', 'wears', 'forms', 'voice', 'personality', 'behaviour', 'mannerisms', 'history', 'homeBase', 'start', 'keyRelationships', 'ties', 'withYou', 'meters', 'stages', 'drawnTo', 'tastes', 'secrets', 'level', 'abilities', 'keepsakes', 'canDieUnmet', 'portrait', 'protected', 'status', 'goal']);
export const CAST_KINDS = Object.freeze(['companion', 'figure']);
export const TIE_TAGS = Object.freeze(['kin', 'partner', 'friend', 'ally', 'mentor', 'serves', 'rival', 'enemy', 'owes']);
export const WORLD_CAST_LIMITS = Object.freeze({ entries: 64, aliases: 6, secrets: 8, stages: 8, behaviour: 6, mannerisms: 4, forms: 6, ties: 200, keyRelationships: 200, tastes: 100, abilities: 100, keepsakes: 100, text: 1200, line: 200 });
