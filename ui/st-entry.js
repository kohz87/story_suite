// Staging entry for the preview extension: waits for Story Block, adds the "new view (preview)" switch, and mounts the suite on the Story Block port when ui.next is on.

import { readFlag, writeFlag } from './entry/flag.js';
import { drawSwitch } from './entry/switch.js';
import { turnOn } from './entry/turn-on.js';

const USE_GLOBAL_STORY_BLOCK = Symbol('use globalThis.StoryBlock');
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
 * Starts the preview: waits for Story Block and the settings host, draws the switch, and mounts or removes the new view as ui.next changes.
 * Options: `doc`, `getContext` (SillyTavern's), `StoryBlock`, `base` (this folder's URL). Resolves `{ isOn(), set(on), off() }`, or null without Story Block.
 */
export async function startPreview({ doc = globalThis.document, getContext = () => globalThis.SillyTavern?.getContext?.(), StoryBlock = USE_GLOBAL_STORY_BLOCK, base = new URL('./', import.meta.url).href } = {}) {
  const block = StoryBlock === USE_GLOBAL_STORY_BLOCK ? await waitUntil(() => globalThis.StoryBlock) : StoryBlock;
  if (!block?.ready || !getContext()) return null;
  await block.ready;
  const host = await waitUntil(() => doc.querySelector('#extensions_settings2') ?? doc.querySelector('#extensions_settings'));
  if (!host) return null;
  let undo = null;
  const set = on => {
    const ctx = getContext();
    writeFlag(ctx, on);
    if (on && !undo) undo = turnOn({ doc, base, ctx: getContext, StoryBlock: block });
    if (!on && undo) { undo(); undo = null; }
  };
  drawSwitch(doc, readFlag(getContext()), set);
  if (readFlag(getContext())) undo = turnOn({ doc, base, ctx: getContext, StoryBlock: block });
  return { isOn: () => undo !== null, set, off: () => set(false) };
}

if (globalThis.SillyTavern) {
  startPreview().catch(error => console.warn('[Story Suite preview] the new view could not start', error));
}
