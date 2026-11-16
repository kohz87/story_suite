// Story Director v2, journal: the Journal view (all days, newest first) and one day's whole event list.

import { calendarFrom, hiddenNames, namesHidden, nowFrom, queryOf, tryQuery } from '../known.js';
import { isRecord, isInt, list } from './shared-helpers.js';
import { pending } from './pending.js';
import { knownDay } from './day.js';

/**
 * `director.journal` → `{ on, days: [day], hasDays, count, today }`: `on` is false while the day digest is
 * off (Features), and then there are no days. Each day: `{ day, date, today, brief, short, facts, happened,
 * more, world, met, npcs, has…, search }` (knownDay), newest first, today's first when it has anything.
 */
export function journalView(state, _args, tools) {
    const query = queryOf(tools);
    const board = tryQuery(query, 'chronicle.dayBoard', {}, null);
    if (!isRecord(board) || !Array.isArray(board.days)) return { on: false, days: [], hasDays: false, count: 0, today: '' };
    const calendar = calendarFrom(query);
    const now = nowFrom(query, state);
    const hidden = hiddenNames(state);
    const days = board.days.filter(isRecord);
    const open = pending(state, tools, { calendar, now, written: new Set(days.map(day => day.day)) });
    const threads = new Map(Object.entries(isRecord(state?.domains?.director?.threads) ? state.domains.director.threads : {}).filter(([, thread]) => isRecord(thread)));
    const format = minutes => { try { return calendar.format(minutes, { time: false }); } catch { return ''; } };
    const out = [...open, ...days].sort((a, b) => b.day - a.day).map(day => knownDay(day, hidden, { now, threads, format }));
    return { on: true, days: out, hasDays: out.length > 0, count: out.length, today: String(board.today ?? '') };
}

/**
 * `director.journal.events { day }` → `{ day, events: [text] }`: that day's whole list of events (the Journal's "Show all N events"), loaded
 * on tap from the chat's receipts (`chronicle.dayEvents`), with what {{user}} must not know left out as the Journal leaves it out. Null for a bad day.
 */
export function journalEvents(state, { day } = {}, tools) {
    const wanted = typeof day === 'string' && day.trim() !== '' ? Number(day) : day;
    if (!isInt(wanted)) return null;
    const got = tryQuery(queryOf(tools), 'chronicle.dayEvents', { day: wanted }, null);
    const hidden = hiddenNames(state);
    return { day: wanted, events: list(got?.events).filter(line => !namesHidden(line, hidden.words)) };
}
