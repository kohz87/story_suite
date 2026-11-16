// Answers the `interaction.view` query with the same current snapshot as `sdk.interaction.current()`.

export const INTERACTION_VIEW = 'interaction.view';

function copy(value) {
    return value === null || value === undefined ? null : structuredClone(value);
}

/** Builds the query handler over an interaction api (the core module registers it). */
export function createInteractionView(api) {
    return () => {
        try {
            const value = typeof api === 'function' ? api() : api?.current?.();
            return copy(value);
        } catch {
            return null;
        }
    };
}
