// Story Suite: the one entry SillyTavern loads (manifest.json "js"). It starts the host and its modules, then the view.

import { boot } from './core/boot/boot.js';
import { startView } from './ui/entry/start.js';

if (globalThis.SillyTavern) {
  // The people part (NPC State) is the last built-in module (modules/people/module.js); if it fails to start, that is a Problem in Diagnostics and the view still starts.
  boot().then(async started => {
    if (started) await startView();
  }).catch(error => {
    console.error('[Story Suite] it could not start', error);
  });
}
