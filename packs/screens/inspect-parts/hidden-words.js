// One reply's Inspector view with the join words and every unopened hidden note replaced by "(hidden)".

import { normalizeSecrets } from '../../../modules/people/meters/npc-meters.js';

const HIDDEN = '(hidden)';
const PART_MIN = 12;   // shorter words are replaced only where they are a whole value, so ordinary text is not cut up

const isObject = value => value !== null && typeof value === 'object';
const segmentsOf = path => String(path ?? '').split('/').slice(1);

/** The ids of every opened note in a state (`bonds` keeps them; an id is made from the note's rule and text). */
const openedIn = state => new Set(Object.values(state?.domains?.people?.bonds?.npcs ?? {}).flatMap(record => (Array.isArray(record?.unlocked) ? record.unlocked : [])));

// Every place the words are stored: `…/castFrom/join` and a note at `…/secrets/<n>` (whole, or its `text` alone as one op writes it).
function collect(value, path, found) {
    const [third, second, last] = [path.at(-3), path.at(-2), path.at(-1)];
    if (typeof value === 'string') {
        if (second === 'castFrom' && last === 'join') found.joins.add(value);
        if (third === 'secrets' && last === 'text') found.leaves.add(value);
        return;
    }
    if (!isObject(value)) return;
    const note = second === 'secrets' && typeof value.text === 'string';
    if (note) found.notes.push({ text: value.text, id: normalizeSecrets([value])[0]?.id ?? value.id });
    for (const [key, child] of Object.entries(value)) if (!(note && key === 'text')) collect(child, [...path, key], found);
}

// The redactor for one side of the reply: what is still unopened there. A value with nothing to hide is returned as it is.
function redactorFor(found, opened) {
    const shown = new Set(found.notes.filter(note => opened.has(note.id)).map(note => note.text));
    const words = new Set([
        ...found.joins,
        ...found.notes.filter(note => !opened.has(note.id)).map(note => note.text),
        ...[...found.leaves].filter(text => !shown.has(text)),
    ].filter(text => text.trim()));
    const long = [...words].filter(text => text.length >= PART_MIN).sort((a, b) => b.length - a.length);
    const clean = value => {
        if (typeof value === 'string') return words.has(value) ? HIDDEN : long.reduce((text, hidden) => text.split(hidden).join(HIDDEN), value);
        if (!isObject(value)) return value;
        let changed = false;
        const entries = Object.entries(value).map(([key, child]) => {
            const next = clean(child);
            if (next !== child) changed = true;
            return [key, next];
        });
        if (!changed) return value;
        return Array.isArray(value) ? entries.map(entry => entry[1]) : Object.fromEntries(entries);
    };
    return clean;
}

/**
 * `view` is inspectReply's answer before it is shown: `{ state, before, diff, ops, receipts, problems, … }`. Returns it with the
 * hidden words out of all six; the state and the added or new values follow what is opened at this reply, the old ones what was
 * opened before it. The stored state is not touched.
 */
export function hideWords(view) {
    const found = { joins: new Set(), notes: [], leaves: new Set() };
    collect(view.state, [], found);
    collect(view.before, [], found);
    for (const op of view.ops) for (const key of ['value', 'was']) collect(op?.[key], segmentsOf(op?.path), found);
    for (const entry of view.diff.entries) for (const key of ['before', 'after']) collect(entry[key], segmentsOf(entry.path), found);
    const now = redactorFor(found, openedIn(view.state));
    const then = redactorFor(found, openedIn(view.before));
    return {
        ...view,
        state: now(view.state),
        before: then(view.before),
        diff: {
            ...view.diff,
            entries: view.diff.entries.map(entry => ({ ...entry, before: then(entry.before), after: now(entry.after) })),
        },
        ops: view.ops.map(op => (op && 'was' in op ? { ...now(op), was: then(op.was) } : now(op))),
        receipts: now(view.receipts),
        problems: now(view.problems),
    };
}
