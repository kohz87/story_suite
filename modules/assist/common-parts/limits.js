// The limits both helpers share: the model-call time limit, the generation types they skip and type normalising.

// How long a helper waits for the model before it gives up (and the reply goes on without it).
export const TIMEOUT_MS = 20000;

// Generation types the helpers never run for (SPEC §4.1: they get nothing and capture nothing).
export const BACKGROUND = Object.freeze(['quiet', 'impersonate']);

export const normalizeType = type => String(type ?? 'normal').trim().toLowerCase() || 'normal';
