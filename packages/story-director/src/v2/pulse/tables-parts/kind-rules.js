// Per-kind rules: the quiet-mode fallbacks and which actor count each kind needs.

/** In quiet mode an effect entry becomes this flavour kind (every one has lines for every place group). */
export const QUIET_FALLBACK = Object.freeze({
    ENTER_CHECK: 'BACKGROUND_INCIDENT',
    GOSSIP_SURGE: 'MUNDANE_INTERRUPTION',
    CHANCE_MEETING: 'MUNDANE_INTERRUPTION',
    OVERHEARD_DETAIL: 'MUNDANE_INTERRUPTION',
    TASK_SHIFT: 'BACKGROUND_INCIDENT',
});

/** Pulse step version 2 and later: effect entries spread over different flavour kinds (all need no actor) so quiet mode is less repetitive. */
export const QUIET_SPREAD = Object.freeze({
    ENTER_CHECK: 'BACKGROUND_INCIDENT',
    GOSSIP_SURGE: 'MUNDANE_INTERRUPTION',
    CHANCE_MEETING: 'OBJECT_DISCOVERY',
    OVERHEARD_DETAIL: 'OUTSIDE_INTRUSION',
    TASK_SHIFT: 'POWER_SHIFT',
});

/** Which actor count an entry needs to happen: 'none', 'present', 'offscreen', 'known' or 'cast'. */
export const ACTOR_NEEDS = Object.freeze({
    CALM: 'none',
    ENTER_CHECK: 'offscreen',
    BACKGROUND_INCIDENT: 'none',
    MOOD_SWING: 'present',
    MUNDANE_INTERRUPTION: 'none',
    GOSSIP_SURGE: 'known',
    OVERHEARD_DETAIL: 'known',
    CHANCE_MEETING: 'cast',
    TASK_SHIFT: 'offscreen',
    ENV_SHIFT: 'none',
    PHYSICAL_REACTION: 'none',
    OBJECT_DISCOVERY: 'none',
    OUTSIDE_INTRUSION: 'none',
    MEMORY_TRIGGER: 'present',
    POWER_SHIFT: 'none',
});
