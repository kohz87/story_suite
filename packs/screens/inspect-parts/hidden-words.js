// One reply's Inspector view with the join words and every unopened hidden note replaced by "(hidden)".

import { findNpcKey, normalizeSecrets } from '../../../modules/people/meters/npc-meters.js';

const HIDDEN = '(hidden)';
const PART_MIN = 12;   // shorter words are replaced only where they are a whole value, so ordinary text is not cut up

const isObject = value => value !== null && typeof value === 'object';
// What a locked note may not show: NPC State's own screens hide its title and what opens it too (`packId` is the pack's id for it).
const NOTE_WORDS = ['text', 'title', 'when', 'gate', 'packId'];
const segmentsOf = path => String(path ?? '').split('/').slice(1);

const noteId = note => normalizeSecrets([note])[0]?.id ?? note.id;
const dossierOf = (state, owner) => state?.domains?.people?.npcs?.[owner];

/** Whether `owner`'s note `id` is opened in a state. Two people's notes may share an id, so only the owner's own record counts (found by id, else name, as NPC State does). */
function isOpened(state, owner, id) {
    const bonds = state?.domains?.people?.bonds?.npcs ?? {};
    const dossier = dossierOf(state, owner);
    const key = findNpcKey(bonds, [owner, dossier?.name, ...(Array.isArray(dossier?.aliases) ? dossier.aliases : [])]);
    return Array.isArray(bonds[key]?.unlocked) && bonds[key].unlocked.includes(id);
}

// Whether the value at `path` is an opened note in its owner's own dossier (`…/<owner>/secrets/<n>`), or one of that note's words.
function openPlace(value, path, state) {
    const at = path.lastIndexOf('secrets');
    if (at < 1) return false;
    const owner = path[at - 1];
    if (path.length === at + 2) return isObject(value) && isOpened(state, owner, noteId(value));
    if (path.length !== at + 3) return false;
    const note = dossierOf(state, owner)?.secrets?.[path[at + 1]];
    return isObject(note) && note[path[at + 2]] === value && isOpened(state, owner, noteId(note));
}

// Every place the words are stored: `…/castFrom/join` and a note at `…/secrets/<n>` (whole, or one of its words as an op writes it).
function collect(value, path, found) {
    const [third, second, last] = [path.at(-3), path.at(-2), path.at(-1)];
    if (typeof value === 'string') {
        if (second === 'castFrom' && last === 'join') found.joins.add(value);
        if (third === 'secrets' && NOTE_WORDS.includes(last)) found.leaves.add(value);
        return;
    }
    if (!isObject(value)) return;
    const note = second === 'secrets' && typeof value.text === 'string';
    const words = note ? NOTE_WORDS.filter(key => typeof value[key] === 'string') : [];
    if (note) found.notes.push({ words: words.map(key => value[key]), id: noteId(value), owner: path.at(-3) });
    for (const [key, child] of Object.entries(value)) if (!words.includes(key)) collect(child, [...path, key], found);
}

// The redactor for one side of the reply: what is still unopened in its `state`. A value with nothing to hide is returned as it is.
function redactorFor(found, state) {
    const opened = note => isOpened(state, note.owner, note.id);
    const shown = new Set(found.notes.filter(opened).flatMap(note => note.words));
    const words = new Set([
        ...found.joins,
        ...found.notes.filter(note => !opened(note)).flatMap(note => note.words),
        ...[...found.leaves].filter(text => !shown.has(text)),
    ].filter(text => text.trim()));
    const long = [...words].filter(text => text.length >= PART_MIN).sort((a, b) => b.length - a.length);
    const clean = (value, path = []) => {
        if (openPlace(value, path, state)) return value;
        if (typeof value === 'string') return words.has(value) ? HIDDEN : long.reduce((text, hidden) => text.split(hidden).join(HIDDEN), value);
        if (!isObject(value)) return value;
        let changed = false;
        const entries = Object.entries(value).map(([key, child]) => {
            const next = clean(child, [...path, key]);
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
    const now = redactorFor(found, view.state);
    const then = redactorFor(found, view.before);
    const op = item => {
        const path = segmentsOf(item?.path);
        const out = {};
        for (const [key, child] of Object.entries(item ?? {})) out[key] = key === 'value' ? now(child, path) : key === 'was' ? then(child, path) : now(child);
        return isObject(item) ? out : now(item);
    };
    return {
        ...view,
        state: now(view.state),
        before: then(view.before),
        diff: {
            ...view.diff,
            entries: view.diff.entries.map(entry => ({ ...entry, before: then(entry.before, segmentsOf(entry.path)), after: now(entry.after, segmentsOf(entry.path)) })),
        },
        ops: view.ops.map(op),
        receipts: now(view.receipts),
        problems: now(view.problems),
    };
}
