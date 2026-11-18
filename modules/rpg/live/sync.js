// Starts the RPG's page parts (live/index.js) while the feature `story-block.rpg` is on, and takes them away when it goes off.
// They are loaded by import() the first time the feature is on, so with it off none of that code is fetched.
import { CORE_FEATURE } from '../../../core/features.js';

/**
 * `startRpgLive({ runtime, ctx, doc?, load? })` → `{ sync(), current(), stop() }`. Called once at boot: it mounts at once when the feature is
 * on and follows every feature change after. `current()` is the mounted parts (or null).
 */
export function startRpgLive({ runtime, ctx, doc = globalThis.document, load = () => import('./index.js') }) {
    const { registry, store, events, sdk, settings } = runtime;
    const liveCtx = () => globalThis.SillyTavern?.getContext?.() ?? ctx;
    const featureOn = () => registry.featureOn?.(CORE_FEATURE.leanRpg) === true;
    const headState = () => { const index = store.headIndex(); return Number.isInteger(index) && index >= 0 ? store.at(index) : null; };
    let parts = null, loading = false, gone = false;
    function sync() {
        if (!featureOn()) { parts?.destroy(); parts = null; return; }
        if (parts || loading) return;
        loading = true;
        Promise.resolve().then(() => load()).then(live => {
            loading = false;
            if (gone || parts || !featureOn()) return;
            parts = live.mountRpgLive({
                doc, ctx, store, events, headState, featureOn,
                readerName: () => String(liveCtx()?.name1 ?? ctx.name1 ?? ''),
                // What the chat remembers about a waiting fight: in its own metadata, written with the chat.
                meta: () => { try { return liveCtx()?.chatMetadata ?? null; } catch { return null; } },
                save: () => { try { const c = liveCtx(); (c.saveMetadata ?? c.saveMetadataDebounced)?.call(c); } catch { /* kept for this page only */ } },
                values: () => settings('story-block'),
                query: (name, args) => { try { return sdk.query(name, args); } catch { return null; } },
                interaction: sdk.interaction ?? null,
                previewStart: () => runtime.turn?.interactionStartPreview?.(),
                generateHeld: () => liveCtx()?.generate?.('regenerate'),
            });
        }).catch(error => { loading = false; console.warn('[Story Suite] the RPG parts could not load', error?.message ?? error); });
    }
    const off = events?.on?.('feature', sync);
    sync();
    return { sync, current: () => parts, stop() { gone = true; off?.(); parts?.destroy(); parts = null; } };
}
