// Chronicle queries' common set-up: the chronicle slice, its calendar and the Director's clock.

import { toolsQuery } from './shared-ask.js';
import { calendarFrom, nowFrom } from './clock.js';

export function setup(state, tools) {
    const query = toolsQuery(tools);
    const chronicle = state?.domains?.chronicle ?? { events: {}, factions: {} };
    return { chronicle, calendar: calendarFrom(query), now: nowFrom(query, state) };
}
