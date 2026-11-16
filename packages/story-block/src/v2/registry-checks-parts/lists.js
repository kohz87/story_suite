// The restore states, settings places and capability cap a definition is held to.

// The states of the restore barrier (setRestore); only 'pending' holds modules back.
export const RESTORE_STATES = Object.freeze(['idle', 'pending', 'failed']);

export const SETTINGS_PLACES = Object.freeze(['diagnostics']);
export const placeOf = value => (SETTINGS_PLACES.includes(value) ? value : null);

// How many capability names a module may declare (`capabilities`: what a pack's requires.capabilities can name).
export const MAX_CAPABILITIES = 32;
