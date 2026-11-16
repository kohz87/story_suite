// Mounts: a plain JSON copy of a draft or payload.

/** Plain JSON copy (drafts, payloads): drops functions and undefined. */
export const plainCopy = value => (value === undefined ? {} : JSON.parse(JSON.stringify(value)));
