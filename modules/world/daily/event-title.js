// World events, the daily step: an event's title as the Journal shows it. A def without an authored `title` falls back to its id
// (defs.js), which a reader should never see: then there is no title and the line goes without the bracket (owner, 27 Nov).

/** The event's own title, or '' when it has none (absent, empty or only the id). */
export const titleOf = (title, id) => (typeof title === 'string' && title.trim() && title !== id ? title.trim() : '');
