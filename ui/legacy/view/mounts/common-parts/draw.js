// Mounts: resolving a screen and its data against a state and drawing it into an element.

import { themeVars } from '../../css.js';
import { resolveData } from '../../screens.js';
import { documentOf } from './head-state.js';
import { disposers, dispose } from './dispose.js';
import { make } from './dom.js';

const themed = new WeakMap();      // el → the theme properties last set on it

function problem(el, doc, message) {
    dispose(el);
    const line = make(doc, 'p', 'ss-mount-problem', message);
    line.setAttribute('role', 'note');
    el.replaceChildren(line);
    return { ok: false, message };
}

/**
 * Draws screen `screenId` into `el` for `mount`.
 * ctx: { deps, state, changes = [], draft = null, index = null, screen = <override, e.g. a wizard step>, keep = false }
 * `keep`: the element's own view is updated in place where the renderer can do that (a template's view keeps its
 * controls, so the focus in them stays); a layout, or a screen with no keep, is drawn again from nothing.
 * → { ok: true, screen, scope, problems } | { ok: false, message }
 */
export function drawScreen(el, screenId, mount, { deps, state, changes = [], draft = null, index = null, screen: override = null, extra = null, keep = false }) {
    const doc = documentOf(deps);
    const resolved = deps.screens.resolve(screenId);
    if (!resolved?.screen) {
        const why = resolved?.fallbacks?.length ? ` ${resolved.fallbacks[resolved.fallbacks.length - 1].reason}` : '';
        return problem(el, doc, `The screen "${screenId}" cannot be shown.${why}`);
    }
    const screen = resolved.screen;
    if (!screen.mounts.includes(mount)) return problem(el, doc, `The screen "${screenId}" is not made to be shown as a ${mount}.`);

    const data = resolveData(screen.data, (name, args) => deps.query(name, args, state));
    if (!data.ok) return problem(el, doc, `The screen "${screenId}" cannot be shown: ${data.message}`);

    el.setAttribute('data-ss-screen', screenId);
    el.setAttribute('data-ss-mount', mount);
    // The same element may show another screen later (the game view's body): drop the last one's theme.
    for (const key of themed.get(el) ?? []) el.style.removeProperty?.(key);
    // Only values that pass css.js's checks are set (screens.js already refused a screen with others).
    const theme = themeVars(screen.theme ?? {}).vars;
    for (const [key, value] of theme) el.style.setProperty(key, value);
    themed.set(el, theme.map(([key]) => key));

    const scope = {
        state,
        q: data.q,
        draft,
        // The settings of the module the screen belongs to (its id's namespace, `example-module/party`).
        settings: typeof deps.settings === 'function' ? deps.settings(screenId) : (deps.settings ?? {}),
        changes: [...changes],
        mount,
        index,
        screenId,
        api: deps.api ?? {},
        // Templates call query(name, args) themselves (e.g. a portrait per person), at this state.
        query: (name, args) => deps.query(name, args, state),
        ...(extra ?? {}),
    };
    const drawn = override ?? screen;
    if (!(keep && typeof drawn.template === 'string' && !drawn.layout)) dispose(el);
    try {
        const out = deps.render(el, drawn, scope);
        if (typeof out === 'function') disposers.set(el, out);
        else if (out && typeof out.destroy === 'function') disposers.set(el, () => out.destroy());
    } catch (error) {
        return problem(el, doc, `The screen "${screenId}" could not be drawn: ${error?.message ?? String(error)}`);
    }
    return { ok: true, screen, scope, problems: data.problems };
}
