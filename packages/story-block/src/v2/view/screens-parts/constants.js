// The screen registry's fixed words: where a screen may mount, where a definition may come from, and the size limits it must keep.

export const MOUNTS = Object.freeze(['tab', 'screen', 'card', 'hud', 'dialog']);
export const SOURCES = Object.freeze(['reader', 'card', 'pack', 'module']);
export const CSS_LIMIT = 64 * 1024;

/** The longest summary template a card screen may give. */
export const SUMMARY_MAX = 500;
