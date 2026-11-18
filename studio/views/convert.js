// The Convert page slot (views/route.js PAGES): a card at the top of Overview for a format 3 pack, which the Studio opens read-only.
// A stub until ST-CONV adds "Convert to format 4": today it says why the pack cannot be edited, in a settings row.

import { h } from '../../ui/kit/dom.js';

/** `ctx`: the page context (views/route.js); `ctx.doc` is the format 3 pack. Returns the card. */
export function renderPage(ctx) {
    const format = typeof ctx.doc?.format === 'number' ? `format ${ctx.doc.format}` : 'an older format';
    return [h('section', { class: 'sgrp st-convert' }, h('div', { class: 'srow wide' }, h('div', { class: 'lb' },
        h('b', `This pack is ${format}, so it opens read-only`),
        h('small', 'The Studio writes pack format 4: a world pack and a game pack. You can look through this pack and export it as it is.'))))];
}
