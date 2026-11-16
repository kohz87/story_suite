// Story Director: section line and beats-line builders for the note.

import { ITEM_SEPARATOR, fieldOf, notePart, part } from '../note-format.js';

// The arc is carried by its beats (0.9.3): its name and what it is about head the Beats line,
// "Beats — The Weir Debt (who sold the route): Toll riders reach the ford (Goldwane 19)", so
// the note has no separate arc line to weigh against them. With every beat due (on Due now)
// or none left, the line is the arc alone.
export function addBeats(parts, arc, items) {
    const present = items.filter(Boolean);
    if (!arc) {
        addLine(parts, 'Beats', present);
        return;
    }
    const desc = notePart(fieldOf(arc, 'desc'), 'desc');
    const head = `Beats — ${arc.key}${desc ? ` (${desc})` : ''}`;
    parts.push(part('Beats', present.length ? `${head}: ${present.join(ITEM_SEPARATOR)}` : head));
}

export function addLine(parts, label, items, separator = ITEM_SEPARATOR) {
    const present = items.filter(Boolean);
    if (present.length) parts.push(part(label, `${label}: ${present.join(separator)}`));
}
