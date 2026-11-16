// The approach kinds, their labels, the kinds that read as flattery, and reading an approach label.

export const APPROACH_KINDS = Object.freeze(['praise', 'gift', 'help', 'flirt', 'threat', 'shared-danger']);

export const APPROACH_LABEL = Object.freeze({
    praise: 'praise', gift: 'gift', help: 'help', flirt: 'flirting', threat: 'threat', 'shared-danger': 'shared danger',
});

// Only these approaches read as pressure from low trust (a threat from low trust is simply a threat).
export const FLATTERY_KINDS = Object.freeze(['praise', 'gift']);

/** The approach kind of a label (`via: praise`), or null: an unknown or missing label is not gated. */
export function normalizeApproachKind(value) {
    return APPROACH_KINDS.includes(value) ? value : null;
}
