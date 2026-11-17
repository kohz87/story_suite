// Story Director v2, part **arc**: the code guard behind the planner's react-not-resolve rule (switch story-director.world-events).
// A planned beat, clock or agenda that names an Active world event (its title or id) together with one of that event's outcomes, or
// that names an outcome by its id (written with a dash, underscore or digit), decides the event: it is left out of the plan with the
// adopted note. Certain cases only; the free-text judgement waits for the Director judge. Pure; it runs on the planner's answer, never on
// the reader's edited text (so accepting is the same command, live or replayed).

const KINDS = new Set(['beat', 'clock', 'agenda']);
const squash = text => ` ${String(text ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
const idLike = name => /[-_\d]/.test(name);

/** The adopted note for a refused item. */
export const refusalNote = (kind, title) => `Refused: this ${kind} decides how the world event "${title}" ends; the world resolves it by itself. Plan a reaction instead.`;

function decides(item, events) {
    const text = [item.key, item.desc, ...Object.values(item.parts ?? {})].join(' ');
    const loose = squash(text);
    const raw = String(text).toLowerCase();
    for (const event of events) {
        const names = (event.outcomes ?? []).filter(name => typeof name === 'string' && name.trim());
        const named = ref => typeof ref === 'string' && ref.trim() && loose.includes(squash(ref));
        const outcome = name => loose.includes(squash(name));
        if ((named(event.title) || named(event.id)) && names.some(outcome)) return event.title;
        if (names.some(name => idLike(name) && raw.includes(name.toLowerCase()))) return event.title;
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
