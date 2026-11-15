// The one piece of DOM: a capped list and the Show all / Show less button that opens and shuts it.

import { STRINGS } from '../../strings.js';
import { CAP_CLASS } from './names.js';

// Which cards are open, by key (`story-block/home:quests`): kept for the page, so a redraw (a new head, a commit) does not fold a
// card the reader opened. A key is given by the card that draws the toggle; without one the state is the toggle's own.
const OPEN = new Map();

/** A list that is capped, and the button that opens and shuts it (`key`: the card's name, kept across redraws). → { button, refresh(), destroy() }. */
export function capToggle(doc, target, { key = '', more = STRINGS.showMore.more, less = STRINGS.showMore.less } = {}) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'ss-button sb-show-more';
    button.setAttribute('aria-expanded', 'false');
    button.hidden = true;
    target.classList.add(CAP_CLASS);
    let expanded = key ? OPEN.get(key) === true : false;
    const paint = () => {
        target.setAttribute('data-capped', expanded ? 'false' : 'true');
        button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        button.textContent = expanded ? less : more;
    };
    // Taller than the cap now? (A layout with no size, as in a test, is never taller.)
    const refresh = () => {
        const over = Number(target.scrollHeight) > Number(target.clientHeight) + 1;
        button.hidden = !over && !expanded;
    };
    button.addEventListener('click', () => {
        expanded = !expanded;
        if (key) OPEN.set(key, expanded);
        paint();
        refresh();
    });
    paint();
    // A resize of the card (a window, the story panel, a phone turned) can make the list taller or shorter than the cap: check again.
    // Guarded: a host without ResizeObserver keeps the check at each draw and each resize of the window (the widget's listener).
    const RO = doc.defaultView?.ResizeObserver ?? globalThis.ResizeObserver;
    let observer = null;
    if (typeof RO === 'function') {
        try { observer = new RO(() => refresh()); observer.observe(target); } catch { observer = null; }
    }
    return {
        button,
        refresh,
        destroy: () => { observer?.disconnect?.(); observer = null; button.remove(); },
    };
}
