// Story Suite: the one entry SillyTavern loads (manifest.json "js"). It starts the host and its modules, then the people part, then the new view's switch.

import { boot } from './core/boot/boot.js';
import { startPreview } from './ui/entry/start.js';

if (globalThis.SillyTavern) {
  boot().then(async started => {
    if (!started) return;
    // The people part (NPC State) starts after every other module, as it always did.
    await import('./modules/people/legacy/bootstrap.js');
    await startPreview();
  }).catch(error => console.error('[Story Suite] it could not start', error));
}
