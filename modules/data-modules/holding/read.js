// The player's holding in a chat's state: the founded data module whose slug is `holding` (a company, fief or powerhouse). Pure.
import { activeDefinition } from '../adapters.js';

/** Whether a definition is a holding: the slug `holding` with the fields code reads (`founded`, `seat`, `region`). */
export const isHolding = definition => definition?.slug === 'holding' && definition.scope === 'chat'
    && definition.state?.founded?.type === 'bool' && definition.state.seat?.type === 'text' && definition.state.region?.type === 'text';

/** The founded holding's fields (a copy), or null: none pinned, or none founded yet. */
export function holdingOf(state) {
    const domain = state?.domains?.dataModules;
    for (const module of Object.keys(domain?.active ?? {})) {
        const fields = isHolding(activeDefinition(state, module)) ? domain.instances?.[module]?.chat?.fields : null;
        // (`module` is the pinned module's id)
        if (fields?.founded === true) return { ...fields, module };
    }
    return null;
}
