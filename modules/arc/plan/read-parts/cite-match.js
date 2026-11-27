// Story Director v2, part **arc**: which known name a cited or quoted text means (an EVENT line's cause, the judge's refused event): the whole name,
// or the name as the brief cuts it, else a name the text begins with on a word boundary (the longest wins), so a printed "name — now" line is its name. Pure.

import { lineKey } from '../../../world/changes.js';
import { KEY_POINTS, flat } from '../shared.js';

/** `finder(names, aliases?)` → `(text) => name | null`. `aliases` ([[text, name]]) count only when cited whole. */
export function finder(names, aliases = []) {
    const forms = names.flatMap(name => [[lineKey(flat(name, KEY_POINTS)), name], [lineKey(name), name]]).filter(([id]) => id);
    const whole = new Map(forms);
    const longest = [...forms].sort(([a], [b]) => b.length - a.length);
    const short = new Map(aliases.map(([text, name]) => [lineKey(text), name]));
    return text => {
        const said = lineKey(String(text ?? ''));
        if (!said) return null;
        return whole.get(said) ?? whole.get(lineKey(flat(text, KEY_POINTS))) ?? short.get(said) ?? longest.find(([id]) => said.startsWith(`${id} `))?.[1] ?? null;
    };
}
