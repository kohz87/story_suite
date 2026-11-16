// Mounts: builds the five mounts (tab, screen, card, hud, dialog) from one set of dependencies.

import { createCardMount } from '../card.js';
import { createDialogMount } from '../dialog.js';
import { createHudMount } from '../hud.js';
import { createScreenMount } from '../screen.js';
import { createTabMount } from '../tab.js';

/** → { tab, screen, card, hud, dialog }; `card` only when `deps.carriers` is given. */
export function createMounts(deps) {
    return {
        tab: createTabMount(deps),
        screen: createScreenMount(deps),
        card: typeof deps.carriers === 'function' ? createCardMount(deps) : null,
        hud: createHudMount(deps),
        dialog: createDialogMount(deps),
    };
}
