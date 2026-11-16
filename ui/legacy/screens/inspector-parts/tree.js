// Draws a state value as a folding tree (hits, search, lazy opening) for the Inspector.

import { STRINGS, fill } from '../../../../../../core/strings.js';
import { pointer, preview } from '../../inspect.js';
import { cutAt } from '../../../../../../core/text.js';
import { el } from './shared-dom.js';

const S = STRINGS.inspector;

const MAX_CHILDREN = 200;     // keys of one object drawn before "…and N more"
const MAX_TEXT = 300;         // characters of one string value drawn in the tree

const kindOf = value => (value === null ? 'null' : typeof value === 'string' ? 'str' : typeof value === 'number' ? 'num' : typeof value === 'boolean' ? 'bool' : 'other');
const isBranch = value => value !== null && typeof value === 'object';

function leafText(value) {
    if (typeof value === 'string') {
        const text = value.length > MAX_TEXT ? `${cutAt(value, MAX_TEXT)}…` : value;
        return JSON.stringify(text);
    }
    if (value === undefined) return '—';
    return String(value);
}

/**
 * Draws `value` as a tree into `parent`: objects and lists fold (`<details>`), their insides drawn when
 * first opened. `ctx` = { doc, open: Set of open paths (kept by the caller), search: matchPaths() result
 * or null }. While searching, only the hits and the nodes on the way to them are drawn.
 */
export function drawTree(parent, value, ctx, path = '') {
    const { doc, open, search } = ctx;
    const entries = Object.entries(value ?? {});
    const shown = search ? entries.filter(([key]) => search.keep.has(pointer(path, key))) : entries;
    const list = shown.slice(0, MAX_CHILDREN);
    for (const [key, child] of list) {
        const at = pointer(path, key);
        const hit = Boolean(search?.matches.has(at));
        if (isBranch(child)) {
            const box = el(doc, 'details', hit ? 'sb-insp-hit' : '');
            box.setAttribute('data-path', at);
            const head = el(doc, 'summary');
            head.append(el(doc, 'span', 'sb-insp-key', key), doc.createTextNode(' '), el(doc, 'span', 'muted', preview(child)));
            const kids = el(doc, 'div', 'sb-insp-kids');
            box.append(head, kids);
            let drawn = false;
            const fillKids = () => {
                if (drawn) return;
                drawn = true;
                drawTree(kids, child, ctx, at);
            };
            // Searching: a node on the way to a hit opens (drawing only the way); a hit itself stays shut
            // and shows all of itself when opened. Otherwise what the reader opened before is open again.
            if (search ? search.ways.has(at) : open.has(at)) {
                box.setAttribute('open', '');
                fillKids();
            }
            box.addEventListener('toggle', () => {
                const isOpen = box.hasAttribute('open');
                if (isOpen) {
                    if (!search) open.add(at);
                    // Opened while searching: everything inside, not only the hits.
                    if (!drawn && search) {
                        drawn = true;
                        drawTree(kids, child, { ...ctx, search: null }, at);
                    } else fillKids();
                } else if (!search) open.delete(at);
            });
            parent.appendChild(box);
        } else {
            const row = el(doc, 'div', `sb-insp-leaf${hit ? ' sb-insp-hit' : ''}`);
            row.setAttribute('data-path', at);
            row.append(el(doc, 'span', 'sb-insp-key', key), doc.createTextNode(': '), el(doc, 'span', `sb-insp-${kindOf(child)}`, leafText(child)));
            parent.appendChild(row);
        }
    }
    if (shown.length > list.length) parent.appendChild(el(doc, 'div', 'sb-insp-leaf muted', fill(S.moreKeys, { n: shown.length - list.length })));
    if (!entries.length) parent.appendChild(el(doc, 'div', 'sb-insp-leaf muted', Array.isArray(value) ? '[]' : '{}'));
}
