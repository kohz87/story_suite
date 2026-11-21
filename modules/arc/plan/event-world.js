// Story Director v2, part **arc**: what the plan reader checks an EVENT line against (switch story-director.world-events; read-parts/event-line.js):
// the places the map knows (the atlas's `atlas.place`, its own name for one) and the records a cause may name: the Active world events and the
// ones still to come (the brief), the conditions in the party's realm (by name and by key), the Journal's entries and the Director's tracked
// threads. Null without a brief (the switch is off): then EVENT is no plan label. Pure on what it is given.

const MAX_CAUSES = 200;
const text = value => String(value ?? '').replace(/\s+/g, ' ').trim();

/** `{ place(name) → the map's name | null, causes: [name] }` from the world brief, the host's query and the tracked threads ([{ key }]); null without a brief. */
export function eventWorld({ brief = null, query = null, threads = [] } = {}) {
    if (!brief || typeof brief !== 'object') return null;
    const ask = (name, args) => { try { return typeof query === 'function' ? query(name, args) : null; } catch { return null; } };
    const list = value => (Array.isArray(value) ? value : []);
    const causes = [
        ...list(brief.threads).map(thread => thread?.key),
        ...list(brief.toCome),
        ...list(brief.conditions).flatMap(line => { const key = text(line).split(':')[0]; return [key, key.split('@')[0]]; }),
        ...list(ask('chronicle.events', {})).filter(entry => entry?.judge !== 'refused' && entry?.judge !== 'pending').map(entry => entry?.name),
        ...list(threads).map(thread => thread?.key),
    ].map(text).filter(Boolean);
    const place = name => {
        const found = ask('atlas.place', { name: text(name) });
        return found ? text(found.name) || text(name) : null;
    };
    return { place, causes: [...new Set(causes)].slice(0, MAX_CAUSES) };
}
