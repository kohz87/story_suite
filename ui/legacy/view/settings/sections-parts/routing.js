// Where a piece of today's settings goes (its section), and which folds start open.

import { HOST_FOLD, PACKS_FOLD } from '../../../host-ui.js';

/** Story Block's own module id (src/v2/domains/index.js CORE_MODULE_ID): the one module whose parts are spread over sections. */
const CORE_ID = 'story-block';

/**
 * The section a piece of today's settings belongs to. `piece` is what host-ui.js is placing:
 * { type: 'host' } (the Story Suite fold: panel style, prompt size, Tabs), 'own-fold' (a module's own fold: Story
 * Block's Packs), 'features', 'module' (a module's fold), 'panel' (a module's custom panel), 'group' (one settings
 * group of a module), 'diagnostics', 'versions'.
 */
export function routeOf(piece) {
    switch (piece?.type) {
        case 'features': return 'features';
        // The Story Suite fold (budgets, Prompt size, Tabs); its look settings are in Look.
        case 'host': return 'tabs';
        case 'own-fold': return piece.moduleId === CORE_ID ? 'tabs' : 'modules';
        // Story Block's money settings are its General group; its Assist panel and the Assist group are Assist.
        case 'panel': return piece.moduleId === CORE_ID ? 'assist' : 'modules';
        case 'group':
            if (piece.moduleId !== CORE_ID) return 'modules';
            // (the RPG group is the Level cap: Settings → RPG draws that row itself, so the Modules page does not draw it a second time)
            return piece.group === 'General' ? 'money' : piece.group === 'Assist' ? 'assist' : piece.group === 'RPG' ? 'rpg' : 'modules';
        case 'diagnostics': return 'diagnostics';
        default: return 'modules';
    }
}

// Folds that start open: a page that is one fold or one group should not open on a closed box. The rest are as
// the reader left them, or closed.
const OPEN = new Set([HOST_FOLD, PACKS_FOLD, `${CORE_ID}::group:Assist`]);
export const opensByDefault = key => OPEN.has(key);
