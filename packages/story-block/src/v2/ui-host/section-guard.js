// The field guard for modules' sdk.panels sections (flag `suite.redrawScheduler`): a section that names its `root` (a getter for its element)
// is not drawn while a field inside that root has the focus. The draw waits for the field to lose focus, then asks the scheduler again;
// that draw looks again (a field focused again waits again). A chat switch (`guarded()` false) still draws: the field goes with the old chat.

/** Thrown out of a held-back draw: the scheduler then keeps the section's old digest, so the later draw is not skipped. */
export const HELD = Object.freeze({ held: true });

const FIELDS = ['INPUT', 'TEXTAREA', 'SELECT'];
const typingIn = el => {
    const at = el?.ownerDocument?.activeElement;
    return Boolean(at && el.contains?.(at) && (FIELDS.includes(String(at.tagName ?? '').toUpperCase()) || at.isContentEditable === true));
};

/**
 * `guardSection(section, { guarded, again })` → the section to register. `guarded()` is true unless a chat switch is drawing; `again(keys)`
 * asks the scheduler to draw the section's keys once more (it does nothing when that scheduler is gone). A section without `root` is returned as it is.
 */
export function guardSection(section, { guarded, again }) {
    if (typeof section?.root !== 'function') return section;
    const rootOf = () => { try { return section.root() ?? null; } catch { return null; } };
    let watch = null;   // { el, done, timer }
    const stop = () => {
        if (!watch) return;
        watch.el.removeEventListener?.('focusout', watch.done);
        if (watch.timer !== null) (watch.el.ownerDocument?.defaultView?.clearTimeout ?? clearTimeout)(watch.timer);
        watch = null;
    };
    const waitForBlur = el => {
        if (watch?.el === el) return;
        stop();
        const mine = { el, done: null, timer: null };
        mine.done = event => {
            // (a focus move inside the root, a field to a field or a button, is not a blur)
            if (event?.relatedTarget && el.contains?.(event.relatedTarget)) return;
            el.removeEventListener?.('focusout', mine.done);
            mine.timer = (el.ownerDocument?.defaultView?.setTimeout ?? setTimeout)(() => {
                if (watch === mine) watch = null;
                again(section.keys ?? []);
            }, 0);
        };
        watch = mine;
        el.addEventListener?.('focusout', mine.done);
    };
    const wrap = fn => typeof fn !== 'function' ? fn : (...args) => {
        const el = rootOf();
        if (guarded() && el && typingIn(el)) { waitForBlur(el); throw HELD; }
        stop();
        return fn(...args);
    };
    return { ...section, draw: wrap(section.draw), render: wrap(section.render) };
}
