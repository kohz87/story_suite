// The World part definition: its feature, queries, settings, screens and widgets.

import { DEFAULT_UPCOMING_DAYS, FEATURE, MAX_UPCOMING_DAYS, hereView, worldView } from '../known.js';
import { journalDay, journalEvents, journalView } from '../journal.js';
import { PEOPLE_WIDGET, peopleWidget } from '../people.js';
import { EVENTS_WIDGET, eventsWidget } from '../events-widget.js';
import { stChatId } from '../../../../ui/legacy/director/screens/reveal.js';
import { FOLD_WIDGET, foldWidget, leadsOf } from '../elsewhere.js';
import { daysScreen, worldScreen } from '../screen.js';
import { cueToday, heardHere, newsAt } from '../news.js';
import { WORLD_EVENTS } from '../news-switch.js';
import { COURIER_KM_PER_DAY } from '../../../atlas/atlas/courier.js';

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
        // News arrival over the routes (news.js): null with the world-events switch off.
        'world.newsAt': (state, args, tools) => newsAt(state, args, tools),
        'world.heardHere': (state, args, tools) => heardHere(state, args, tools),
        'world.cueToday': (state, args, tools) => cueToday(state, args, tools),
        'director.journal': tagged((state, args, tools) => journalView(state, args, tools)),
        'director.journal.events': tagged((state, args, tools) => journalEvents(state, args, tools)),
        // Not feature-tagged: other modules' recap works whether or not the World screen or the digest is on (contract P: journal.day).
        'journal.day': (state, args, tools) => journalDay(state, args, tools),
    },
    kinds: {},
    hooks: {},
    settings: {
        defaults: { upcomingDays: DEFAULT_UPCOMING_DAYS, courierKmPerDay: COURIER_KM_PER_DAY },
        schema: {
            upcomingDays: { type: 'int', label: 'World: Upcoming looks this many story days ahead', min: 1, max: MAX_UPCOMING_DAYS, feature: FEATURE },
            courierKmPerDay: { type: 'int', label: 'World: news travels this many km a day by courier', min: 5, max: 500, feature: WORLD_EVENTS },
        },
    },
    tabs: [],
    screens: [worldScreen, daysScreen],
    widgets: { [PEOPLE_WIDGET]: peopleWidget, [EVENTS_WIDGET]: eventsWidget, [FOLD_WIDGET]: foldWidget },
};
