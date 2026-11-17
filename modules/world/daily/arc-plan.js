// World events, generated arcs (spec §5): the Director's answer for an open slot with the arc plan inside it, checked as a whole when it is
// written. The opening happening (name, summary, effects) is step 1 and is checked as any open answer; `arc.steps` lists the later steps
// (the template's `arc.steps` [low, high] counts the opening too), `arc.ending` the last one. Every step is checked against the template's
// menu and guards (open-check.js); `after` (days until its window opens, counted from the previous step) and `within` (the window's length)
// are whole days. The plan that comes back is the one canon copy; its steps are checked again when they fire. Pure on `ws`.

import { checkOpen } from './open-check.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const whole = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;
const MAX_TEXT = 300;

/** A copy of an answer with every text cut to a size, so a stored plan is always whole JSON (never cut mid-way). */
export function clipAnswer(value) {
    if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
    if (Array.isArray(value)) return value.slice(0, 12).map(clipAnswer);
    if (isRecord(value)) return Object.fromEntries(Object.entries(value).slice(0, 12).map(([key, item]) => [key.slice(0, 60), clipAnswer(item)]));
    return value;
}

function stepOf(ws, def, bind, raw, day, label, errors) {
    const row = isRecord(raw) ? raw : {};
    const checked = checkOpen(ws, def, bind, row, day);
    for (const error of checked.errors) errors.push(`${label}: ${error}`);
    if (!whole(row.after, 1, 90) || !whole(row.within, 1, 60)) errors.push(`${label}: "after" (1-90) and "within" (1-60) are whole days.`);
    return { name: checked.name, summary: checked.summary, people: checked.people, effects: isRecord(row.effects) ? row.effects : {}, after: row.after, within: row.within, major: row.severity === 'major' };
}

/**
 * `checkAnswer(ws, def, bind, answer, day)` → what `checkOpen` returns, plus `plan` ({ major, steps: [..., ending last] }) when the answer carries
 * a valid arc for a template that allows one. A template with no `arc` ignores an `arc` key (nothing changes); an invalid plan is an error
 * (the one retry, then the fallback). No `arc` key: a plain open result.
 */
export function checkAnswer(ws, def, bind, answer, day) {
    const checked = checkOpen(ws, def, bind, answer, day);
    const arc = answer?.arc;
    if (!def.open.arc || arc === undefined || arc === null) return checked;
    const errors = [...checked.errors];
    const [low, high] = def.open.arc.steps;
    const later = isRecord(arc) && Array.isArray(arc.steps) ? arc.steps : null;
    if (!later || !isRecord(arc.ending)) errors.push('arc must be { "steps": [...], "ending": {...} }.');
    else if (later.length + 1 < low || later.length + 1 > high) errors.push(`The arc has ${low} to ${high} steps counting the opening happening, so arc.steps lists ${low - 1} to ${high - 1}.`);
    if (errors.length > checked.errors.length) return { ...checked, errors: [...new Set(errors)].slice(0, 10) };
    const steps = later.map((raw, index) => stepOf(ws, def, bind, raw, day, `arc step ${index + 2}`, errors));
    steps.push({ ...stepOf(ws, def, bind, arc.ending, day, 'arc ending', errors), ending: true });
    const all = [...new Set(errors)].slice(0, 10);
    return { ...checked, errors: all, ...(all.length ? {} : { plan: { major: steps.some(step => step.major), steps } }) };
}
