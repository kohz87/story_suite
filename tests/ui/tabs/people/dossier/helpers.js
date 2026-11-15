import { dossierFor } from '../../../../../ui/fixtures/dossier.js';
import { createFakePort } from '../../../../../ui/port/fake-port.js';
import { createPrefs } from '../../../../../ui/runtime/prefs.js';

export const dossier = id => dossierFor(id);

/** Builds a ctx with a fake port that records commands, real prefs, and a recorded go(). */
export function makeCtx(extra = {}) {
  const port = createFakePort();
  const calls = { go: [] };
  const sent = () => port.recorded?.map(e => [e.type, e.payload]) ?? [];
  return { port, prefs: createPrefs({ chatId: 'dossier-test' }), calls, sent, go: (tab, args) => calls.go.push([tab, args]), ...extra };
}
