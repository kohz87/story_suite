// The layouts part: it registers nothing, so the module merge can treat every folder alike.

// The part is here so the module merge (MODULES §A) can treat every folder alike.
export const part = {
    domains: {},
    commands: {},
    queries: {},
    kinds: {},
    context: { static: () => '', tail: () => ({ lines: [], optional: [] }), budget: 0 },
    hooks: {},
    settings: { defaults: {}, schema: {} },
    tabs: [],
};
