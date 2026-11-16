// The rebuild's fixed values: how many replies it reads, the two read choices, and the causes a rebuild may cure.

/** The default number of replies a rebuild reads. */
export const REBUILD_DEFAULT_REPLIES = 40;
/** `rebuild(module, { read })` choices. */
export const REBUILD_READ_LAST = 'last-40';
export const REBUILD_READ_ALL = 'all';
/** The causes that may be cured by rebuilding (a permanent block only). */
export const REBUILD_CODES = Object.freeze(['SNAPSHOT_UNAVAILABLE', 'CONFLICT', 'DEPENDENCY_UNAVAILABLE']);
