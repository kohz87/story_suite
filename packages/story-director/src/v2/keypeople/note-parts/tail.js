// Story Director v2, part **keypeople**: the context tail for a view (`context.tail`).

import { isInt, tables } from '../domain.js';
import { calendarFrom } from '../time.js';
import { keyTail } from './lines.js';
import { keyPeopleOn, tokensOf } from './settings.js';

/** `context.tail(view)` → `{ lines, optional }` (SPEC §5). */
export function tail(view) {
    if (!keyPeopleOn(view)) return { lines: [], optional: [] };
    const slice = view?.state?.domains?.keypeople;
    if (!slice || !Object.keys(tables(slice).away).length) return { lines: [], optional: [] };
    let settings = {};
    try { settings = typeof view?.settings === 'function' ? view.settings() ?? {} : {}; } catch { settings = {}; }
    const minutes = view?.state?.domains?.director?.time?.minutes;
    const calendar = calendarFrom(typeof view?.query === 'function' ? (name, args) => view.query(name, args) : null);
    const out = keyTail(slice, { now: isInt(minutes) ? minutes : null, calendar, budget: tokensOf(settings) });
    return { lines: out.lines, optional: [] };
}
