// The job: telling what the running Story Block offers (its capability names and its version).

/**
 * Capability names the running Story Block offers (module ids and their domain names), or
 * null while the sdk is not up, in which case requires.capabilities is not enforced.
 */
export function stCapabilities() {
    const sdk = globalThis.StoryBlock?.sdk;
    if (!sdk || typeof sdk.modules !== 'function') return null;
    const names = new Set();
    for (const module of sdk.modules() ?? []) {
        if (module?.id) names.add(String(module.id));
        // sdk.modules() lists domains as names; a definition's domains are an object keyed by name.
        const domains = module?.domains ?? {};
        for (const domain of Array.isArray(domains) ? domains : Object.keys(domains)) names.add(String(domain));
        for (const name of Array.isArray(module?.capabilities) ? module.capabilities : []) names.add(String(name));
    }
    return [...names];
}

/** Story Block's version as the sdk reports it, if it does. */
export function stHostVersion() {
    const version = globalThis.StoryBlock?.sdk?.version ?? globalThis.StoryBlock?.version;
    return typeof version === 'string' ? version : null;
}
