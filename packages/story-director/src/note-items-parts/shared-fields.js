// Story Director: field extraction, encounter lookup and leg destination helpers for note items.

import { fieldOf, notePart } from '../note-format.js';

// The foes of a planned fight, as written ('' for a record that is not one).
export function encounterOf(record) {
    return fieldOf(record, 'encounter');
}

// The record's fields as the note writes them, each within its word limit. The leg stays
// whole: only its destination is shown, and it is read from the full text.
export function noteFields(record) {
    const fields = record?.fields ?? {};
    return Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, name === 'leg' ? value : notePart(value, name)]));
}

// The far end of a one-hop leg: "Shorn → Varnhold Watch 35 B, courier 70/day → 0.5" gives
// "Varnhold Watch" (the distance, road code and pace after it are not a place).
export function destination(leg) {
    const hops = String(leg ?? '').split(/\s*(?:→|->)\s*/);
    if (hops.length < 2) return '';
    return hops[1].split(',')[0].replace(/\s+\d.*$/, '').trim();
}
