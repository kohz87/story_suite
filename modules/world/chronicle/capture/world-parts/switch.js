// Story Director v2, chronicle part: the feature switch `story-director.world-events` (default off) and the text it teaches the narrator.

export const WORLD_EVENTS = 'story-director.world-events';

/** Whether the world-events switch is on for this command (false where the host gives no switches). */
export const worldEventsOn = ctx => typeof ctx?.feature === 'function' && ctx.feature(WORLD_EVENTS) === true;

/**
 * NEW model-facing text (owner's approval pending): sent only while the switch is on.
 */
export const WORLD_TEACHING = [
    'A world line may also change the standing conditions of a place, route, region or realm: add `| conditions: +name, -name` (+ sets a condition, - lifts it) using only names from the pack\'s list of world conditions; the place (or region) on the line says where it holds.',
    'Write at most one world line in a reply.',
].join(' ');
