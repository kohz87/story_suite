// Story Director v2, tracker part (convert): the small text and position helpers the converters share.

// v1's own kinds a job may be offered as before the reader takes it on.
export const OFFER_KINDS = new Set(['hook', 'event']);

export const text = value => String(value ?? '');

export const position = at => (at ? { message: at.turn ?? null, time: at.time ?? null } : { message: null, time: null });

export const stamp = at => (at && (at.message !== null && at.message !== undefined || at.time !== null && at.time !== undefined)
    ? { turn: at.message ?? null, time: at.time ?? null } : null);
