// Story Director v2, world: the World screen's Now view, put together from its sections.

import { calendarFrom, nowFrom, dateText, clockText } from './clock.js';
import { hiddenNames } from './hidden.js';
import { hereView } from './here.js';
import { NEWS_SHOWN, FACTIONS_SHOWN, UPCOMING_SHOWN } from './shared-limits.js';
import { placeQuests } from './links.js';
import { knownNews, knownFactions } from './news.js';
import { queryOf } from './query.js';
import { isInt } from './shared-text.js';
import { upcomingDaysOf } from './upcoming-days.js';
import { knownUpcoming } from './upcoming.js';

/**
 * `director.world` → the World screen's Now view: `{ here, news, factions, upcoming, upcomingDays, today,
 * quests, hasNews, hasFactions, hasUpcoming, newsCount, factionCount, clockSet }`, only what {{user}} knows.
 */
export function worldView(state, args, tools) {
    const query = queryOf(tools);
    const calendar = calendarFrom(query);
    const now = nowFrom(query, state);
    const hidden = hiddenNames(state);
    const days = upcomingDaysOf(tools);
    const news = knownNews(state, tools, { hidden, calendar, now });
    const factions = knownFactions(state, tools, { hidden, news });
    const upcoming = knownUpcoming(state, tools, { calendar, now, days });
    return {
        here: hereView(state, args, tools),
        news: news.slice(0, NEWS_SHOWN),
        factions: factions.slice(0, FACTIONS_SHOWN),
        upcoming: upcoming.slice(0, UPCOMING_SHOWN),
        upcomingDays: days,
        // The open quests that name a place, for the map's place sheets.
        quests: placeQuests(state, tools, { hidden }),
        today: dateText(calendar, now),
        // The story time and date apart, for Here's "◷ time · date" ('' while the clock is not set).
        date: dateText(calendar, now, { time: false }),
        time: clockText(calendar, now),
        clockSet: isInt(now),
        hasNews: news.length > 0,
        hasFactions: factions.length > 0,
        hasUpcoming: upcoming.length > 0,
        newsCount: news.length,
        factionCount: factions.length,
    };
}
