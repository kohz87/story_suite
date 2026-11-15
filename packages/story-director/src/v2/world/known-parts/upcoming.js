// Story Director v2, world: what {{user}} knows is coming (quest due dates, event and hook dates, holidays).

import { threadsOn } from '../../threads.js';
import { dateText } from './clock.js';
import { daysText } from './day-words.js';
import { holidays } from './holidays.js';
import { SUMMARY_POINTS } from './shared-limits.js';
import { queryOf } from './query.js';
import { threadsOf, planned } from './shared-threads.js';
import { isInt, text, cut } from './shared-text.js';

// A thread's date field read on the chat's calendar: { at, inDays } or null.
function dateOf(calendar, when, now) {
    let parsed = null;
    try { parsed = calendar.parse(when, { reference: now }); } catch { parsed = null; }
    if (!parsed || !Number.isFinite(parsed.abs)) return null;
    const at = Math.round(parsed.abs);
    return { at, inDays: calendar.dayIndex(at) - calendar.dayIndex(now) };
}

/**
 * What {{user}} knows is coming within `days` story days: `[{ kind: 'quest' | 'event' | 'hook' | 'holiday',
 * name, field, when, inDays, label, overdue }]`, soonest first (an overdue quest first of all). A quest's
 * `due:`, an event's or hook's `on:` (not one the planner made), and the pack's holidays. Nothing while
 * the story clock is not set.
 */
export function knownUpcoming(state, tools, { calendar, now, days }) {
    if (!isInt(now)) return [];
    const query = queryOf(tools);
    // An event is a thread of the feature `story-director.threads`: off, only quests, hooks and holidays are coming up.
    const kinds = threadsOn(tools) ? ['quest', 'event', 'hook'] : ['quest', 'hook'];
    const out = [];
    for (const thread of threadsOf(state)) {
        const open = thread.status === 'active' && !thread.ended && !thread.offer;
        if (!open || !kinds.includes(thread.kind) || (thread.kind !== 'quest' && planned(thread))) continue;
        const goal = thread.kind === 'quest' || Boolean(thread.acceptance);
        const field = goal ? 'due' : 'on';
        const when = text(thread.fields?.[field]);
        if (!when) continue;
        const date = dateOf(calendar, when, now);
        if (!date || date.inDays > days) continue;
        // A past event or hook date is over; a quest past its due day is overdue.
        if (date.inDays < 0 && !goal) continue;
        const overdue = date.inDays < 0;
        out.push({
            kind: thread.kind, name: cut(thread.key, 80), field, when: dateText(calendar, date.at, { time: false }) || cut(when, 80),
            inDays: date.inDays, label: overdue ? 'overdue' : daysText(date.inDays), overdue,
            goal: goal ? cut(thread.fields?.goal, SUMMARY_POINTS) : '', at: date.at,
        });
    }
    for (const holiday of holidays(query, calendar, now, days)) {
        out.push({ kind: 'holiday', name: holiday.name, field: '', when: dateText(calendar, holiday.at, { time: false }), inDays: holiday.inDays, label: daysText(holiday.inDays), overdue: false, goal: '', at: holiday.at });
    }
    return out.sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.at - b.at || a.name.localeCompare(b.name))
        .map(({ at, ...item }) => item);
}
