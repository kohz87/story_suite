// Story Director v2, part **arc**: the code guard behind the planner's react-not-resolve rule (switch story-director.world-events).
// A planned beat, clock or agenda that names one of an Active world event's outcomes by its id (written with a dash, underscore or digit,
// matched as whole words) decides the event: it is left out of the plan with the adopted note. Certain cases only; everything else,
// a plain-word outcome beside the event's name included, waits for the Director judge. Pure; it runs on the planner's answer, never on
// the reader's edited text (so accepting is the same command, live or replayed).

const KINDS = new Set(['beat', 'clock', 'agenda']);
const squash = text => ` ${String(text ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
const idLike = name => /[-_\d]/.test(name);

/** The adopted note for a refused item. */
export const refusalNote = (kind, title) => `Refused: this ${kind} decides how ${title ? `the world event "${title}"` : 'an Active world event'} ends; the world resolves it by itself. Plan a reaction instead.`;

function decides(item, events) {
    const text = [item.key, item.desc, ...Object.values(item.parts ?? {})].join(' ');
    const loose = squash(text);
    for (const event of events) {
        const names = (event.outcomes ?? []).filter(name => typeof name === 'string' && name.trim());
        // An outcome written as an id (a dash, underscore or digit) is a certain case, matched as whole words. A plain-word outcome ("war")
        // beside the event's name may be a reaction ("refugees flee the war over the succession"), so that is left to the Director judge.
        if (names.some(name => idLike(name) && loose.includes(squash(name)))) return event.title;
    }
    return null;
}

/**
 * `read` (readPlan's result) without the items that decide an Active event, and the notes for them.
 * `events`: `[{ id, title, outcomes: [name] }]` (the brief's `guard`); none → nothing changes.
 * → `{ read, refused: [note] }`.
 */
export function refuseResolving(read, events) {
    if (!Array.isArray(events) || !events.length || !read) return { read, refused: [] };
    const refused = [];
    const items = read.items.filter(item => {
        if (!KINDS.has(item.kind)) return true;
        const title = decides(item, events);
        if (title === null) return true;
        refused.push(refusalNote(item.kind, title));
        return false;
    });
    if (!refused.length) return { read, refused };
    const findings = [...read.findings, ...refused.map(text => ({ severity: 'warn', text }))];
    if (!items.length) findings.unshift({ severity: 'error', text: 'The plan has no beats, agendas, hooks, clocks or secrets.' });
    return { read: { ...read, items, findings }, refused };
}
