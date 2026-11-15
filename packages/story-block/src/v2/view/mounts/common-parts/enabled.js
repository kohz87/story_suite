// Mounts: which screens are on now for a mount (enabled, active, alert badge).

import { headStateSafe } from './head-state.js';

export function isEnabled(deps, mount, screenId) {
    if (typeof deps.enabled === 'function') return !!deps.enabled(mount, screenId);
    if (mount === 'card') return typeof deps.screens?.cardsOn === 'function' && deps.screens.cardsOn(screenId);
    return true;
}

/**
 * The words of an alert badge, or null when the badge is no alert: text is an alert when it has any (cut to one short line), a count
 * when it is above 0 (`badge: 0` is none), `true` is one without words (''). Anything else (false, null, undefined, NaN, an object) is none.
 */
export function badgeText(badge) {
    if (badge === true) return '';
    if (typeof badge === 'number') return Number.isFinite(badge) && badge > 0 ? String(Math.floor(badge) || badge) : null;
    if (typeof badge === 'string') return badge.replace(/\s+/g, ' ').trim().slice(0, 40) || null;
    return null;
}

/**
 * Whether a screen (or a tab) is on now: its `active(state, ctx)` answer `{ on, badge? }` (ctx.query(name, args) reads the queries at
 * that state). No `active` is always on; an answer that fails is off. `alert` is true when it is on with an alert badge (`badgeText`: the
 * bar's red dot, no number is drawn); then `badge` is its words ('your move', '3', or '' for `true`) for the slot's accessible name.
 */
export function activeNow(screen, state, query) {
    if (typeof screen?.active !== 'function') return { on: true, alert: false };
    try {
        const out = screen.active(state ?? null, { query: (name, args) => query?.(name, args, state) ?? null });
        const on = out?.on === true;
        const words = on ? badgeText(out.badge) : null;
        return words === null ? { on, alert: false } : { on, alert: true, badge: words };
    } catch {
        return { on: false, alert: false };
    }
}

/** Usable screens for `mount` the reader has not turned off; on the bars ('screen', 'tab') also only those active now. */
export const screensFor = (deps, mount) => deps.screens.list(mount)
    .filter(entry => isEnabled(deps, mount, entry.id))
    .filter(entry => (mount !== 'screen' && mount !== 'tab') || activeNow(entry.screen, headStateSafe(deps), deps.query).on);
