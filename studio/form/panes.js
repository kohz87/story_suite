// A record editor's two panes (mock MK-2; the shell joins them, studio/wide.js): the list, and the open record or nothing. The editor
// draws both on every draw, so at 1280 px and wider the list stays beside the record; below that the shell shows one at a time.

import { h } from '../../ui/kit/dom.js';

const nodes = value => [value].flat(Infinity).filter(node => node !== null && node !== undefined && node !== false);

/**
 * The box. `spec`: `{ noun, icon, list, rec }`: `noun` and `icon` say what the empty record side holds ("No place open"); `list` the
 * list's nodes; `rec` the open record's nodes, or null when none is open.
 */
export function recordPanes({ noun, icon, list, rec = null }) {
    const open = nodes(rec).length > 0;
    return h('div', { class: 'st-panes', dataset: { noun, icon, open: String(open) } },
        h('div', { class: 'st-pane-list' }, ...nodes(list)),
        h('div', { class: 'st-pane-rec' }, ...(open ? nodes(rec) : [])));
}
