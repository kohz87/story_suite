// Proof evidence payloads, shape: checks that a proof payload is closed and well formed for its kind.

import { isId } from '../../check.js';
import { CONTROL, LIMITS, STATS, isObject, utf8 } from '../constants.js';
import { canonicalJson, isRecordId } from '../../replay.js';

// ---------- payloads ----------

// Plain text: nothing at the ends, no control characters, 1..max code points.
const textProblem = (value, max) => {
    if (typeof value !== 'string' || !value) return 'is text';
    if (value.trim() !== value) return 'has no space at either end';
    if (CONTROL.test(value)) return 'has no control characters';
    if ([...value].length > max) return `is at most ${max} characters`;
    return '';
};

export const exactKeys = (payload, keys) => Object.keys(payload).length === keys.length && keys.every(key => Object.hasOwn(payload, key));

/** An acceptance (contract §6): `{ thread, selection }` (the reader's pick) or `{ thread, words }` (what they said). */
function acceptanceProblem(payload) {
    if (!isRecordId(payload.thread)) return 'its thread is a record id like th_k3f9a2qz';
    const keys = Object.keys(payload).filter(key => key !== 'thread');
    if (keys.length !== 1 || (keys[0] !== 'selection' && keys[0] !== 'words')) return 'it names its thread and either a selection or the reader\'s words, nothing else';
    const why = textProblem(payload[keys[0]], keys[0] === 'selection' ? LIMITS.selection : LIMITS.words);
    return why ? `its ${keys[0]} ${why}` : '';
}

/** The check Story Director asks evidence for (contract §6): `{ check, actor, stat, dc }`, an `event` proof. */
function checkProblem(payload) {
    if (!exactKeys(payload, ['check', 'actor', 'stat', 'dc'])) return 'a check is { check, actor, stat, dc } and nothing else';
    if (!isRecordId(payload.check)) return 'its check is a record id';
    if (!isId(payload.actor)) return 'its actor is an id';
    if (!STATS.includes(payload.stat)) return `its stat is one of ${STATS.join(', ')}`;
    if (!Number.isInteger(payload.dc) || payload.dc < 1 || payload.dc > 40) return 'its dc is a whole number from 1 to 40';
    return '';
}

// A payload the contract leaves to a later package (B3/B6, Story Director's own events and visits): any plain
// JSON object, not empty, within the byte cap. Whether it means anything is its owner's to check.
function opaqueProblem(json, payload) {
    if (!Object.keys(payload).length) return 'it has nothing in it';
    if (utf8.encode(json).length > LIMITS.opaqueBytes) return `it is more than ${LIMITS.opaqueBytes} bytes`;
    return '';
}

const MAX_DEPTH = 64;

// '' when `value` is a tree that JSON can hold as it is: no list with a hole ([1, , 3] would come back as null), no
// object that contains itself, nothing nested deeper than MAX_DEPTH; else why not.
function structureProblem(value, ancestors = new Set(), depth = 0) {
    if (!value || typeof value !== 'object') return '';
    if (depth > MAX_DEPTH) return `it is nested more than ${MAX_DEPTH} levels deep`;
    if (ancestors.has(value)) return 'it contains itself';
    ancestors.add(value);
    let found = '';
    if (Array.isArray(value)) {
        for (let at = 0; at < value.length && !found; at += 1) {
            found = !(at in value) ? 'it has a list with a gap in it' : structureProblem(value[at], ancestors, depth + 1);
        }
    } else {
        for (const item of Object.values(value)) {
            found = structureProblem(item, ancestors, depth + 1);
            if (found) break;
        }
    }
    ancestors.delete(value);
    return found;
}

/**
 * { problem, json }: '' when `payload` is a closed payload for `kind`, else why not (structure only: intent is
 * `intentProblem`), and its normalized JSON (what its hash is taken of) when it is plain JSON.
 */
export function payloadCheck(kind, payload) {
    if (!isObject(payload)) return { problem: 'its payload is a plain JSON record', json: '' };
    const shape = structureProblem(payload);
    if (shape) return { problem: `its payload is plain JSON, and ${shape}`, json: '' };
    let json = '';
    try { json = canonicalJson(payload); } catch { json = ''; }
    if (!json) return { problem: 'its payload is a plain JSON record', json: '' };
    if (kind === 'acceptance') return { problem: acceptanceProblem(payload), json };
    if (kind === 'event' && Object.hasOwn(payload, 'check')) return { problem: checkProblem(payload), json };
    return { problem: opaqueProblem(json, payload), json };
}

/** '' when `payload` is a closed payload for `kind`, else why not. */
export const payloadProblem = (kind, payload) => payloadCheck(kind, payload).problem;
