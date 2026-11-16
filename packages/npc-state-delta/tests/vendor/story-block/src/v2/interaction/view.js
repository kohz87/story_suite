// Answers the `interaction.view` query with the same current snapshot as `sdk.interaction.current()`.

export const INTERACTION_VIEW = 'interaction.view';

function copy(value) {
    return value === null || value === undefined ? null : structuredClone(value);
}

/** Builds the unregistered query handler over an interaction api, made in I2b. */
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
