// Two host parts the view reads, built once at boot: the card-offer controller and the save points (one controller and one save-points
// lock per chat).
import { createSavePoints } from '../timeline/rewind.js';
import { createCardOfferWiring } from '../../packs/card-offer-wiring.js';
import { readCharacterLorebook, saveSettingsNow } from '../../packs/st-adapter.js';
import { setLiveOffer } from '../../ui/port/live-offer.js';

const WARN = '[Story Suite] the card offer could not be read';

/**
 * `startHostParts({ runtime, ctx, readLorebook?, flushSettings? })` → `{ cardOffer (or null: no packs or no card settings), cardLog, savePoints, refreshOffer(), stop() }`.
 * The offer is read again for each chat that opens and its "Installed …" line goes after the next reply; `refreshOffer()` is the first read (boot calls it once the page is up).
 */
export function startHostParts({ runtime, ctx, readLorebook = readCharacterLorebook, flushSettings = saveSettingsNow }) {
    const { store, sdk, events } = runtime;
    const liveCtx = () => globalThis.SillyTavern?.getContext?.() ?? ctx;
    const cardLog = [];
    const cardOffer = createCardOfferWiring({ runtime, ctx, sdk, store, liveCtx, readLorebook, flushSettings, cardLog });
    setLiveOffer(cardOffer);
    const savePoints = createSavePoints({ ctx, store, live: liveCtx, story: () => sdk.query?.('director.time', {})?.text ?? '', ...(runtime.createBranch ? { createBranch: runtime.createBranch } : {}) });
    const refreshOffer = () => { cardOffer?.refresh().catch(error => console.warn(WARN, error)); };
    const offs = [];
    const types = ctx.eventTypes ?? ctx.event_types ?? {};
    if (cardOffer && typeof ctx.eventSource?.on === 'function' && types.CHAT_CHANGED) {
        ctx.eventSource.on(types.CHAT_CHANGED, refreshOffer);
        offs.push(() => (ctx.eventSource.removeListener ?? ctx.eventSource.off)?.call(ctx.eventSource, types.CHAT_CHANGED, refreshOffer));
    }
    // The "Installed …" notice stays for one reply.
    if (cardOffer && typeof events?.on === 'function') offs.push(events.on('turn', () => cardOffer.clearDone()));
    return { cardOffer, cardLog, savePoints, refreshOffer, stop() { offs.splice(0).forEach(off => off?.()); } };
}
