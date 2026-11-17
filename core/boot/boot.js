// Story Block v2 for SillyTavern (docs/v2/SPEC.md): the host Story Suite's modules register with.
//
// This file only wires SillyTavern to the v2 runtime (src/v2/runtime.js) and puts the host's UI on the
// page (src/v2/ui-host.js). v1's code is not in this repository; it lives on the `v1` branch.
//
// Order of things:
// 1. `globalThis.StoryBlock = { apiVersion: 2, ready, sdk, api }` is set at once (`api`: the public API, docs/v2/PUBLIC-API.md), so a module loaded before
//    or after this file finds it; `ready` resolves to the sdk once the host is up (step 4).
// 2. The runtime: registry with the core module (scene, inventory, packs, events, standard widgets),
//    settings under extension_settings.storySuite, the store over the chat, the command bus, the turn.
// 3. The turn is installed: the generate interceptor named in manifest.json, the prompt and message
//    events, and the v1 prompt keys cleared.
// 4. The UI (bar, story panel, settings overlay, drawer, mounts), then markReady().

import { createRuntime, HOST_VERSION } from '../runtime.js';
import { SUITE_VERSION } from '../version.js';
import { INTERCEPTOR_NAME } from '../turn.js';
import { mountUi } from '../../ui/legacy/ui-host.js';
import { noteError, noteSaveError } from '../diagnostics.js';
import { createV1Watch } from '../persist/v1-copy.js';
import { registerSbMacro } from '../runtime/sb-macro.js';
import { BUILTIN_MODULES } from '../modules-list.js';
import { registerIsolated, startIsolated } from './register-isolated.js';
import { packs as livePacks, part as livePacksPart, portraits as livePortraits, refreshLore, resolveItem, startState } from '../../packs/index.js';
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
    let ui = null;
    const runtime = createRuntime({
        ctx,
        packs: { part: livePacksPart, packs: livePacks, resolveItem, startState },
        onBlocked: (reason, moduleId) => ui?.blocked(reason, moduleId),
        onSaveError: error => {
            noteSaveError(error);
            globalThis.toastr?.error?.(`The story could not be saved: ${error?.message ?? error}`, 'Story Block');
        },
        onRegister: () => ui?.syncScreens(),
    });
    const { sdk, api, turn, markReady } = runtime;
    // (An old v1 copy loaded before this one left its own object here: src/v2/v1-copy.js.)
    const before = globalThis.StoryBlock ?? null;
    // `writes` is for the Story Suite view only (the Models page); the public sdk reads settings but has no setter.
    globalThis.StoryBlock = Object.freeze({ apiVersion: 2, version: HOST_VERSION, ready: sdk.ready, sdk, api, writes: runtime.writes, tools: createToolsHandle({ runtime, ui: () => ui }) });
    const v1 = createV1Watch({ before, report: entry => turn.report(entry), problems: () => turn.problems() });
    const lookForV1 = () => { try { v1.check(); } catch { /* never in the way of the story */ } };

    turn.install({ globalName: INTERCEPTOR_NAME });
    turn.onChatChanged().catch(error => console.warn(`${LOG} the first chat could not be read`, error));
    try {
        ui = mountUi({ runtime, ctx, version: SUITE_VERSION });
    } catch (error) {
        console.error(`${LOG} the Story Suite UI could not be shown`, error);
    }
    // A pack installed or switched on changes the screens and the start of new chats.
    livePacks.subscribe?.(() => ui?.syncScreens());
    const types = ctx.eventTypes ?? ctx.event_types ?? {};
    if (types.APP_READY) ctx.eventSource?.on?.(types.APP_READY, () => { ui?.refresh(); lookForV1(); });
    // The open character's lorebook `market:` lines (PACKS.md "Markets"), read for each chat.
    const readLore = () => refreshLore().catch(error => console.warn(`${LOG} the lorebook's market lines could not be read`, error));
    if (types.CHAT_CHANGED) ctx.eventSource?.on?.(types.CHAT_CHANGED, () => { ui?.clearBlocked(); ui?.refresh(); readLore(); lookForV1(); });
    readLore();
    // Cast portraits are files on the server: the ones that went missing (a cleaned user-files folder) answer nothing until imported again.
    livePortraits.verify().catch(error => console.warn(`${LOG} the pack portraits could not be checked`, error));
    lookForV1();
    // `{{sb::path}}` for SillyTavern's prompts, regex scripts and status bars (src/v2/sb-macro.js), registered once.
    registerSbMacro({ ctx, api });
    // The modules after the core one, in the fixed order of core/modules-list.js; one that fails is switched off and the rest start.
    for (const mod of BUILTIN_MODULES) await registerIsolated(runtime, mod);
    markReady();
    for (const part of late) await startIsolated(runtime, part);
    console.info(`Story Suite ${SUITE_VERSION} ready`);
    return true;
}
