// Staging entry for the preview extension: waits for Story Block, adds the "new view (preview)" switch, and mounts the suite on the Story Block port when ui.next is on.

import { readFlag, writeFlag } from './entry/flag.js';
import { drawSwitch } from './entry/switch.js';
import { turnOn } from './entry/turn-on.js';

/**
 * Starts the preview: waits for `StoryBlock.ready`, draws the switch, and mounts or removes the new view as ui.next changes.
 * Options: `doc`, `getContext` (SillyTavern's), `StoryBlock`, `base` (this folder's URL). Resolves `{ isOn(), set(on), off() }`, or null without Story Block.
 */
export async function startPreview({ doc = globalThis.document, getContext = () => globalThis.SillyTavern?.getContext?.(), StoryBlock = globalThis.StoryBlock, base = new URL('./', import.meta.url).href } = {}) {
  if (!StoryBlock?.ready || !getContext()) return null;
  await StoryBlock.ready;
  let undo = null;
  const set = on => {
    const ctx = getContext();
    writeFlag(ctx, on);
    if (on && !undo) undo = turnOn({ doc, base, ctx: getContext, StoryBlock });
    if (!on && undo) { undo(); undo = null; }
  };
  drawSwitch(doc, readFlag(getContext()), set);
  if (readFlag(getContext())) undo = turnOn({ doc, base, ctx: getContext, StoryBlock });
  return { isOn: () => undo !== null, set, off: () => set(false) };
}

if (globalThis.SillyTavern && globalThis.StoryBlock) {
  startPreview().catch(error => console.warn('[Story Suite preview] the new view could not start', error));
}
