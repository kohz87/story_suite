// Story Director v2, part **keypeople**: runtime validator for the keypeople domain slice.

import { MAX_ALIASES, NOTE_KINDS, REASONS } from './kinds.js';
import { MAX_STORED } from './limits-storage.js';
import { MAX_DOING, MAX_NAME, MAX_STEP, MAX_STEPS } from './limits-text.js';
import { isInt, isRecord, keyOf } from './primitives.js';

const textOk = (value, max) => typeof value === 'string' && Array.from(value).length <= max;
const timeOk = value => value === null || isInt(value);

function pinProblems(key, pin) {
    const at = `keypeople.pins.${key}`;
    if (!isRecord(pin) || !textOk(pin.name, MAX_NAME) || !keyOf(pin.name) || keyOf(pin.name) !== key || !timeOk(pin.since) || !isInt(pin.rev)) return [`${at} is not { name, since, rev }.`];
    if (pin.nsd !== undefined && typeof pin.nsd !== 'boolean') return [`${at}.nsd is true or false.`];
    if (pin.npc !== undefined && !/^np_[0-9a-z]{8}$/.test(pin.npc)) return [`${at}.npc is an NPC identity like np_k3f9a2qz.`];
    if (pin.aliases !== undefined && (!Array.isArray(pin.aliases) || pin.aliases.length > MAX_ALIASES || pin.aliases.some(alias => !textOk(alias, MAX_NAME)))) return [`${at}.aliases is a list of at most ${MAX_ALIASES} names.`];
    return [];
}

function awayProblems(key, away) {
    const at = `keypeople.away.${key}`;
    if (!isRecord(away) || !textOk(away.name, MAX_NAME) || keyOf(away.name) !== key || !textOk(away.doing, MAX_DOING) || !timeOk(away.since) || !timeOk(away.back) || !isInt(away.rev)) return [`${at} is not { name, doing, since, back, steps, rev }.`];
    if (!Array.isArray(away.steps) || away.steps.length > MAX_STEPS || away.steps.some(step => !isRecord(step) || !timeOk(step.date) || !textOk(step.text, MAX_STEP))) return [`${at}.steps is a list of at most ${MAX_STEPS} { date, text }.`];
    return [];
}

function goneProblems(key, gone) {
    const at = `keypeople.gone.${key}`;
    if (!isRecord(gone) || !textOk(gone.name, MAX_NAME) || keyOf(gone.name) !== key || !REASONS.includes(gone.reason) || !timeOk(gone.on) || !isInt(gone.rev)) return [`${at} is not { name, reason, on, rev }.`];
    if (gone.owed !== undefined && gone.owed !== true) return [`${at}.owed is true or left out.`];
    return [];
}

function noteProblems(id, note) {
    const at = `keypeople.notes.${id}`;
    if (!isRecord(note) || !(note.sid === null || typeof note.sid === 'string') || !NOTE_KINDS.includes(note.kind) || !textOk(note.name, MAX_NAME)
        || !textOk(note.head, 200) || !textOk(note.rest, 300) || typeof note.lead !== 'boolean' || !isInt(note.rev)) return [`${at} is not { sid, kind, name, head, rest, lead, rev }.`];
    if ((note.key === undefined) !== (note.goneRev === undefined) || (note.key !== undefined && (typeof note.key !== 'string' || !note.key || !isInt(note.goneRev)))) return [`${at}.key and .goneRev go together: the taken-off record and its rev.`];
    return [];
}

/** The validator: [] or sentences. */
export function validateKeyPeople(slice) {
    if (!isRecord(slice) || !['pins', 'away', 'gone', 'notes'].every(name => isRecord(slice[name]))) return ['keypeople is not { pins, away, gone, notes }.'];
    const errors = [];
    for (const [name, check] of [['pins', pinProblems], ['away', awayProblems], ['gone', goneProblems], ['notes', noteProblems]]) {
        const keys = Object.keys(slice[name]);
        if (keys.length > MAX_STORED) errors.push(`keypeople.${name} holds more than ${MAX_STORED} entries.`);
        for (const key of keys) errors.push(...check(key, slice[name][key]));
    }
    for (const key of Object.keys(slice)) if (!['pins', 'away', 'gone', 'notes'].includes(key)) errors.push(`keypeople has an unknown field "${key}".`);
    return errors.slice(0, 10);
}
