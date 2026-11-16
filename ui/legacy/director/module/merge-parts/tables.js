// Story Director v2: registering a part's entry once, keeping its feature tag, and drawing its settings sections.

// ---- merging ---------------------------------------------------------------------------------

export function own(table, name, ns, what) {
    if (Object.hasOwn(table, name)) throw new Error(`Story Director: ${what} "${name}" is in two parts (${table[name]} and ${ns}).`);
    table[name] = ns;
}

// A wrapped handler or query keeps the part's `feature` tag (MODULES §F100: a function with a `feature`
// property), so Story Block can leave it out while the reader has that feature off. A command marked `prelude` (stored on the generated
// reply, registry.isPrelude) keeps that mark too, or the host would commit its step on the reader's message.
export const withFeature = (fn, from) => {
    const tags = { ...(typeof from?.feature === 'string' ? { feature: from.feature } : {}), ...(from?.prelude === true ? { prelude: true } : {}) };
    return Object.keys(tags).length ? Object.assign(fn, tags) : fn;
};

// The settings panel's own part (`settings.section(el, api)`): a part's function, keeping its `feature`
// tag (one part has one now); several are drawn one after another, untagged.
export function sectionOf(list) {
    if (!list.length) return null;
    if (list.length === 1) return list[0];
    return (el, api) => { for (const fn of list) fn(el, api); };
}
