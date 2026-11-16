// Host capabilities and the `content.you` (Your look) field names and limits.

// `content.you` (Your look, MODULES §F126): an object, not a list. A pack opts in to a Rank for {{user}} with
// `content.you.rank: { "label": "Guild rank" }` (the label is what Home and the Status card call it, 1 to 30 characters).
export const YOU_FIELDS = Object.freeze(['rank']);
export const YOU_RANK_FIELDS = Object.freeze(['label']);
export const YOU_RANK_LABEL_MAX = 30;
// Capabilities provided by the host in addition to installed modules.
export const HOST_CAPABILITIES = Object.freeze(['data-modules-v1']);
