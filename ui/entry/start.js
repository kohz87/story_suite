// Starts the new view's switch: draws "new view (preview)" in the extensions settings and mounts the suite on the Story Block port when ui.next is on.

import { readFlag, writeFlag } from './flag.js';
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

/**
 * Waits for the settings host, draws the switch, and mounts or removes the new view as ui.next changes.
 * Options: `StoryBlock` (the global), `doc`, `getContext` (SillyTavern's), `base` (the ui folder's URL). Resolves `{ isOn(), set(on), off() }`, or null without a context.
 */
export async function startPreview({ StoryBlock = globalThis.StoryBlock, doc = globalThis.document, getContext = () => globalThis.SillyTavern?.getContext?.(), base = new URL('../', import.meta.url).href } = {}) {
  if (!StoryBlock?.ready || !getContext()) return null;
  await StoryBlock.ready;
  const host = await waitUntil(() => doc.querySelector('#extensions_settings2') ?? doc.querySelector('#extensions_settings'));
  if (!host) return null;
  let undo = null;
  const set = on => {
    writeFlag(getContext(), on);
    if (on && !undo) undo = turnOn({ doc, base, ctx: getContext, StoryBlock });
    if (!on && undo) { undo(); undo = null; }
  };
  drawSwitch(doc, readFlag(getContext()), set);
  if (readFlag(getContext())) undo = turnOn({ doc, base, ctx: getContext, StoryBlock });
  return { isOn: () => undo !== null, set, off: () => set(false) };
}
