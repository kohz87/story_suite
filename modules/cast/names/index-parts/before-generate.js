// Story Director v2, names: `beforeGenerate`: record names newly in use and pin the rename cue for refusals not told yet.

import { cleanName } from './text.js';
import { nameKey } from './keys.js';
import { tables, identityKey } from './slice-keys.js';
import { namesOn, settingsOf } from './feature.js';
import { othersOf, suggestionsFor } from './scene.js';

/** `beforeGenerate(view, info)`: one `names.seen` step for names newly in use, one `names.told` step and the pinned rename cue for refusals not told yet. */
export function beforeGenerate(view, info = {}) {
    if (!namesOn(view)) return undefined;
    const slice = view?.state?.domains?.names;
    const { people, seen, taken } = tables(slice);
    const commands = [];
    if (info?.commit !== false) {
        const others = othersOf(view);
        const identities = others.identities.filter(entry => !Object.hasOwn(seen, identityKey(entry))).slice(0, 60);
        const linked = new Set(others.identities.filter(entry => identities.includes(entry) || seen[identityKey(entry)]).flatMap(entry => [entry.name, ...entry.aliases]).map(nameKey));
        const who = [...new Set(others.names.map(cleanName))].filter(name => !linked.has(nameKey(name)) && !Object.hasOwn(people, nameKey(name)) && !Object.hasOwn(seen, nameKey(name))).slice(0, 60);
        if (who.length || identities.length) commands.push({ type: 'names.seen', payload: { who, ...(identities.length ? { identities } : {}) } });
    }
    const owed = Object.entries(taken).filter(([, entry]) => entry.told !== true);
    const lines = owed.map(([key, entry], at) => {
        const [fresh] = settingsOf(view).count ? suggestionsFor(view, slice, 1, `${key}|${view?.chat?.length ?? 0}|${at}`) : [];
        return { text: `[Names] "${entry.name}" is not a fresh name (already used or not allowed). Call that person ${fresh ? `"${fresh}"` : 'by another, unused name'} from now on.`, keep: true };
    });
    if (owed.length && info?.commit !== false) commands.push({ type: 'names.told', payload: { who: owed.map(([key]) => key) } });
    return commands.length || lines.length ? { ...(commands.length ? { commands } : {}), ...(lines.length ? { lines } : {}) } : undefined;
}
