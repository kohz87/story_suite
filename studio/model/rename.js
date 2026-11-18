// The job: renaming an id. `renameId(refs, doc, kind, from, to)` gives the patches that rewrite the definition and every reference written as the old id, or a
// refusal in words. A reference written as a display name or alias still names the same thing after an id rename, so it is left as it is. Patches are `set` only
// (list positions never move); an object whose keys are ids is rebuilt whole in its own key order. Only the id's own span in a one-line string changes.
//
// renameId → { ok: true, patches, elsewhere } | { ok: false, refusal }. `elsewhere` lists the uses in the other open pack (`refs` built with it), which the
// patches do not touch. Renaming a place also renames the route key of an unnamed route that runs to or from it (conditions name such a route "a–b").

import { SLUG } from '../../packs/limits.js';
import { walkText } from './refs.js';

const LABEL = { place: 'place', region: 'region', realm: 'realm', route: 'route', cast: 'person', condition: 'condition', event: 'event', template: 'template', power: 'power', score: 'score', lore: 'lore entry', fact: 'fact' };
const SHARED = ['place', 'region', 'realm'];
const RESERVED = ['place', 'region', 'route', 'realm'];
const fits = (hint, kind) => hint === kind || (hint === 'any' && SHARED.concat('route').includes(kind)) || (hint === 'standing' && (kind === 'power' || kind === 'score'));
const refuse = refusal => ({ ok: false, refusal });
const getAt = (root, path) => path.reduce((node, key) => (node !== null && typeof node === 'object' ? node[key] : undefined), root);

function refusalFor(refs, kind, from, to) {
    if (!LABEL[kind]) return `"${kind}" is not something with an id.`;
    const found = (refs.defs[kind] ?? []).find(item => item.id === from);
    if (!found) return `There is no ${LABEL[kind]} "${from}" to rename.`;
    if (typeof to !== 'string' || from === to) return `The new id is the same as the old one.`;
    if (kind === 'route') {
        if (!found.path) return `The route "${from}" has no name of its own: give it a name first, then rename it.`;
        if (!to.trim() || /@|: /.test(to)) return 'A route name may not be empty or hold "@" or ": ".';
    } else if (!SLUG.test(to)) return `"${to}" is not an id: use lower-case words joined by "-".`;
    if (RESERVED.includes(to) && (SHARED.includes(kind) || kind === 'route')) return `"${to}" is a reserved word (a placeholder); no place, region, route or realm may use it as an id.`;
    const clash = (SHARED.includes(kind) ? SHARED : [kind]).find(each => (refs.defs[each] ?? []).some(item => item.id === to));
    return clash ? `"${to}" is already the id of a ${LABEL[clash]}.` : null;
}

/** → { ok: true, patches, elsewhere } | { ok: false, refusal }. `doc` is the document (or pack) `refs` was built from. */
export function renameId(refs, doc, kind, from, to) {
    const problem = refusalFor(refs, kind, from, to);
    if (problem) return refuse(problem);
    const root = doc?.doc ?? doc;
    const pairs = [{ kind, from, to }];
    if (kind === 'place') {
        for (const route of Array.isArray(root?.content?.routes) ? root.content.routes : []) {
            if (route?.name === undefined && (route?.from === from || route?.to === from)) pairs.push({ kind: 'route', from: `${route.from}–${route.to}`, to: `${route.from === from ? to : route.from}–${route.to === from ? to : route.to}` });
        }
    }
    const visit = (hint, id) => pairs.find(pair => pair.from === id && fits(hint, pair.kind))?.to;
    const mine = refs.uses.filter(use => use.pack !== 'other' && use.by === 'id' && !use.dangling && pairs.some(pair => pair.kind === use.kind && pair.from === use.id));
    const elsewhere = refs.uses.filter(use => use.pack === 'other' && use.by === 'id' && use.kind === kind && use.id === from);
    const patches = [];
    const seen = new Set();
    for (const use of mine) {
        const at = use.form === 'key' ? use.path.slice(0, -1) : use.path;
        const tag = `${use.form === 'key' ? 'k' : 'v'}${JSON.stringify(at)}`;
        if (seen.has(tag)) continue;
        seen.add(tag);
        if (use.form === 'value') {
            patches.push({ op: 'set', path: at, value: pairs.find(pair => pair.kind === use.kind && pair.from === use.id).to });
        } else if (use.form === 'text') {
            const text = getAt(root, at);
            const next = walkText(text, use.mode, visit);
            if (next !== text) patches.push({ op: 'set', path: at, value: next });
        } else {
            const map = getAt(root, at);
            const keys = Object.keys(map).map(key => (use.mode ? walkText(key, use.mode, visit) : visit(use.kind, key)) ?? key);
            if (new Set(keys).size !== keys.length) return refuse(`That would give two entries of ${at.join('.')} the same key.`);
            patches.push({ op: 'set', path: at, value: Object.fromEntries(Object.keys(map).map((key, n) => [keys[n], map[key]])) });
        }
    }
    return { ok: true, patches, elsewhere };
}
