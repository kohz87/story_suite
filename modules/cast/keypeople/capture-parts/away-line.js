// Story Director v2, part **keypeople**: applies the story's `away` lines (a key person leaves, takes a step, comes back).

import { MAX_DOING, MAX_STEP, MAX_STEPS, awayOf, cleanName, cutPoints, findPin, isRecord, keyOf } from '../domain.js';
import { calendarFrom, dateText, readBack } from '../time.js';
import { addNote } from './notes.js';
import { asText, nowOf, query, revOf } from './shared-ctx.js';
import { awayPath, lineText } from './shared-text.js';

const labelOf = (labels, names) => names.map(name => labels[name]).find(value => value !== undefined);

function awaySummary(name, away, calendar) {
    const back = dateText(calendar, away.back);
    return `Key person: ${name} is away${away.doing ? `, ${away.doing}` : ''}${back ? `, back ${back}` : ''}.`;
}

/** `apply(ctx, line)` for `away` lines. */
export function applyAwayLine(ctx, line) {
    const op = line?.op;
    if (!['+', '~', '!', '-'].includes(op)) return ctx.fail('INVALID', `"${lineText(line)}": away lines use +, ~, ! or -.`);
    const name = cleanName(line?.name);
    if (!keyOf(name)) return ctx.fail('INVALID', `"${lineText(line)}" names nobody.`);
    const kp = ctx.draft('keypeople');
    const found = findPin(kp, name);
    if (!found) return ctx.fail('NOT_FOUND', `${name} is not a key person, so cannot be away (only a pinned person can be; the reader pins them on the World screen).`);
    const { key, pin } = found;
    const labels = isRecord(line?.labels) ? line.labels : {};
    const now = nowOf(ctx);
    const calendar = calendarFrom(query(ctx));
    const text = cutPoints(asText(line?.text), op === '!' ? MAX_STEP : MAX_DOING);
    const backLabel = labelOf(labels, ['back', 'return', 'returns', 'returning', 'until', 'due']);
    let back;
    let problem = '';
    if (backLabel !== undefined && op !== '-') {
        const read = readBack(calendar, backLabel, now);
        if (read.error) problem = `${pin.name}: ${read.error} The return date was left as it was.`;
        else back = read.back;
    }
    const existing = awayOf(kp, key);

    if (op === '-') {
        if (!existing) return ctx.fail('NOT_FOUND', `${pin.name} is not away.`);
        ctx.ifThere('keypeople', awayPath(key));
        const left = dateText(calendar, existing.since);
        const here = dateText(calendar, now);
        const span = left && here ? (left === here ? `away ${left}` : `away ${left} – ${here}`) : left ? `away since ${left}` : 'away';
        delete kp.away[key];
        addNote(ctx, kp, { kind: 'back', name: pin.name, head: `${pin.name} is back`, rest: `${existing.doing ? `from ${existing.doing} ` : ''}(key person, ${span}).` });
        return { summary: `Key person: ${pin.name} is back${existing.doing ? ` from ${existing.doing}` : ''}.`, narrate: false, data: { person: key, back: true } };
    }

    if (op === '!') {
        if (!existing) return ctx.fail('NOT_FOUND', `${pin.name} is not away, so there is no step to add.`);
        if (!text) return ctx.fail('INVALID', `"${lineText(line)}" says nothing happened; write ! away ${pin.name} — where they got to.`);
        ctx.ifThere('keypeople', awayPath(key));
        const away = kp.away[key];
        const last = away.steps.at(-1);
        const moved = back !== undefined && back !== away.back;
        if (back !== undefined) away.back = back;
        if (last && last.text === text) {
            if (moved) away.rev = revOf(ctx);
            return { summary: `Key person: ${pin.name} is unchanged.`, narrate: false, data: { person: key }, ...(problem ? { problem } : {}) };
        }
        away.steps.push({ date: now, text });
        if (away.steps.length > MAX_STEPS) away.steps.splice(0, away.steps.length - MAX_STEPS);
        away.rev = revOf(ctx);
        return { summary: `Key person: ${pin.name}, ${text}.`, narrate: false, data: { person: key, step: true }, ...(problem ? { problem } : {}) };
    }

    // + and ~: they go away, or what they do and when they are due back changes.
    if (!existing) {
        const away = { name: pin.name, doing: text, since: now, back: back ?? null, steps: [], rev: revOf(ctx) };
        kp.away[key] = away;
        return { summary: awaySummary(pin.name, away, calendar), narrate: false, data: { person: key, away: true }, ...(problem ? { problem } : {}) };
    }
    ctx.ifThere('keypeople', awayPath(key));
    const away = kp.away[key];
    const changed = (text && text !== away.doing) || (back !== undefined && back !== away.back);
    if (text) away.doing = text;
    if (back !== undefined) away.back = back;
    if (changed) away.rev = revOf(ctx);
    return { summary: changed ? awaySummary(pin.name, away, calendar) : `Key person: ${pin.name} is unchanged.`, narrate: false, data: { person: key }, ...(problem ? { problem } : {}) };
}
