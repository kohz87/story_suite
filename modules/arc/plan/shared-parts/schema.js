// Story Director v2, part **arc**: plan item labels, allowed parts, and kind ordering.

export const LABELS = Object.freeze({ ARC: 'arc', BEAT: 'beat', ENCOUNTER: 'beat', AGENDA: 'agenda', HOOK: 'hook', CLOCK: 'clock', SECRET: 'secret' });
/** The parts each kind keeps, in the order the plan text writes them. */
export const PARTS = Object.freeze({
    arc: Object.freeze([]),
    beat: Object.freeze(['on', 'place', 'after', 'reach', 'encounter']),
    agenda: Object.freeze(['now', 'then', 'on', 'place']),
    hook: Object.freeze(['then', 'on']),
    clock: Object.freeze(['due', 'shown']),
    secret: Object.freeze([]),
});
export const DATE_PARTS = new Set(['on', 'due']);
export const KIND_ORDER = ['beat', 'agenda', 'hook', 'clock', 'secret'];
