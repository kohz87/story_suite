// The start page slot (views/route.js PAGES): what the Studio shows before a pack is open. A stub until ST-START-PAGE adds New world
// and New game: today it has the Open button.

import { h } from '../../ui/kit/dom.js';

/** `ctx`: `{ pick() }`, which opens the file picker. Returns the page's nodes. */
export function renderPage(ctx) {
    return [h('button', { type: 'button', class: 'btn2 pri st-start', onClick: () => ctx.pick() }, 'Open a pack…')];
}
