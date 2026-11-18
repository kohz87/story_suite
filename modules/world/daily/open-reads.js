// World events, open templates (spec §5 check 4): the conditions and facts an AUTHORED event, lore gate or secret gate reads. A generated
// result may not write one of those conditions unless it is marked `open: true`. Reads every string an event or gate holds for a
// condition `name@ref`, `set:<name>` / `cleared:<name>` or `fact:<id>`. Pure.

const list = value => (Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]);

function strings(value, out, depth = 0) {
    if (typeof value === 'string') out.push(value);
    else if (depth < 4 && Array.isArray(value)) for (const item of value) strings(item, out, depth + 1);
    else if (depth < 4 && value && typeof value === 'object') for (const [key, item] of Object.entries(value)) { out.push(key); strings(item, out, depth + 1); }
}

/** `{ conds: Set, facts: Set }` read by the events' reading fields, the lore entries' gates and the cast secrets' gates. */
export function authoredReads(world = {}, events = []) {
    const texts = [];
    for (const def of events) strings([def.requires, def.requiresAny, def.window?.after, def.preEmptedBy, def.ends?.anyOf, def.likelier], texts);
    for (const lore of list(world.lore)) strings(lore?.gate, texts);
    for (const person of list(world.cast)) for (const secret of list(person?.secrets)) strings(secret?.gate, texts);
    const conds = new Set();
    const facts = new Set();
    for (const text of texts) {
        for (const match of text.matchAll(/([a-z0-9]+(?:-[a-z0-9]+)*)@/g)) conds.add(match[1]);
        for (const match of text.matchAll(/\b(?:set|cleared):([a-z0-9]+(?:-[a-z0-9]+)*)/g)) conds.add(match[1]);
        for (const match of text.matchAll(/\bfact:([a-z0-9]+(?:-[a-z0-9]+)*)/g)) facts.add(match[1]);
    }
    return { conds, facts };
}
