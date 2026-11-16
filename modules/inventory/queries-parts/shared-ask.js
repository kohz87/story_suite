// A query's own way to ask other queries over the same state.

// A query's own way to ask other queries (tools.query over the same state); throws when there is none.
export const asker = tools => (name, args) => {
    if (typeof tools?.query !== 'function') throw new Error(`No query "${name}" can be asked here.`);
    return tools.query(name, args);
};
