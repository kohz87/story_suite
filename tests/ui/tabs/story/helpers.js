import { createPrefs } from '../../../../ui/runtime/prefs.js';

/** Builds a ctx with real prefs and recorded go(), command() and refresh() calls for the Story tab tests. */
export function makeCtx() {
  const calls = { go: [], command: [], refresh: [] };
  return {
    prefs: createPrefs({ chatId: 't' }),
    calls,
    go: (tab, args) => calls.go.push([tab, args]),
    command: (name, payload) => calls.command.push([name, payload]),
    refresh: v => calls.refresh.push(v),
  };
}
