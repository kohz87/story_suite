import { createPrefs } from '../../../../ui/runtime/prefs.js';

/** Builds a ctx with real prefs and a recorded go() for the Now tab tests. */
export function makeCtx() {
  const went = [];
  const prefs = createPrefs({ chatId: 't' });
  return { prefs, went, go: (tab, args) => went.push(args ? [tab, args] : tab) };
}
