// Event and choice field names and the events part's limits.

export const EVENT_FIELDS = Object.freeze(['id', 'when', 'cue', 'once', 'after', 'then', 'decision']);
// The events part's own limits (src/v2/events), so a pack that passes here also runs there.
export const EVENT_LIMITS = Object.freeze({ when: 500, cue: 500, then: 8 });
export const CHOICE_FIELDS = Object.freeze(['id', 'name', 'note', 'stats', 'tags']);
