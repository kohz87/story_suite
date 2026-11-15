// The World part definition: its feature, queries, settings, screens and widgets.

import { DEFAULT_UPCOMING_DAYS, FEATURE, MAX_UPCOMING_DAYS, hereView, worldView } from '../known.js';
import { journalDay, journalEvents, journalView } from '../journal.js';
import { PEOPLE_WIDGET, peopleWidget } from '../people.js';
import { EVENTS_WIDGET, eventsWidget } from '../events-widget.js';
import { stChatId } from '../../screens/reveal.js';
import { FOLD_WIDGET, foldWidget, leadsOf } from '../elsewhere.js';
import { daysScreen, worldScreen } from '../screen.js';

const tagged = fn => Object.assign(fn, { feature: FEATURE });

export const part = {
    features: [{
        id: FEATURE,
        label: 'World view',
        describe: 'The World screen: where you are and who is here, the news, events and factions you know, what you know is coming, and a journal of each story day. Only what your character knows.',
        default: true,
    }],
    domains: {},
    commands: {},
    queries: {
        'director.world': tagged((state, args, tools) => worldView(state, args, tools)),
        'director.world.here': tagged((state, args, tools) => hereView(state, args, tools)),
        // The hooks the player has heard of: `{ rows, has, count }` (elsewhere.js).
        'director.world.leads': tagged((state, _args, tools) => {
            const rows = leadsOf(state, tools);
            return { rows, has: rows.length > 0, count: rows.length };
        }),
        // The open chat's id, bound into every fold head so a chat switch re-reads the folds.
        'director.world.chat': tagged(() => ({ id: stChatId() })),
        'director.journal': tagged((state, args, tools) => journalView(state, args, tools)),
        'director.journal.events': tagged((state, args, tools) => journalEvents(state, args, tools)),
        // Not feature-tagged: other modules' recap works whether or not the World screen or the digest is on (contract P: journal.day).
        'journal.day': (state, args, tools) => journalDay(state, args, tools),
    },
    kinds: {},
    hooks: {},
    settings: {
        defaults: { upcomingDays: DEFAULT_UPCOMING_DAYS },
        schema: {
            upcomingDays: { type: 'int', label: 'World: Upcoming looks this many story days ahead', min: 1, max: MAX_UPCOMING_DAYS, feature: FEATURE },
        },
    },
    tabs: [],
    screens: [worldScreen, daysScreen],
    widgets: { [PEOPLE_WIDGET]: peopleWidget, [EVENTS_WIDGET]: eventsWidget, [FOLD_WIDGET]: foldWidget },
};
