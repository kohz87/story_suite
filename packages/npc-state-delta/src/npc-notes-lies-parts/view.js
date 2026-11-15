// What the lies show: the prompt tail line, the dossier rows and the caught receipt.
import { LIE_TO_MAX } from './shared-limits.js';
import { NAME_MAX, clip } from './shared-text.js';
import { listOf } from './read.js';

/**
 * The one optional tail line for a present NPC: their latest uncaught lie, or '' when there is none. The text is hidden, so the
 * caller puts it under the shared (hidden) wording of src/npc-meters-prompt.js; this line is never shown to the reader.
 */
export function lieTail(name, stored) {
    const open = listOf(stored).filter(item => !item.caught);
    const last = open.at(-1);
    if (!last) return '';
    return `${clip(name, NAME_MAX)} (hidden): told ${last.to} "${last.said}"; stay consistent unless caught.`;
}

/**
 * Dossier rows, oldest first: { id, to, said, day, hidden, caught }. `hidden` is set on every uncaught lie. With `redact` (the
 * default, since the owner has not chosen plain or redacted) a hidden row's `said` is null, so the view can show "a lie to Astra ·
 * hidden" without the words; `redact: false` shows the words of every row.
 */
export function lieRows(stored, { redact = true } = {}) {
    return listOf(stored).map((item, i) => {
        const hidden = !item.caught;
        const secret = hidden && redact;
        return {
            // The stored id embeds the words, so a redacted row gets an opaque place number instead.
            id: secret ? `lie-${i}` : item.id,
            to: item.to,
            said: secret ? null : item.said,
            day: item.day,
            hidden,
            caught: item.caught ? { ...item.caught } : null,
        };
    });
}

/** The caught receipt and next-reply cue: "Rika: caught in a lie to Astra; trust 11 → 5." (no trust numbers: "…to Astra.") */
export function caughtSummary(name, to, before, after) {
    const head = `${clip(name, NAME_MAX)}: caught in a lie to ${clip(to, LIE_TO_MAX)}`;
    return Number.isFinite(before) && Number.isFinite(after) ? `${head}; trust ${before} → ${after}.` : `${head}.`;
}
