/* NPC State Delta dossier screens part: the sideways swipe: its threshold, the step it reads and the touch binding. */

export const SWIPE_MIN_PX = 48;

// A sideways swipe of at least SWIPE_MIN_PX that is mostly horizontal: swipe left = next section (+1), right = previous (-1).
export function swipeStep(dx, dy, { min = SWIPE_MIN_PX } = {}) {
    if (Math.abs(dx) < min || Math.abs(dx) <= Math.abs(dy) * 1.5) return 0;
    return dx < 0 ? 1 : -1;
}

// Wires touch swipes on one element; onStep receives +1 or -1. Returns the unbind function.
export function bindSwipe(element, onStep) {
    if (!element || typeof element.addEventListener !== 'function') return () => {};
    let start = null;
    const onStart = (event) => {
        const touch = event.touches?.[0];
        start = touch ? { x: touch.clientX, y: touch.clientY } : null;
    };
    const onEnd = (event) => {
        const touch = event.changedTouches?.[0];
        const from = start;
        start = null;
        if (!from || !touch) return;
        const step = swipeStep(touch.clientX - from.x, touch.clientY - from.y);
        if (step) onStep(step);
    };
    const onCancel = () => { start = null; };
    element.addEventListener('touchstart', onStart, { passive: true });
    element.addEventListener('touchend', onEnd, { passive: true });
    element.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
        element.removeEventListener('touchstart', onStart);
        element.removeEventListener('touchend', onEnd);
        element.removeEventListener('touchcancel', onCancel);
    };
}
