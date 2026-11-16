// Takes a panel out of a message and puts a panel where the first marker line stood.

import { MARKER_LINE } from '../constants.js';
import { nodesOf, blank, textOf } from './shared-nodes.js';
import { markerNodes } from './find.js';
import { showMarkers } from './hide.js';

// The marker text a panel took out of the story (placeAtMarker), kept on the panel itself.
export const CONSUMED = Symbol('consumed marker');

/**
 * Takes a panel out of the message. An inline panel that stood in the place of a marker line leaves that line behind, so the place
 * is kept for the next time (switching the RPG off and on again draws the panel where the narrator wrote it).
 */
export function releasePanel(doc, panel) {
    const marker = panel?.[CONSUMED];
    const parent = panel?.parentNode;
    if (marker && parent) {
        const line = doc.createElement('p');
        line.textContent = marker;
        parent.insertBefore(line, panel);
    }
    panel?.remove?.();
}


/**
 * Takes the first marker line out of its paragraph and puts `panel` there: a paragraph that held other lines is split
 * in two around the panel, one that held only the marker is replaced. Returns true when a marker was found. Any other
 * marker line is taken out of the text.
 */
export function placeAtMarker(doc, root, panel) {
    showMarkers(doc, root);
    const found = markerNodes(root);
    if (!found.length) return false;
    const [first, ...extra] = found;
    for (const node of extra) node.data = textOf(node).split(/\r?\n/).filter(line => !MARKER_LINE.test(line)).join('\n');
    const lines = textOf(first).split(/\r?\n/), at = lines.findIndex(line => MARKER_LINE.test(line));
    // The marker line is kept on the panel, so taking the panel away can put it back (releasePanel).
    panel[CONSUMED] = lines[at].trim();
    const parent = first.parentNode, siblings = nodesOf(parent), spot = siblings.indexOf(first);
    const before = siblings.slice(0, spot), after = siblings.slice(spot + 1);
    const tail = lines.slice(at + 1).join('\n'), tailNode = tail.trim() ? doc.createTextNode(tail) : null;
    first.data = lines.slice(0, at).join('\n');
    if (blank(first)) first.remove(); else before.push(first);
    // A line break right next to the marker belongs to it.
    while (before.length && blank(before.at(-1))) { const node = before.pop(); if (node !== first) node.remove(); }
    while (after.length && blank(after[0])) after.shift().remove();
    if (tailNode) after.unshift(tailNode);
    const hasBefore = before.some(node => !blank(node)), hasAfter = after.some(node => !blank(node));
    if (parent.tagName === 'P' && parent.parentNode) {
        const container = parent.parentNode, next = nodesOf(container)[nodesOf(container).indexOf(parent) + 1] ?? null;
        container.insertBefore(panel, next);
        if (hasAfter) {
            const rest = doc.createElement('p');
            for (const node of after) rest.appendChild(node);
            container.insertBefore(rest, nodesOf(container)[nodesOf(container).indexOf(panel) + 1] ?? null);
        }
        if (!hasBefore) parent.remove();
        return true;
    }
    const reference = after.find(node => node.parentNode === parent) ?? null;
    if (tailNode && tailNode.parentNode !== parent) parent.insertBefore(tailNode, reference);
    parent.insertBefore(panel, tailNode && tailNode.parentNode === parent ? tailNode : reference);
    return true;
}
