// Story Director v2, journal: one story day as a few lines for other modules (the contract's journal.day).

import { boardDay } from '../../chronicle/queries.js';
import { digestOut, orderedDays } from '../../chronicle/days.js';
import { calendarFrom, hiddenNames, namesHidden, nowFrom, queryOf, tryQuery } from '../known.js';
import { isRecord, isInt, list, substituteOf } from './shared-helpers.js';
import { pending } from './pending.js';
import { knownDay } from './day.js';

const LINES = 12;
const LINE = 240;
const oneLine = value => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, LINE);

/** The lines a known day gives, newest facts first as the Journal reads them: its line, the facts, what happened, the news, who was met. */
function linesOf(entry) {
    const out = [];
    if (entry.short) out.push(entry.short);
    out.push(...list(entry.facts), ...list(entry.happened).slice(0, 8), ...list(entry.world));
    if (list(entry.met).length) out.push(`Met: ${list(entry.met).join(', ')}`);
    out.push(...list(entry.npcs));
    return [...new Set(out.map(oneLine).filter(Boolean))].slice(0, LINES);
}

/**
 * `journal.day({ day, snapshot? }) -> { day, title, lines, source: 'digest' | 'facts' | 'snapshot', missing }` (contract §3): one story day
 * for a module that wants its recap (for example, a save point). It works whether or not the Journal screen or the
 * day digest is on: the visible digest first, else the visible facts of the day (the receipts the digest would be written from), else the
 * saved visible scene of `snapshot`. At most twelve lines of 240 characters; what {{user}} must not know (a secret, an arc) is left
 * out as the Journal leaves it out, and no hidden event is recapped. A day with none of these is `missing: true`, titled `Day <day>`, with
 * the saved scene's line or `[]`. Null for a day that is not a whole number of the contract's `Day` (floor(minutes / 1440); the story clock may be
 * negative, so a day before the first is a day).
 */
const DAY_MIN = -6254999482460;
const DAY_MAX = 6254999482459;

export function journalDay(state, { day, snapshot = null } = {}, tools) {
    if (!isInt(day) || day < DAY_MIN || day > DAY_MAX) return null;
    const query = queryOf(tools);
    const calendar = calendarFrom(query);
    const now = nowFrom(query, state);
    const hidden = hiddenNames(state);
    const currency = tryQuery(query, 'inventory.currency', {}, null);
    const title = date => (date ? `Day ${day} · ${date}` : `Day ${day}`).slice(0, 80);
    const digest = orderedDays(state?.domains?.chronicle, { state, currency }).find(item => item.day === day);
    if (digest) {
        const entry = knownDay(boardDay(digestOut(digest, { currency, substitute: substituteOf(tools) })), hidden);
        const lines = linesOf(entry);
        if (lines.length) return { day, title: title(entry.date), lines, source: 'digest', missing: false };
    }
    const facts = pending(state, tools, { calendar, now, written: new Set() }).find(item => item.day === day);
    if (facts) {
        const entry = knownDay(facts, hidden);
        const lines = linesOf(entry);
        if (lines.length) return { day, title: title(entry.date), lines, source: 'facts', missing: false };
    }
    // The saved visible scene of a save point: its own journal for the day, else its scene's line.
    const point = typeof snapshot === 'string' && snapshot ? (tryQuery(query, 'savepoint.list', {}, []) ?? []).find(item => isRecord(item) && item.id === snapshot) : null;
    const saved = list(point?.journal?.day === day ? point.journal.lines : []).map(oneLine).filter(line => line && !namesHidden(line, hidden.words) && !namesHidden(line, hidden.behind)).slice(0, LINES);
    if (saved.length) return { day, title: title(''), lines: saved, source: 'snapshot', missing: false };
    const scene = oneLine(point?.scene?.text);
    const visible = scene && !namesHidden(scene, hidden.words) && !namesHidden(scene, hidden.behind) ? [scene] : [];
    return { day, title: `Day ${day}`, lines: visible, source: 'snapshot', missing: true };
}
