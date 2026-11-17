// Starts the view: mounts the new view on the Story Block port, unless this device chose the old view (then only the way back is drawn).

import { readOldView, writeOldView, NEW_VIEW_CLASS } from './flag.js';
import { drawSwitch } from './switch.js';
import { turnOn } from './turn-on.js';

const WAIT_MS = 15000;
const POLL_MS = 50;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitUntil(check, timeoutMs = WAIT_MS, everyMs = POLL_MS) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = check();
    if (value) return value;
    if (Date.now() >= end) return null;
    await sleep(Math.min(everyMs, Math.max(0, end - Date.now())));
  }
}

/** Before boot: hides the old view's chat furniture from the first paint unless this device chose the old view. Returns true when the new view will show. */
export function firstPaint(doc = globalThis.document, storage) {
  const next = !readOldView(storage);
  if (next) doc?.body?.classList.add(NEW_VIEW_CLASS);
  return next;
}

/**
 * Mounts the new view once Story Block is ready, or, when this device chose the old view, leaves the old view showing and draws
 * the way back in the extension settings. Options: `StoryBlock` (the global), `doc`, `getContext` (SillyTavern's), `base` (the ui
 * folder's URL), `storage` (this device's, for the choice). Resolves `{ isOn(), useOldView(on) }`, or null without a context.
 */
export async function startView({ StoryBlock = globalThis.StoryBlock, doc = globalThis.document, getContext = () => globalThis.SillyTavern?.getContext?.(), base = new URL('../', import.meta.url).href, storage } = {}) {
  if (!StoryBlock?.ready || !getContext()) { doc?.body?.classList.remove(NEW_VIEW_CLASS); return null; }
  await StoryBlock.ready;
  let undo = null;
  let row = null;
  let chosen = readOldView(storage);   // kept here too, so a device with no storage still gets its way back
  const mount = () => {
    try { undo = turnOn({ doc, base, ctx: getContext, StoryBlock, onOldView: on => useOldView(on) }); } catch (error) {
      undo = null;
      doc.body.classList.remove(NEW_VIEW_CLASS);
      console.error('[Story Suite] the view could not be shown; the old view stays', error);
    }
  };
  // The way back: drawn once the extension settings exist, and only while the old view is still the choice.
  const wayBack = async () => {
    if (!(await waitUntil(() => doc.querySelector('#extensions_settings2') ?? doc.querySelector('#extensions_settings')))) return;
    if (chosen && !undo) row = drawSwitch(doc, true, useOldView);
  };
  function useOldView(on) {
    chosen = Boolean(on);
    writeOldView(on, storage);
    if (on && undo) { undo(); undo = null; return wayBack(); }
    if (!on && !undo) { row?.remove(); row = null; mount(); }
    return null;
  }
  if (chosen) { doc.body.classList.remove(NEW_VIEW_CLASS); await wayBack(); } else mount();
  return { isOn: () => undo !== null, useOldView };
}
