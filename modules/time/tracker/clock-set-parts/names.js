// Story Director v2, tracker part: the quiet Problem for a real-world day or month name in a custom calendar's story.

import { calendarOf, packCalendarOf, settingsFrom } from '../time.js';
import { addProblem } from '../domain.js';
import { foreignNames, hasNoWeek } from '../calendar-settings.js';
import { fail } from './shared-guards.js';

// ---- A real-world day or month name in a custom calendar's story: one quiet Problem (not a refusal; the reply stands) ----

export const CALENDAR_NAMES = 'director.calendarNames';
const MARKUP = /<!--[\s\S]*?-->|<(think|thinking|reasoning|Changes|Changes-assist|Changes-assist-next)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

/**
 * `afterCapture(view, info)`: the reply's prose (not its change block or hidden notes) names a Monday-Sunday or January-December
 * day or month in a story on a custom calendar without weekdays → one `director.calendarNames { names }` step on the reply.
 */
export function calendarNamesHook(view, info = {}) {
    if (!Number.isSafeInteger(info?.index)) return undefined;
    const calendar = calendarOf(settingsFrom(typeof view?.settings === 'function' ? view.settings() : view?.settings), packCalendarOf(view?.query));
    if (!hasNoWeek(calendar)) return undefined;
    const chat = typeof view?.story?.chat === 'function' ? view.story.chat() : null;
    const mes = Array.isArray(chat) ? chat[info.index]?.mes : null;
    if (typeof mes !== 'string') return undefined;
    const names = foreignNames(mes.replace(MARKUP, ' '), calendar);
    return names.length ? { commands: [{ type: CALENDAR_NAMES, payload: { names: names.slice(0, 5) } }] } : undefined;
}

/** `director.calendarNames { names }` (cause `system`): one Problem naming the words, so the reader sees it. */
export function calendarNamesCommand(ctx, payload) {
    const names = Array.isArray(payload?.names) ? payload.names.filter(name => typeof name === 'string').slice(0, 5) : [];
    if (ctx.cause !== 'system' || !names.length) fail(ctx, 'INVALID', 'director.calendarNames takes { names } from the story.');
    addProblem(ctx.draft('director'), ctx, { kind: 'calendar-names', severity: 'info', key: names[0], text: `The reply uses the real-world ${names.join(', ')}; this world's calendar has other names.` });
    return { summary: `Calendar names: ${names.join(', ')}`, narrate: false, data: { names } };
}
