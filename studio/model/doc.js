// The job: the Studio's document, the one thing every edit, undo and draft passes around.
//
// A document is a frozen `{ text, doc, portraits }`: `doc` is the author's parsed pack.json (never normalized, key order as written),
// `text` is what Export writes (the author's own text until the first edit, then 2-space JSON), `portraits` are `[{ name, bytes }]` in
// the order held. Frozen all the way down, except the image bytes, which are shared and never changed. The same shape is what the
// draft store saves and what the shell hands to `openDoc`, so a reloaded draft opens as the document it was.
//
// openDoc({ text?, doc?, portraits? }) → a document; with no `doc` it is parsed from `text`, with no `text` it is written from `doc`.
// derive(prev, { doc?, portraits? }) → the next document: a changed `doc` is written as 2-space JSON, and if only the portraits
// change the text stays as it was. deepFreeze(value) freezes a plain JSON value; cloneJson(value) copies one.

export function deepFreeze(value) {
    if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    return Object.freeze(value);
}

export const cloneJson = value => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

const portraitList = list => Object.freeze((list ?? []).map(file => Object.freeze({ name: file.name, bytes: file.bytes })));

function parse(text) {
    try {
        return JSON.parse(String(text).replace(/^﻿/, ''));
    } catch {
        return null;
    }
}

export function openDoc({ text, doc, portraits } = {}) {
    const data = doc !== undefined ? cloneJson(doc) : parse(text ?? '');
    const written = typeof text === 'string' ? text : JSON.stringify(data, null, 2);
    return Object.freeze({ text: written, doc: deepFreeze(data), portraits: portraitList(portraits) });
}

export function derive(prev, { doc, portraits } = {}) {
    const next = doc === undefined ? prev.doc : deepFreeze(doc);
    return Object.freeze({
        text: next === prev.doc ? prev.text : JSON.stringify(next, null, 2),
        doc: next,
        portraits: portraits === undefined ? prev.portraits : portraitList(portraits),
    });
}
