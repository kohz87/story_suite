// Story Director v2, part **arc**: which known name a cited or quoted text means (an EVENT line's cause, the judge's refused event): the whole name,
// or the name as the brief cuts it, else a name the text begins with on a word boundary (the longest wins), so a printed "name — now" line is its name.
// A cut two names share means neither. ("|" and "/" read alike: lineKey drops both; so two different names that only that tells apart,
// one of them with "|", are both printed alike and neither is citable.) Pure.

import { lineKey } from '../../../world/changes.js';
import { KEY_POINTS, flat } from '../shared.js';

/** `finder(names, aliases?)` → `(text) => name | null`. `aliases` ([[text, name]]) count only when cited whole. */
export function finder(names, aliases = []) {
    const alike = (a, b) => a !== b && (a.includes('|') || b.includes('|'));
    const whole = new Map();
    for (const name of names) {
        const id = lineKey(name);
        if (id) whole.set(id, whole.has(id) && (whole.get(id) === null || alike(whole.get(id), name)) ? null : name);
    }
    // The cuts that differ from their whole name: cut → the name, or null when two different names share it.
    const cuts = new Map();
    for (const name of names) {
        const id = lineKey(flat(name, KEY_POINTS));
        if (!id || id === lineKey(name)) continue;
        cuts.set(id, cuts.has(id) && lineKey(cuts.get(id) ?? '') !== lineKey(name) ? null : name);
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
