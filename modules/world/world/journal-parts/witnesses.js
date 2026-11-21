// Story Director v2, journal: who was there for each earlier-day line, read from the day digests (pure, derived on read, never stored).
//
// `journal.witnesses` → `{ on, days: [{ date, lines: [{ text, who }] }] }`; with `{ name }`, `{ on, name, lines: [{ date, text }] }`: the lines that person was
// present for, newest day first (for the dossier's Past). Off with the switch (default off): `{ on: false, days: [], lines: [] }`. The names are the ones
// knownDay leaves ({{user}} must not know a hidden person), so a hidden person is never a witness.

import { journalView } from './view.js';
import { isRecord, list } from './shared-helpers.js';

/** The feature switch (default off): with it off the Journal and the dossiers are as they were. */
export const WITNESSES = 'story-director.witnesses';

const MAX_LINES = 8;
const LINE_CHARS = 140;
const keyOf = value => String(value ?? '').trim().toLocaleLowerCase();
const cut = text => (text.length > LINE_CHARS ? `${text.slice(0, LINE_CHARS - 1).trimEnd()}…` : text);

/** Whether the switch is on (`tools.feature`); a host without features has it off. */
export function witnessesOn(tools) {
    try { return typeof tools?.feature === 'function' && tools.feature(WITNESSES) === true; } catch { return false; }
}

export function witnessView(state, args, tools) {
    const off = { on: false, days: [], lines: [] };
    if (!witnessesOn(tools)) return off;
    const journal = journalView(state, {}, tools);
    const days = (Array.isArray(journal.days) ? journal.days : []).filter(isRecord).map(day => ({
        date: String(day.date ?? ''),
        lines: list(day.happened).map((text, index) => ({ text: String(text), who: list(day.happenedWho?.[index]).map(String) })),
    })).filter(day => day.date && day.lines.length);
    const name = keyOf(args?.name);
    if (!name) return { on: true, days, lines: [] };
    const lines = days.flatMap(day => day.lines.filter(line => line.who.some(who => keyOf(who) === name)).map(line => ({ date: day.date, text: cut(line.text) })));
    return { on: true, name, days: [], lines: lines.slice(0, MAX_LINES) };
}
