// Story Director v2, part **arc**: which known name a cited or quoted text means (an EVENT line's cause, the judge's refused event): the whole name,
// or the name as the brief cuts it, else a name the text begins with on a word boundary (the longest wins), so a printed "name — now" line is its name.
// A cut two names share means neither. ("|" and "/" read alike: lineKey drops both; so two different names that are the same once "|" reads "/",
// as the briefs print it, and marks (* _ `) are folded are neither of them citable; nor is a form that is one name's cut and another's whole.
// Names of one item, such as an event's title and id, never clash with each other.) Pure.

import { lineKey } from '../../../world/changes.js';
import { KEY_POINTS, barless, flat } from '../shared.js';

const printed = text => barless(text).replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/** `finder(names, aliases?, itemOf?)` → `(text) => name | null`. `aliases` ([[text, name]]) count only when cited whole; `itemOf(name)` says which item a name is of. */
export function finder(names, aliases = [], itemOf = name => name) {
    const clash = (a, b) => a !== b && itemOf(a) !== itemOf(b);
    // Printed form → the names printed so; the keys of a form two items' names share name neither.
    const forms = new Map();
    for (const name of names) forms.set(printed(name), [...(forms.get(printed(name)) ?? []), name]);
    const twins = new Set([...forms.values()].filter(same => same.some(a => same.some(b => clash(a, b)))).flatMap(same => same.map(lineKey)));
    const whole = new Map(names.map(name => [lineKey(name), twins.has(lineKey(name)) ? null : name]).filter(([id]) => id));
    // The cuts that differ from their whole name: cut → the name, or null when two different names share it.
    const cuts = new Map();
    for (const name of names) {
        const short = flat(name, KEY_POINTS);
        const id = lineKey(short);
        if (!id || id === lineKey(name)) continue;
        cuts.set(id, twins.has(lineKey(name)) || (cuts.has(id) && lineKey(cuts.get(id) ?? '') !== lineKey(name)) ? null : name);
        // Another item's whole name that reads as this cut: the form is neither's.
        const others = names.filter(other => clash(name, other) && (lineKey(other) === id || printed(other) === printed(short)));
        for (const other of others) { whole.set(lineKey(other), null); cuts.set(id, null); }
    }
    // Longest first; at one length a whole name comes before a cut.
    const starts = [...whole, ...cuts].sort(([a], [b]) => b.length - a.length);
    const short = new Map(aliases.map(([text, name]) => [lineKey(text), name]));
    return text => {
        const said = lineKey(String(text ?? ''));
        if (!said) return null;
        if (whole.has(said)) return whole.get(said);
        if (short.has(said)) return short.get(said);
        if (cuts.has(said)) return cuts.get(said);
        const begun = starts.find(([id]) => said.startsWith(`${id} `));
        if (begun) return begun[1];
        const cut = lineKey(flat(text, KEY_POINTS));
        return whole.get(cut) ?? cuts.get(cut) ?? null;
    };
}
