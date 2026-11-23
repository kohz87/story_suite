// Story Suite Text RPG: a reference module for Story Suite. A separate SillyTavern extension that
// uses nothing from Story Suite but its public sdk (globalThis.StoryBlock.ready).

import { textRpgModule } from './src/module.js';

export { renderNewCharacter } from './src/module.js';

const host = globalThis.StoryBlock;
if (host?.ready && typeof host.ready.then === 'function') {
    host.ready.then(sdk => sdk.registerModule(textRpgModule(sdk)))
        .catch(error => console.error('[Story Suite Text RPG] Could not register with Story Suite:', error));
} else {
    console.warn('[Story Suite Text RPG] Story Suite is needed; Text RPG stays off.');
}
