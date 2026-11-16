// The registry's interaction index: every kind a registered module defines, by its full id `<moduleId>/<kind>`.

export function createInteractionLookups({ defs, held }) {
    const kindsOf = def => Object.keys(def.interactions ?? {}).sort();
    return {
        /** The KindDef for a full kind id, or null (unknown, or its module is held back). */
        interaction(kindId) {
            const text = String(kindId ?? '');
            const at = text.indexOf('/');
            if (at < 1) return null;
            const id = text.slice(0, at);
            const def = defs.get(id);
            const kind = text.slice(at + 1);
            if (!def || held(id) || !Object.hasOwn(def.interactions ?? {}, kind)) return null;
            return def.interactions[kind];
        },
        /** The full kind ids a module defines, sorted ([] for none or an unknown module). */
        interactionIds: id => (defs.has(id) ? kindsOf(defs.get(id)).map(kind => `${id}/${kind}`) : []),
    };
}
