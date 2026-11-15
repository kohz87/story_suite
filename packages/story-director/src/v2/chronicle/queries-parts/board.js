// Chronicle queries' board of events and factions for the Chronicle screen.

import { orderedEvents, orderedFactions } from '../domain.js';
import { dateText } from './clock.js';
import { setup } from './env.js';
import { eventOut, factionOut } from './out.js';

/** `chronicle.board`: what the Chronicle screen shows, worked out ahead (a template cannot sort or count). */
export function chronicleBoard(state, _args, tools) {
    const env = setup(state, tools);
    const events = orderedEvents(env.chronicle).map(event => eventOut(event, env));
    const open = events.filter(event => event.open);
    const resolved = events.filter(event => !event.open);
    const factions = orderedFactions(env.chronicle).map(faction => factionOut(faction, env));
    return {
        open, resolved, factions,
        hasOpen: open.length > 0, hasResolved: resolved.length > 0, hasFactions: factions.length > 0,
        openCount: open.length, resolvedCount: resolved.length, factionCount: factions.length,
        now: dateText(env.calendar, env.now),
    };
}
