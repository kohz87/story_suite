// World events, the daily step: an event's title as the Journal shows it. A def without an authored `title` falls back to its id
// (defs.js), which a reader should never see: then there is no title and the line goes without the bracket (owner, 27 Nov).

/** The event's own title, or '' when it has none (absent, empty or only the id). */
export const titleOf = (title, id) => (typeof title === 'string' && title.trim() && title !== id ? title.trim() : '');

/**
 * An authored summary for an event that is not firing (lapsed, or only named as a reason): the clause waiting for an outcome is cut.
 * '' when it is absent, only the id (defs.js's default) or still holds a placeholder.
 */
export function unfiredSummary(summary, id) {
    if (typeof summary !== 'string' || summary === id) return '';
    const text = summary.replace(/\s*[:;,]\s*\{outcome\}.*$/s, '').trim();
    return /\{\w+\}/.test(text) ? '' : text;
}
