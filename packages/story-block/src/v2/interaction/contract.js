// Defines the interaction error codes, size limits and plain refusal objects shared by every port step.

export const ERROR_CODES = Object.freeze({
    FEATURE_OFF: 'FEATURE_OFF',
    NO_REPLY: 'NO_REPLY',
    BUSY: 'BUSY',
    NOT_YOURS: 'NOT_YOURS',
    INVALID: 'INVALID',
    CHANGED: 'CHANGED',
    TOO_BIG: 'TOO_BIG',
    ENDED: 'ENDED',
    NO_INPUT: 'NO_INPUT',
    REFUSED: 'REFUSED',
    DAMAGED: 'DAMAGED',
    CLAIMED: 'CLAIMED',
    NO_LONGER_DONE: 'NO_LONGER_DONE',
    NOT_READY: 'NOT_READY',
});

export const DEFAULT_LIMITS = Object.freeze({
    steps: 99,
    stepInputs: 12,
    setupBytes: 16384,
    inputBytes: 1024,
    payloadBytes: 65536,
    changes: 48,
    noteTokens: null,
    resultBytes: 65536,
});

const sentence = (code, title, detail) => {
    const named = String(title ?? 'interaction').trim() || 'interaction';
    const reason = typeof detail === 'string' && detail.trim() ? detail.trim() : null;
    if (reason && (code === 'INVALID' || code === 'DAMAGED' || code === 'ENDED' || code === 'NOT_YOURS')) return reason;
    const messages = {
        FEATURE_OFF: reason ? `Turn on ${reason} or discard the ${named}.` : `The ${named} is turned off.`,
        NO_REPLY: `There is no reply to open the ${named} from.`,
        BUSY: reason ? `Finish or discard the ${reason} first.` : `Finish or discard the open interaction first.`,
        NOT_YOURS: `You cannot choose that in the ${named}.`,
        INVALID: `The ${named} refused that step.`,
        CHANGED: `What the ${named} read has changed; discard it and start again.`,
        TOO_BIG: `The ${named} is too large to save.`,
        ENDED: `The ${named} has ended.`,
        NO_INPUT: `Play at least one step of the ${named} first.`,
        REFUSED: `The ${named} does not play that by itself.`,
        DAMAGED: `The saved ${named} is damaged.`,
        CLAIMED: `This ${named} was already settled.`,
        NO_LONGER_DONE: `The earlier part of the ${named} changed.`,
        NOT_READY: `The ${named} is not ready yet.`,
    };
    return messages[code] ?? `The ${named} could not continue.`;
};

/** The plain `{ code, message }` refusal every part of the port returns. */
export function interactionError(code, title, detail = null) {
    const known = Object.hasOwn(ERROR_CODES, code) ? code : ERROR_CODES.DAMAGED;
    return { code: known, message: sentence(known, title, detail) };
}

/** The kind's limits with each valid override applied over the defaults. */
export function limitsFor(kindOrLimits = {}) {
    const raw = kindOrLimits && typeof kindOrLimits === 'object' && Object.hasOwn(kindOrLimits, 'limits')
        ? kindOrLimits.limits : kindOrLimits;
    const out = { ...DEFAULT_LIMITS };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return Object.freeze(out);
    for (const key of Object.keys(DEFAULT_LIMITS)) {
        const value = raw[key];
        if (key === 'noteTokens' && value === null) out[key] = null;
        else if (Number.isSafeInteger(value) && value > 0) out[key] = value;
    }
    return Object.freeze(out);
}
