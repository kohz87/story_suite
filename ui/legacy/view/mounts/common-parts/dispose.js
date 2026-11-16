// Mounts: what the renderer left behind for an element, and running it when the element is drawn again.

export const disposers = new WeakMap();

/** Runs whatever the renderer left behind for `el` (a dispose function or { destroy }). */
export function dispose(el) {
    const done = disposers.get(el);
    disposers.delete(el);
    if (done) {
        try { done(); } catch { /* a renderer's cleanup failing must not block the next draw */ }
    }
}
