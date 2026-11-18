// Story Suite: the one entry SillyTavern loads (manifest.json "js"). It starts the host and its modules, then the view.

import { boot } from './core/boot/boot.js';
import { startView, firstPaint } from './ui/entry/start.js';
import { NEW_VIEW_CLASS } from './ui/entry/flag.js';

if (globalThis.SillyTavern) {
  // The new view is the default: the old view's chat furniture is hidden from the first paint, unless this device chose the old view.
  firstPaint();
  // The people part (NPC State) is the last built-in module (modules/people/module.js); if it fails to start, that is a Problem in Diagnostics and the view still starts.
  boot().then(async started => {
    if (started) await startView();
    else globalThis.document?.body?.classList.remove(NEW_VIEW_CLASS);
  }).catch(error => {
    globalThis.document?.body?.classList.remove(NEW_VIEW_CLASS);
    console.error('[Story Suite] it could not start', error);
  });
}
