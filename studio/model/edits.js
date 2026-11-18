// The job: the pure edits. `apply` takes a document and patches and gives a new document, or a refusal and the document untouched.
//
// A patch is { op: 'set', path, value } (a field, or a new key at the end of an object) | { op: 'insert', path: [...array, index], value }
// (index 0..length) | { op: 'remove', path } (an object key or an array item) | { op: 'move', path: [...array, index], to } (to an index
// in the same array). A path is a list of keys and indexes below the pack's top. All patches go in or none do; the next one sees the
// result of the one before. Values are copied in, so a caller who changes theirs later changes nothing here.
//
// apply(doc, patches) → { ok: true, doc } | { ok: false, refusal }.
// setPortrait(doc, name, bytes | null) → the same, for the portrait step: bytes adds or replaces the image named, null removes it.
// A portrait never changes pack.json's text.

import { cloneJson, deepFreeze, derive } from './doc.js';

const refuse = refusal => ({ ok: false, refusal });
const BAD_KEY = new Set(['__proto__', 'constructor', 'prototype']);
const isIndex = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;
const jsonSafe = value => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value)) return value.every(jsonSafe);
    return typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype && Object.entries(value).every(([key, item]) => !BAD_KEY.has(key) && jsonSafe(item));
};

const copy = node => (Array.isArray(node) ? [...node] : { ...node });

// Edits `root` along `path` on copies (the rest is shared), calling `leaf(parentCopy, lastKey)`; a string back is a refusal.
function change(root, path, leaf) {
    if (!Array.isArray(path) || !path.length) return 'The edit has no path.';
    const top = copy(root);
    let node = top;
    for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        const next = node[key];
        if (next === null || typeof next !== 'object' || BAD_KEY.has(key) || !Object.hasOwn(node, key)) return `There is nothing at ${path.slice(0, i + 1).join('.')}.`;
        node = node[key] = copy(next);
    }
    const problem = leaf(node, path[path.length - 1], path);
    return problem ?? top;
}

const step = {
    set: (patch, parent, key) => {
        if (patch.value === undefined || !jsonSafe(patch.value)) return 'That value is not plain JSON.';
        if (Array.isArray(parent) ? !isIndex(key, parent.length - 1) : typeof key !== 'string' || BAD_KEY.has(key)) return `Cannot set ${key}.`;
        parent[key] = cloneJson(patch.value);
    },
    insert: (patch, parent, key) => {
        if (!Array.isArray(parent) || !isIndex(key, parent.length)) return `Cannot insert at ${key}: the place is not in a list.`;
        if (patch.value === undefined || !jsonSafe(patch.value)) return 'That value is not plain JSON.';
        parent.splice(key, 0, cloneJson(patch.value));
    },
    remove: (patch, parent, key) => {
        if (Array.isArray(parent) ? !isIndex(key, parent.length - 1) : !Object.hasOwn(parent, key)) return `There is nothing at ${key} to remove.`;
        if (Array.isArray(parent)) parent.splice(key, 1);
        else delete parent[key];
    },
    move: (patch, parent, key) => {
        if (!Array.isArray(parent) || !isIndex(key, parent.length - 1) || !isIndex(patch.to, parent.length - 1)) return `Cannot move ${key} to ${patch.to}.`;
        parent.splice(patch.to, 0, ...parent.splice(key, 1));
    },
};

export function apply(doc, patches) {
    if (!doc?.doc || typeof doc.doc !== 'object') return refuse('There is no pack open to change.');
    if (!Array.isArray(patches) || !patches.length) return refuse('There is nothing to change.');
    let root = doc.doc;
    for (const patch of patches) {
        if (!patch || !Object.hasOwn(step, patch.op)) return refuse(`"${patch?.op}" is not an edit.`);
        const result = change(root, patch.path, (parent, key) => step[patch.op](patch, parent, key));
        if (typeof result === 'string') return refuse(result);
        root = result;
    }
    return { ok: true, doc: derive(doc, { doc: deepFreeze(root) }) };
}

export function setPortrait(doc, name, bytes) {
    if (typeof name !== 'string' || !name || /[\\/]/.test(name) || name.startsWith('.')) return refuse('A portrait needs a plain file name.');
    const held = doc.portraits.some(file => file.name === name);
    if (bytes === null) {
        if (!held) return refuse(`There is no portrait named ${name}.`);
        return { ok: true, doc: derive(doc, { portraits: doc.portraits.filter(file => file.name !== name) }) };
    }
    if (!(bytes instanceof Uint8Array) || !bytes.length) return refuse('A portrait needs its image bytes.');
    const next = held ? doc.portraits.map(file => (file.name === name ? { name, bytes } : file)) : [...doc.portraits, { name, bytes }];
    return { ok: true, doc: derive(doc, { portraits: next }) };
}
