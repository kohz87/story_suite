// Puts the New character wizard and the first-send hold on the new view: built once the suite is mounted, answering the port's
// `open('story-block/new-character', payload)` itself (the page event is then never sent), closing both sheets when the chat changes.

import { createWizardWorld } from './world.js';
import { createNewWizard, WIZARD_ID } from './wizard.js';
import { createSendHold } from './hold.js';
import { createPluginScreens } from './plugin-screen.js';

const BUSY = 'The New character window is open already.';
const OFF = 'That window is not available now.';

/**
 * `attachWizard({ doc, ctx, sdk, suite })`: `ctx()` SillyTavern's live context, `sdk` Story Block's, `suite` mountSuite's handle ({ root, backStack,
 * open, close, isOpen }). → { open(id, payload, { onEnd }) → true (opened), a refusal, or false (not this view's window), wizard, hold, destroy() }.
 */
export function attachWizard({ doc, ctx = () => null, sdk, suite, screens = null }) {
  const world = createWizardWorld({ sdk, ctx });
  const sheetCtx = () => ({ doc, backStack: suite?.backStack ?? null, sheetHost: suite?.root ?? null });
  // (the old wizard's own call: its widget's command, which the screen renderer sends with `{ cause: 'ui' }`, packs/template/render/view.js run)
  const command = (type, payload) => sdk.command(type, payload, { cause: 'ui' });
  const wizard = createNewWizard({ world, command, sheetCtx });
  const hold = createSendHold({ doc, ctx, world, wizard, suite, sheetCtx });
  hold.attach();
  const plugin = createPluginScreens({ screens, sdk, sheetCtx });
  const closeAll = () => { wizard.close(); hold.close(); plugin.close(); };
  const types = ctx()?.eventTypes ?? ctx()?.event_types ?? {};
  if (types.CHAT_CHANGED) ctx()?.eventSource?.on?.(types.CHAT_CHANGED, closeAll);

  // The window is this view's to draw: true when it opened, or a refusal ({ ok: false, message }) the port hands back without the
  // page event (a second open while one is up, or the RPG off); false for any other window.
  function open(id, payload, { onEnd = null } = {}) {
    if (id !== WIZARD_ID) {
      // (any other id: a screen a registered module declares, drawn from its widget; false when none does)
      if (!screens?.find?.(id)) return false;
      if (!suite?.isOpen?.()) suite?.open?.('party');
      return plugin.open(id, payload, { onEnd }) || { ok: false, code: 'FAILED', message: OFF };
    }
    if (wizard.isOpen()) return { ok: false, code: 'FAILED', message: BUSY };
    if (!world.rpgOn()) return { ok: false, code: 'FAILED', message: OFF };
    // (opened from the Party tab or a person's page the suite is open already; opened from elsewhere, it opens first so the sheet shows)
    if (!suite?.isOpen?.()) suite?.open?.('party');
    return wizard.open(payload && typeof payload === 'object' ? payload : null, { onEnd }) || { ok: false, code: 'FAILED', message: OFF };
  }

  return {
    open, wizard, hold,
    destroy() {
      if (types.CHAT_CHANGED) ctx()?.eventSource?.removeListener?.(types.CHAT_CHANGED, closeAll);
      hold.detach();
      wizard.close();
      plugin.close();
    },
  };
}
