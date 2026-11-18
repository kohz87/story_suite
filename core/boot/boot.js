// Story Block v2 for SillyTavern (docs/v2/SPEC.md): the host Story Suite's modules register with.
//
// This file only wires SillyTavern to the v2 runtime (src/v2/runtime.js) and starts the host's page parts; the view is
// ui/entry/start.js (root index.js starts it after this). v1's code is not in this repository; it lives on the `v1` branch.
//
// Order of things:
// 1. `globalThis.StoryBlock = { apiVersion: 2, ready, sdk, api }` is set at once (`api`: the public API, docs/v2/PUBLIC-API.md), so a module loaded before
//    or after this file finds it; `ready` resolves to the sdk once the host is up (step 4).
// 2. The runtime: registry with the core module (scene, inventory, packs, events, standard widgets),
//    settings under extension_settings.storySuite, the store over the chat, the command bus, the turn.
// 3. The turn is installed: the generate interceptor named in manifest.json, the prompt and message
//    events, and the v1 prompt keys cleared.
// 4. The host's page parts (card offer, save points, the Tools page's parts, the RPG's fight parts), the modules, then markReady().

import { createRuntime, HOST_VERSION } from '../runtime.js';
import { SUITE_VERSION } from '../version.js';
import { INTERCEPTOR_NAME } from '../turn.js';
import { noteError, noteSaveError } from '../diagnostics.js';
import { registerSbMacro } from '../runtime/sb-macro.js';
import { BUILTIN_MODULES } from '../modules-list.js';
import { registerIsolated, startIsolated } from './register-isolated.js';
import { packs as livePacks, part as livePacksPart, portraits as livePortraits, refreshLore, resolveItem, startState } from '../../packs/index.js';
import { startHostParts } from './host-parts.js';
import { startToolsParts } from './tools-parts.js';
import { startRpgLive } from '../../modules/rpg/live/sync.js';
import { createToolsHandle } from '../../ui/port/tools-handle.js';

const LOG = '[Story Block v2]';
export const OLD_COPY = 'Disable the old Story Block, Story Director and NPC State Delta: Story Suite replaces all three.';

/**
 * Starts Story Suite: one call from the root index.js. Resolves true once the host is up; false when it did not start.
 * `late` lists parts that start after every module, each `{ id, name, start }`; one that throws is reported as a Problem and the rest go on.
 */
export async function boot({ late = [] } = {}) {
    // An old Story Block still enabled shares the settings tree and the interceptor name: say so once and stay out of its way.
    if (globalThis.StoryBlock) {
        console.error(`${LOG} ${OLD_COPY}`);
        noteError([`${LOG} ${OLD_COPY}`]);
        try { globalThis.toastr?.error?.(OLD_COPY, 'Story Suite'); } catch { /* no toastr */ }
        return false;
    }
    const ctx = globalThis.SillyTavern?.getContext?.();
    if (!ctx) {
        console.error(`${LOG} SillyTavern's context is not available; Story Block did not start.`);
        return false;
    }
    let parts = null;
    let tools = null;
    const runtime = createRuntime({
        ctx,
        packs: { part: livePacksPart, packs: livePacks, resolveItem, startState },
        onSaveError: error => {
            noteSaveError(error);
            globalThis.toastr?.error?.(`The story could not be saved: ${error?.message ?? error}`, 'Story Block');
        },
    });
    const { sdk, api, turn, markReady } = runtime;
    // `writes` is for the Story Suite view only (the Models page); the public sdk reads settings but has no setter.
    globalThis.StoryBlock = Object.freeze({ apiVersion: 2, version: HOST_VERSION, ready: sdk.ready, sdk, api, writes: runtime.writes, tools: createToolsHandle({ runtime, toolsParts: () => tools, savePoints: () => parts?.savePoints ?? null }) });

    turn.install({ globalName: INTERCEPTOR_NAME });
    turn.onChatChanged().catch(error => console.warn(`${LOG} the first chat could not be read`, error));
    parts = startHostParts({ runtime, ctx });
    tools = startToolsParts({ runtime, ctx, version: SUITE_VERSION, cardLog: parts.cardLog });
    try {
        startRpgLive({ runtime, ctx });
    } catch (error) {
        console.error(`${LOG} the RPG's fight parts could not start`, error);
    }
    parts.refreshOffer();
    const types = ctx.eventTypes ?? ctx.event_types ?? {};
    // The open character's lorebook `market:` lines (PACKS.md "Markets"), read for each chat.
    const readLore = () => refreshLore().catch(error => console.warn(`${LOG} the lorebook's market lines could not be read`, error));
    if (types.CHAT_CHANGED) ctx.eventSource?.on?.(types.CHAT_CHANGED, readLore);
    readLore();
    // Cast portraits are files on the server: the ones that went missing (a cleaned user-files folder) answer nothing until imported again.
    livePortraits.verify().catch(error => console.warn(`${LOG} the pack portraits could not be checked`, error));
    // `{{sb::path}}` for SillyTavern's prompts, regex scripts and status bars (src/v2/sb-macro.js), registered once.
    registerSbMacro({ ctx, api });
    // The modules after the core one, in the fixed order of core/modules-list.js; one that fails is switched off and the rest start.
    for (const mod of BUILTIN_MODULES) await registerIsolated(runtime, mod);
    markReady();
    for (const part of late) await startIsolated(runtime, part);
    console.info(`Story Suite ${SUITE_VERSION} ready`);
    return true;
}
