// Reading the registry: a domain's definition, its version, and the list of registered domains.

/** The domain definition a registered domain is declared with, or null (unregistered: an orphan, or the host's own). */
export function domainDef(registry, name) {
    const owner = registry.domainOwner?.(name);
    return owner ? registry.module?.(owner)?.domains?.[name] ?? null : null;
}

/** A domain's version: `version` on its definition (a whole number from 1), else 1. */
export function versionOf(def) {
    return Number.isInteger(def?.version) && def.version >= 1 ? def.version : 1;
}

/** Every domain the registry knows, [{ name, owner, version }] sorted by name. */
export function registered(registry) {
    const out = [];
    for (const def of registry.modules?.() ?? []) {
        for (const name of Object.keys(def.domains ?? {})) out.push({ name, owner: def.id, version: versionOf(def.domains[name]) });
    }
    return out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
