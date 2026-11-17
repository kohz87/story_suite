// Story Suite: the one entry SillyTavern loads (manifest.json "js"). It starts the host and its modules, then the people part, then the view.

import { boot } from './core/boot/boot.js';
import { startView } from './ui/entry/start.js';
import { readOldView, NEW_VIEW_CLASS } from './ui/entry/flag.js';

if (globalThis.SillyTavern) {
  // The new view is the default: the old view's chat furniture is hidden from the first paint, unless this device chose the old view.
  if (!readOldView()) globalThis.document?.body?.classList.add(NEW_VIEW_CLASS);
  // The people part (NPC State) starts after every other module, as it always did; if it fails, that is a Problem in Diagnostics and the view still starts.
  const late = [{ id: 'people', name: 'NPC State', start: async () => (await import('./modules/people/legacy/bootstrap.js')).startPeople() }];
  boot({ late }).then(async started => {
    if (started) await startView();
    else globalThis.document?.body?.classList.remove(NEW_VIEW_CLASS);
  }).catch(error => {
    globalThis.document?.body?.classList.remove(NEW_VIEW_CLASS);
    console.error('[Story Suite] it could not start', error);
  });
}
