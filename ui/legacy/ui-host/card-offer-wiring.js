// Story Block v2's page furniture: the card offer's wiring, moved out of mountUi unchanged: the offer reads the character's lorebook, remembers "not now",
// enables the data modules, and tells its problems to the turn's list and the card log (`cardLog`, shown in Diagnostics).
import { createCardOffer, enableDataModules } from '../../../packs/card-offer.js';
import { setLiveOffer } from '../../port/live-offer.js';

export function createCardOfferWiring({ runtime, ctx, sdk, store, liveCtx, readLorebook, flushSettings, cardLog }) {
    const offer = runtime.packs?.packs && runtime.cardSettings ? createCardOffer({
        readLorebook,
        packs: runtime.packs.packs,
        cardSettings: runtime.cardSettings,
        remember: {
            read: () => ctx.extensionSettings?.storySuite?.cardOffers?.notNow ?? {},
            write: map => {
                const es = ctx.extensionSettings ?? {};
                if (!es.storySuite || typeof es.storySuite !== 'object') es.storySuite = {};
                if (!es.storySuite.cardOffers || typeof es.storySuite.cardOffers !== 'object') es.storySuite.cardOffers = {};
                es.storySuite.cardOffers.notNow = map;
                ctx.saveSettingsDebounced?.();
            },
        },
        single: () => !(liveCtx()?.groupId),
        enableModules: (packId, options) => enableDataModules({ sdk, packId, save: () => store.saveSoon?.(), ...options }),
        chatId: () => { try { return String((typeof (liveCtx() ?? ctx).getCurrentChatId === 'function' ? (liveCtx() ?? ctx).getCurrentChatId() : (liveCtx() ?? ctx).chatId) ?? ''); } catch { return ''; } },
        notify: text => globalThis.toastr?.warning?.(text, 'Story Block'),
        flushSettings: () => flushSettings(),
        report: entry => {
            cardLog.push(entry.message);
            if (cardLog.length > 30) cardLog.shift();
            runtime.turn?.report?.({ module: null, code: entry.code, message: entry.message, quiet: true });
        },
    }) : null;
    // The new view reads the same controller (ui/port/live-offer.js).
    setLiveOffer(offer);
    return offer;
}
