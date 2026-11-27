// World events, the daily step: the words a reader (or a prompt a reply can echo) gets for an event or template, never its id, and the
// filling of a summary's placeholders. A def without an authored `title` or `summary` falls back to its id (defs.js), which counts as none.

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

const WHERE = '\\{(?:place|region|realm)\\}';
// A preposition and the place placeholders it leads ("at {place}, {region}"). Not when more of the phrase leans on them ("between {place} and …", "{place}'s").
const LED = new RegExp(`\\s+(?:at|in|on|from|near|to|toward|towards|of|into|around|across|outside|inside|along|through|over|under|beyond|off|upon|within|for|by)\\s+(${WHERE}(?:,\\s*${WHERE})*)(?!['’]s|\\s+and\\b)`, 'gi');

/**
 * `summary` with {outcome}, {place}, {region} and {realm} filled from `bind` (`outcome` a name). An empty value never leaves a gap: with
 * no outcome the clause that waits for it is cut, and a place nobody knows goes with its preposition. '' when a placeholder is left over.
 */
export function fillSummary(summary, bind = null, outcome = '') {
    const values = { outcome: outcome || '', place: bind?.place || '', region: bind?.regionName || bind?.region || bind?.place || '', realm: bind?.realm || '' };
    let text = String(summary ?? '');
    if (values.region === values.place) text = text.replace(/\{place\},\s*\{region\}/g, '{place}');
    if (!values.outcome) text = text.replace(/\s*[:;,]\s*\{outcome\}.*$/s, '');
    text = text.replace(LED, (all, run) => {
        const names = run.match(/\{\w+\}/g);
        const kept = names.filter(name => values[name.slice(1, -1).toLowerCase()]);
        return kept.length === names.length ? all : kept.length ? all.replace(run, () => kept.join(', ')) : '';
    });
    let open = false;
    text = text.replace(/\{(outcome|place|region|realm)\}/g, (all, key) => values[key] || ((open = true), ''));
    return open ? '' : text.replace(/\s+/g, ' ').replace(/ ([,;:.!?])/g, '$1').replace(/[,;:](?=[,;:.!?])/g, '').trim();
}

/** The name of an event or template def ({ id, title?, summary? }) in words: its title, else its filled summary without the closing mark, else ''. */
export function labelOf(def, bind = null) {
    const said = def?.summary === def?.id ? '' : fillSummary(def?.summary, bind, bind?.outcome);
    return titleOf(def?.title, def?.id) || said.replace(/[\s.!?…:;,]+$/, '');
}
