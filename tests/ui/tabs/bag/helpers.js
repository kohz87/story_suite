import { createPrefs } from '../../../../ui/runtime/prefs.js';

/** Builds a bag ctx with real prefs, a recorded port.command and recorded sheets. */
export function makeCtx() {
  const sent = [];
  const sheets = [];
  return {
    sent, sheets,
    prefs: createPrefs({ chatId: 't' }),
    members: { astra: 'Astra', brann: 'Brann', rika: 'Rika', torka: 'Torka' },
    port: { command: (type, payload) => { sent.push([type, payload]); return Promise.resolve({ ok: true }); } },
    openSheet: (el, label) => sheets.push([el, label]),
    close: () => sent.push(['close']),
  };
}
