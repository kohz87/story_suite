// Hides marker lines that have no panel to stand for, and shows them again (a panel drawn later finds them).

import { MARKER_LINE } from '../constants.js';
import { nodesOf, blank, textOf } from './shared-nodes.js';
import { markerNodes } from './find.js';

// A marker line with no panel to stand for (the reply has no recorded rolls, the feature is off) is hidden, never shown as
// text: a paragraph that holds only it is hidden, else the line is put in a hidden span of its own. It stays in the message,
// so a panel drawn later still finds it (markerNodes walks into it; placeAtMarker shows it again first).
export const MARKER_HIDDEN = 'rpg-battle-marker';
export const isHiddenMarker = node => node?.nodeType === 1 && String(node.className ?? '').split(/\s+/).includes(MARKER_HIDDEN);
const onlyMarker = node => textOf(node).split(/\r?\n/).every(line => !line.trim() || MARKER_LINE.test(line));

/** Hides every marker line under `root` (see above). */
export function hideMarkers(doc, root) {
    for (const node of markerNodes(root)) {
        const parent = node.parentNode;
        if (!parent || isHiddenMarker(parent)) continue;
        if (parent !== root && parent.tagName === 'P' && nodesOf(parent).every(child => child === node || blank(child)) && onlyMarker(node)) {
            parent.hidden = true;
            parent.classList?.add?.(MARKER_HIDDEN) ?? (parent.className = `${parent.className ?? ''} ${MARKER_HIDDEN}`.trim());
            continue;
        }
        const lines = textOf(node).split(/\r?\n/);
        // (A line break drawn right after a marker that stood alone in its text goes into the hidden span with it, so no empty line is left.)
        const next = lines.length === 1 && node.nextSibling?.tagName === 'BR' ? node.nextSibling : null;
        lines.forEach((line, i) => {
            if (MARKER_LINE.test(line)) {
                const span = doc.createElement('span');
                span.className = MARKER_HIDDEN;
                span.hidden = true;
                span.appendChild(doc.createTextNode(line));
                if (next) span.appendChild(next);
                parent.insertBefore(span, node);
            } else if (line) parent.insertBefore(doc.createTextNode(line), node);
            if (i < lines.length - 1) parent.insertBefore(doc.createTextNode('\n'), node);
        });
        node.remove();
    }
}


// Shows again the marker lines hideMarkers hid under `root`.
export function showMarkers(doc, root) {
    const hidden = [];
    const walk = node => { for (const child of nodesOf(node)) if (child.nodeType === 1) { if (isHiddenMarker(child)) hidden.push(child); else walk(child); } };
    walk(root);
    for (const node of hidden) {
        if (node.tagName === 'SPAN') {
            for (const child of nodesOf(node)) node.parentNode?.insertBefore(child, node);
            node.remove();
        } else {
            node.hidden = false;
            node.classList?.remove?.(MARKER_HIDDEN) ?? (node.className = String(node.className ?? '').split(/\s+/).filter(name => name && name !== MARKER_HIDDEN).join(' '));
        }
    }
}
