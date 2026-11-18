// Starts the view: mounts the new view on the Story Block port once Story Block is ready.

import { turnOn } from './turn-on.js';

/**
 * Mounts the view once Story Block is ready. Options: `StoryBlock` (the global), `doc`, `getContext` (SillyTavern's), `base` (the ui folder's URL).
 * Resolves `{ isOn(), stop() }`, or null without Story Block or a context. A view that throws while mounting is logged and leaves nothing on the page.
 */
export async function startView({ StoryBlock = globalThis.StoryBlock, doc = globalThis.document, getContext = () => globalThis.SillyTavern?.getContext?.(), base = new URL('../', import.meta.url).href } = {}) {
  if (!StoryBlock?.ready || !getContext()) return null;
  await StoryBlock.ready;
  let undo = null;
  try { undo = turnOn({ doc, base, ctx: getContext, StoryBlock }); } catch (error) {
    undo = null;
    console.error('[Story Suite] the view could not be shown', error);
  }
  return { isOn: () => undo !== null, stop() { undo?.(); undo = null; } };
}
