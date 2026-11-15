// Story Director v2, chronicle part: day-facts entry key and folding limits. Pure.

/** Entries a day may keep before a note folds them into its own one (a very long day). */
export const FOLD_AT = 200;
/** Entries the written days keep in all, so their digests follow them (newest days first, each day whole). */
export const FOLLOW_MAX = 800;
export const ENTRY_KEY = /^(-?\d{1,15})\.(\d{1,15})$/;
