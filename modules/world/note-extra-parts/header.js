// Story Director: the note's header line formatting.
import { ITEM_SEPARATOR } from '../note-format.js';

export function header(selection, calendar) {
    const parts = ['Story Director'];
    const now = selection?.now;
    if (calendar && typeof now === 'number' && Number.isFinite(now)) {
        // (0.9.21) Today's weekday leads the date when the world has a week.
        const day = typeof calendar.weekday === 'function' ? calendar.weekday(now) : '';
        parts.push(day ? `${day}, ${calendar.format(now)}` : calendar.format(now));
    }
    if (selection?.place) parts.push(selection.place);
    return `[${parts.join(ITEM_SEPARATOR)}]`;
}

/** The note's header for a selection ("[Story Director · date · place]"), for a note with no other part (v2's tail). */
export const noteHeader = header;
