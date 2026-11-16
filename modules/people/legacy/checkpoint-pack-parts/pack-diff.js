/* NPC State Delta generating a restricted RFC 6902 patch between two JSON-like images. */
import { PackError } from './pack-constants.js';
import { isObject } from './pack-shared.js';

function jsonImage(value) {
    const text = JSON.stringify(value);
    if (text === undefined) throw new PackError('checkpoint value is not JSON-serializable');
    return JSON.parse(text);
}

function escapeToken(key) {
    return String(key).replace(/~/g, '~0').replace(/\//g, '~1');
}

// RFC 6901 pointer for the token stack (plus one more token when given).
function pointerOf(tokens, last) {
    let out = '';
    for (const token of tokens) out += `/${escapeToken(token)}`;
    return last === undefined ? out : `${out}/${escapeToken(last)}`;
}

// Generator rules (section 1 of V2DESIGN, with the REV-v2design changes). Objects: the kept keys must keep their
// order and every new key must come after them; then removals, recursion into kept keys, appended adds.
// Arrays: a shorter target replaces the whole array; otherwise recurse per index and append the new tail with "-".
// Anything else (type change, changed primitive, reordered keys) is a replace of that path.
export function diffImages(base, target, tokens, ops) {
    if (isObject(base) && isObject(target)) diffObjects(base, target, tokens, ops);
    else if (Array.isArray(base) && Array.isArray(target)) diffArrays(base, target, tokens, ops);
    else if (base !== target) ops.push({ op: 'replace', path: pointerOf(tokens), value: target });
    return ops;
}

// Recurse into one child; the pointer string is only built when an operation is emitted.
function diffChild(base, target, tokens, key, ops) {
    tokens.push(key);
    diffImages(base, target, tokens, ops);
    tokens.pop();
}

function diffObjects(base, target, tokens, ops) {
    const baseKeys = Object.keys(base);
    const targetKeys = Object.keys(target);
    // Common case, same keys in the same order: recurse per key with no set building.
    if (baseKeys.length === targetKeys.length && baseKeys.every((key, index) => key === targetKeys[index])) {
        for (const key of baseKeys) diffChild(base[key], target[key], tokens, key, ops);
        return;
    }
    const inBase = new Set(baseKeys);
    const inTarget = new Set(targetKeys);
    const kept = baseKeys.filter(key => inTarget.has(key));
    const keptInTarget = targetKeys.filter(key => inBase.has(key));
    const sameOrder = kept.every((key, index) => key === keptInTarget[index]);
    const newKeysLast = targetKeys.slice(0, kept.length).every(key => inBase.has(key));
    if (!sameOrder || !newKeysLast) {
        ops.push({ op: 'replace', path: pointerOf(tokens), value: target });
        return;
    }
    for (const key of baseKeys) {
        if (!inTarget.has(key)) ops.push({ op: 'remove', path: pointerOf(tokens, key) });
    }
    for (const key of kept) diffChild(base[key], target[key], tokens, key, ops);
    for (const key of targetKeys) {
        if (!inBase.has(key)) ops.push({ op: 'add', path: pointerOf(tokens, key), value: target[key] });
    }
}

function diffArrays(base, target, tokens, ops) {
    if (target.length < base.length) {
        ops.push({ op: 'replace', path: pointerOf(tokens), value: target });
        return;
    }
    for (let index = 0; index < base.length; index++) diffChild(base[index], target[index], tokens, String(index), ops);
    for (let index = base.length; index < target.length; index++) ops.push({ op: 'add', path: pointerOf(tokens, '-'), value: target[index] });
}

// Patch between two JSON-like values. An undefined-valued key counts as absent (both sides go through JSON).
export function diffJson(base, target) {
    return diffImages(jsonImage(base), jsonImage(target), [], []);
}
