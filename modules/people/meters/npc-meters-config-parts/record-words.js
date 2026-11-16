// The reason labels, forbidden keys, word pattern and record field names of an npc record.

// Labels a change line may carry that are not meters: the reason words are skipped quietly,
// `stage` is refused (code sets stages), `disposition` is a short word kept on the entry.
export const REASON_LABELS = new Set(['reason', 'why', 'because', 'note', 'cause']);

export const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
export const WORDS = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;
export const RECORD_FIELDS = Object.freeze(['name', 'meters', 'stages', 'unlocked', 'disposition', 'turn', 'milestones', 'rank', 'low', 'day', 'held', 'progress', 'impactDay', 'lastEvent', 'via', 'mood', 'moodLog', 'inst', 'pull', 'track', 'lies', 'knows', 'tastes', 'ties', 'drives', 'lookLockedAt']);
