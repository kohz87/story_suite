// Story Director v2, part **arc**: the planner's rule for world events (switch story-director.world-events; wording adopted 18 Nov).
// Added to the brief only while the switch is on (the brief is null while it is off).

/** The rule as the planner reads it, above the world events block. */
export const WORLD_EVENT_RULE = 'World events resolve by the world\'s own rolls. Plan how the party and the world react to an Active world event (rumours, preparations, refugees, a letter, a choice), never how it ends: no beat, clock or agenda may decide it, end it or show its outcome (no coronation while a succession is undecided).';

/** The EVENT line, taught only while the switch is on (new wording, for the owner's approval: WORLDEV2.REPORT.md; read by plan/read-parts/event-line.js). */
export const EVENT_LINE_RULE = 'You may also propose up to two new world events the story has earned, each on its own line: EVENT: Title — what happens | where: <a place on the map> | on: <date> | because: <the world events, conditions, Journal entries or threads that cause it, by name>. An event that names no cause the world records, or no place on the map, is left out.';
