// Story Suite Text RPG: a reference module for Story Block v2. A separate SillyTavern extension that
// uses nothing from Story Block but its public sdk (globalThis.StoryBlock.ready).

import { textRpgModule } from './src/module.js';

export { renderNewCharacter } from './src/module.js';

const host = globalThis.StoryBlock;
if (host?.ready && typeof host.ready.then === 'function') {
    host.ready.then(sdk => sdk.registerModule(textRpgModule(sdk)))
        .catch(error => console.error('[Story Suite Text RPG] Could not register with Story Block:', error));
} else {
    console.warn('[Story Suite Text RPG] Story Block v2 is needed; Text RPG stays off.');
}
