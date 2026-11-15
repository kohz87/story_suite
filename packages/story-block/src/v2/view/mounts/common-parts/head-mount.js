// Mounts: following the head-changing events, and one head-state mount of a screen into an element.

import { headState, headIndexOf } from './head-state.js';
import { dispose } from './dispose.js';
import { drawScreen } from './draw.js';

/** Subscribes `fn` to the head-changing events when the wiring gave an `on`; returns one unsubscribe. */
export function onHead(deps, fn) {
    if (typeof deps.on !== 'function') return () => {};
    const offs = ['head', 'committed'].map(event => deps.on(event, fn)).filter(off => typeof off === 'function');
    return () => offs.forEach(off => off());
}

/** A head-state mount of one screen into `el` (tab, hud item, the game view's body). */
export function mountHead(deps, mount, el, screenId, opts = {}) {
    const merged = { ...deps, ...opts };
    const draw = state => drawScreen(el, screenId, mount, {
        deps: merged,
        state: state ?? headState(merged),
        changes: [],
        index: headIndexOf(merged),
    });
    let result = draw(opts.state);
    return {
        el,
        screenId,
        get result() { return result; },
        /** Redraws with `state`, or the current head. */
        update(state = null) { result = draw(state); return result; },
        unmount() { dispose(el); el.replaceChildren(); },
    };
}
