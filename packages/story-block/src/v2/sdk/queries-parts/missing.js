// Finds the registered modules whose domains the head state still lacks.

/**
 * The registered modules whose domains the head state lacks (enabled after the chat began, or a
 * newer version with a domain more): [{ def, missing: [domain names] }], in module-id order. A module
 * held back (dormant, or the restore barrier is up; registry.held) is left out: it is set up when it is ready.
 */
export function missingModules(registry, state) {
    const domains = state?.domains ?? {};
    return registry.modules()
        .filter(def => registry.held?.(def.id) !== true)
        .map(def => ({ def, missing: Object.keys(def.domains ?? {}).filter(name => !def.domains[name].deferred && !Object.hasOwn(domains, name)) }))
        .filter(entry => entry.missing.length);
}
