// Story Block v2's page furniture: the Lean RPG's screens, moved out of mountUi unchanged: loaded by import() only while its feature is on, mounted with
// the host's parts, and taken away when the feature goes off. `createLeanRpgSync(deps)` holds the mounted view; mountUi reads it through `getRpg()`.
import { CORE_FEATURE, GEAR_FEATURE } from '../features.js';

export function createLeanRpgSync(deps) {
    const { loadLeanRpg, doc, ctx, store, events, screens, hostWidgets, registry, runtime, liveCtx, settings, sdk, api, rpgOn, getHeadState, getMounts, getOverlay, refresh, openSettings } = deps;
    // The RPG's screens (src/v2/lean-rpg/view/): loaded by import() only while its feature is on, taken away when it goes off.
    let rpg = null, rpgLoading = false, rpgGone = false;
    function syncLeanRpg() {
        if (!rpgOn()) { rpg?.destroy(); rpg = null; return; }
        if (rpg || rpgLoading) return;
        rpgLoading = true;
        Promise.resolve().then(() => loadLeanRpg()).then(view => {
            rpgLoading = false;
            if (rpgGone || rpg || !rpgOn()) return;
            const mounts = getMounts();
            rpg = view.mountLeanRpg({ doc, ctx, store, events, screens, widgets: hostWidgets, headState: getHeadState(), featureOn: rpgOn, boardOn: () => registry.featureOn?.(CORE_FEATURE.fightBoard) === true,
                // Settings → RPG holds the gear switch (the feature stays out of the Features list).
                gear: { on: () => registry.featureOn?.(GEAR_FEATURE) === true, set: value => runtime.features?.set?.(GEAR_FEATURE, Boolean(value)) },
                boardFeature: { on: () => registry.featureOn?.(CORE_FEATURE.fightBoard) === true, set: value => runtime.features?.set?.(CORE_FEATURE.fightBoard, Boolean(value)) },
                readerName: () => String(liveCtx()?.name1 ?? ctx.name1 ?? ''),
                // The active persona's description: the one property of SillyTavern's settings this reads (never another persona or setting).
                readerAbout: () => { try { return String((liveCtx()?.powerUserSettings ?? ctx.powerUserSettings)?.persona_description ?? ''); } catch { return ''; } },
                // What the chat remembers about the first send (lean-rpg/start.js): in its own metadata, written with the chat.
                meta: () => { try { return (liveCtx() ?? ctx)?.chatMetadata ?? null; } catch { return null; } },
                save: () => { try { const c = liveCtx() ?? ctx; (c.saveMetadata ?? c.saveMetadataDebounced)?.call(c); } catch { /* the choice lasts this page only */ } },
                openDialog: (id, opts) => api.dialog.open(id, opts), openScreen: id => api.openScreen(id), closeView: () => mounts.screen.close(), currentScreen: () => mounts.screen.current?.() ?? null, refresh: () => refresh(), command: (type, payload, options) => sdk.command(type, payload, options), values: () => settings('story-block'),
                previewStart: () => runtime.turn?.fightStartPreview?.(), generateHeld: () => (liveCtx() ?? ctx)?.generate?.('regenerate'),
                query: (name, args) => { try { return sdk.query(name, args); } catch { return null; } } });
            mounts.card?.refreshAll?.({ force: true });
            // Home draws its "Your character" card from `rpg`, which is only set now: the open screen is drawn again.
            mounts.screen?.update?.();
            // The settings window was opened before the screens loaded (the reader just switched the feature on): open it again on the same
            // page, now with the RPG page in its rail.
            if (getOverlay()?.isOpen?.()) { const page = getOverlay().section(); openSettings(); getOverlay().select(page); }
        }).catch(error => { rpgLoading = false; console.warn('[Story Suite] the RPG screens could not load', error?.message ?? error); });
    }
    const getRpg = () => rpg;
    const destroy = () => { rpgGone = true; rpg?.destroy(); rpg = null; };

    return { syncLeanRpg, getRpg, destroy };
}
