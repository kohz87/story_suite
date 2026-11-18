// The narrator's `away` lines: `+ away Ren — scouting the north road | back: <date>` (they leave; `~` changes what they do or when they
// are due back), `! away Ren — reached Wolfmere Outpost` (news on the way; `back:` may move the date), `- away Ren` (they are back).
// Anyone may be away, followed or not. A line reads only this domain, the story clock and the calendar, so a Re-read gives the same answer.

import { calendarFrom } from '../../world/world/known.js';
import { idFrom } from '../../world/writes.js';
import { LIMITS, tables } from './away-domain.js';
import { cutPoints, keyOf, lineText, recordPath } from './away-text.js';
import { dateText, nowOf, readBack } from './away-time.js';

const BACK_LABELS = ['back', 'return', 'returns', 'returning', 'until', 'due'];
const revOf = ctx => (Number.isSafeInteger(ctx?.rev) ? ctx.rev : 0);
const queryOf = ctx => (typeof ctx?.query === 'function' ? (name, args) => ctx.query(name, args) : null);
const asText = value => (typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value));
const summaryOf = (name, away, calendar) => {
    const back = dateText(calendar, away.back);
    return `Away: ${name}${away.doing ? `, ${away.doing}` : ''}${back ? `, back ${back}` : ''}.`;
};

// They are back: the absence is marked ended inside its own record (`home`), kept for NPC State's "While away"; the oldest ended ones beyond
// LIMITS.home go whole.
function cameBack(ctx, draft, key, existing, now) {
    existing.home = now;
    existing.rev = revOf(ctx);
    const ended = Object.entries(draft.away).filter(([, record]) => Object.hasOwn(record, 'home')).sort(([a, x], [b, y]) => x.rev - y.rev || (a < b ? -1 : 1)).map(([id]) => id);
    for (const id of ended.slice(0, Math.max(0, ended.length - LIMITS.home))) delete draft.away[id];
    return { summary: `Back: ${existing.name}${existing.doing ? ` from ${existing.doing}` : ''}.`, narrate: false, data: { person: key, back: true } };
}

/** `apply(ctx, line)` for `away` lines. */
export function applyAwayLine(ctx, line) {
    const op = line?.op;
    if (!['+', '~', '!', '-'].includes(op)) return ctx.fail('INVALID', `"${lineText(line)}": away lines use +, ~, ! or -.`);
    const name = cutPoints(line?.name, LIMITS.name);
    const key = keyOf(name);
    if (!key) return ctx.fail('INVALID', `"${lineText(line)}" names nobody.`);
    const draft = ctx.draft('away');
    const open = tables(draft).away[key]?.id ?? null;
    // Every change inside an open absence is marked: passed over on replay when the reply that began it was deleted.
    if (open) ctx.ifThere('away', recordPath('away', open));
    const existing = open ? draft.away[open] : null;
    const now = nowOf(ctx);
    if (op === '-') return existing ? cameBack(ctx, draft, key, existing, now) : ctx.fail('NOT_FOUND', `${name} is not away.`);

    const labels = line?.labels && typeof line.labels === 'object' ? line.labels : {};
    const calendar = calendarFrom(queryOf(ctx));
    const text = cutPoints(asText(line?.text), op === '!' ? LIMITS.step : LIMITS.doing);
    const backLabel = BACK_LABELS.map(label => labels[label]).find(value => value !== undefined);
    let back;
    let problem = '';
    if (backLabel !== undefined) {
        const read = readBack(calendar, backLabel, now);
        if (read.error) problem = `${existing?.name ?? name}: ${read.error} The return date was left as it was.`;
        else back = read.back;
    }
    const withProblem = result => (problem ? { ...result, problem } : result);

    if (op === '!') {
        if (!existing) return ctx.fail('NOT_FOUND', `${name} is not away, so there is no news to add.`);
        if (!text) return ctx.fail('INVALID', `"${lineText(line)}" says nothing happened; write ! away ${existing.name} — where they got to.`);
        const moved = back !== undefined && back !== existing.back;
        if (back !== undefined) existing.back = back;
        if (existing.steps.at(-1)?.text === text) {
            if (moved) existing.rev = revOf(ctx);
            return withProblem({ summary: `Away: ${existing.name} is unchanged.`, narrate: false, data: { person: key } });
        }
        existing.steps.push({ date: now, text });
        if (existing.steps.length > LIMITS.steps) existing.steps.splice(0, existing.steps.length - LIMITS.steps);
        existing.rev = revOf(ctx);
        return withProblem({ summary: `Away: ${existing.name}, ${text}.`, narrate: false, data: { person: key, step: true } });
    }

    // + and ~: they go away, or what they do and when they are due back changes.
    if (!existing) {
        const away = { name, doing: text, since: now, back: back ?? null, steps: [], rev: revOf(ctx) };
        draft.away[idFrom(ctx, 'aw', draft.away)] = away;
        return withProblem({ summary: summaryOf(name, away, calendar), narrate: false, data: { person: key, away: true } });
    }
    const changed = (text && text !== existing.doing) || (back !== undefined && back !== existing.back);
    if (text) existing.doing = text;
    if (back !== undefined) existing.back = back;
    if (changed) existing.rev = revOf(ctx);
    return withProblem({ summary: changed ? summaryOf(existing.name, existing, calendar) : `Away: ${existing.name} is unchanged.`, narrate: false, data: { person: key } });
}

/** `apply` for the retired `key` lines (`- key Name | died`, from before B4-9): read and dropped quietly, no change and no Problem. */
export const dropKeyLine = () => ({ summary: '', narrate: false, data: { dropped: true } });
