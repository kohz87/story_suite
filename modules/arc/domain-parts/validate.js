// Arc slice validator for Story Director v2.

import { ARC_ROOM, isRecord } from './shared-records.js';

const ARC_ID = /^arc_[0-9a-z]{8}$/;
const REASONS = new Set(['manual', 'no-arc', 'arc-end', 'stalled', 'running-low']);
const isInt = value => Number.isSafeInteger(value);

/** `validate(slice) → string[]` (SPEC §2.5). */
export function validateArc(slice) {
    if (!isRecord(slice)) return ['arc is not an object.'];
    const errors = [];
    if (!isRecord(slice.arcs)) errors.push('arc.arcs is not an object.');
    else {
        if (Object.keys(slice.arcs).length > 2 * ARC_ROOM) errors.push(`arc.arcs holds more than ${2 * ARC_ROOM} arcs.`);
        for (const [id, entry] of Object.entries(slice.arcs)) {
            const at = `arc.arcs.${id}`;
            if (!isRecord(entry) || entry.id !== id || !ARC_ID.test(id)) { errors.push(`${at} has a bad id.`); continue; }
            if (typeof entry.key !== 'string' || !entry.key.trim()) errors.push(`${at} has no name.`);
            if (typeof entry.desc !== 'string') errors.push(`${at}.desc is not text.`);
            if (!isInt(entry.rev) || entry.rev < 0) errors.push(`${at}.rev must be a whole number.`);
            if (!(entry.minutes === null || isInt(entry.minutes))) errors.push(`${at}.minutes must be null or whole minutes.`);
            if (!REASONS.has(entry.reason)) errors.push(`${at}.reason is unknown.`);
            if (typeof entry.note !== 'string') errors.push(`${at}.note is not text.`);
        }
    }
    if (!isRecord(slice.ends)) errors.push('arc.ends is not an object.');
    else {
        if (Object.keys(slice.ends).length > 2 * ARC_ROOM) errors.push(`arc.ends holds more than ${2 * ARC_ROOM} endings.`);
        for (const [id, end] of Object.entries(slice.ends)) {
            if (!ARC_ID.test(id) || !isRecord(end) || !isInt(end.rev) || typeof end.reason !== 'string') errors.push(`arc.ends.${id} must be { rev, reason }.`);
        }
    }
    return errors;
}
