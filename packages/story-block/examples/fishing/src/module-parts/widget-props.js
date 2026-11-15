// What the Fishing widget is given: its prop list, props from a layout or a tab view, and the currency.
import { spotFromPlace } from '../rules.js';
import { sliceOf, openLine } from './shared-slice.js';

// What the widget takes; each is optional and is looked up by query when left out.
export const WIDGET_PROPS = Object.freeze({
    place: 'scene place { name, kind, region }',
    spot: 'where to fish { name, kind: river|lake|sea }',
    session: 'the open line { id, spot, bait, bite, window } or null',
    log: 'catches, newest first',
    last: 'the latest catch',
    currency: 'a currency for showing values',
});

/** Props for a placed widget: what the layout gave, the rest from queries. */
export function widgetProps(props = {}, api = {}, sdk = null) {
    const ask = (name, args) => {
        try {
            return (api?.query ?? sdk?.query)?.(name, args) ?? null;
        } catch {
            return null;
        }
    };
    const place = props.place !== undefined ? props.place : ask('scene.place');
    const log = Array.isArray(props.log) ? props.log : (ask('fishing.log') ?? []).slice().reverse();
    return {
        place,
        spot: props.spot ?? spotFromPlace(place),
        session: props.session !== undefined ? props.session : ask('fishing.session'),
        log,
        last: props.last ?? log[0] ?? null,
        currency: props.currency ?? currencyOf(sdk),
    };
}

/** The widget's props from a tab view: where to fish, the open line, the log, the currency. */
export function fishingProps(view, sdk = null) {
    const fishing = sliceOf(view?.state);
    const ask = (name, args) => {
        try {
            return (view?.query ?? sdk?.query)?.(name, args) ?? null;
        } catch {
            return null;
        }
    };
    const place = ask('scene.place') ?? view?.state?.domains?.scene?.place ?? null;
    return {
        place,
        spot: spotFromPlace(place),
        session: openLine(fishing),
        log: fishing.log.slice().reverse(),
        last: fishing.log.length ? fishing.log[fishing.log.length - 1] : null,
        currency: currencyOf(sdk),
    };
}

// The `currency` hook (SPEC §6) of whichever module offers one, for showing values; null when none.
// Values themselves are always whole numbers of the smallest coin, so they never depend on this.
export function currencyOf(sdk) {
    try {
        for (const mod of sdk?.modules?.() ?? []) {
            const hook = mod?.hooks?.currency;
            if (typeof hook === 'function') {
                const currency = hook();
                if (currency && typeof currency === 'object') return currency;
            }
        }
    } catch { /* no currency: plain numbers */ }
    return null;
}
