/* NPC State Delta dossier surface: section reconciliation, cast counts and element visibility for the panel. */

// Cache only rendered section markup on its DOM node, never canonical state/history.
// Unchanged sections retain their nodes, selection, focus and open disclosure controls.
function reconcileDocumentSections(parent, markup, reset = false) {
    const template = document.createElement('template');
    template.innerHTML = markup;
    const children = [...template.content.children];
    children.forEach((candidate, index) => {
        const previous = parent.children[index];
        const signature = candidate.outerHTML;
        if (!reset && previous?.__deltaSectionMarkup === signature) return;
        candidate.__deltaSectionMarkup = signature;
        if (!reset && previous) {
            for (const detail of previous.querySelectorAll('details[data-delta-key]')) {
                const next = candidate.querySelector(`details[data-delta-key="${CSS.escape(detail.dataset.deltaKey)}"]`);
                if (next) next.open = detail.open;
            }
        }
        if (previous) previous.replaceWith(candidate);
        else parent.appendChild(candidate);
    });
    while (parent.children.length > children.length) parent.lastElementChild.remove();
}

function countsFor(rows) {
    const counts = { all: 0, active: 0, archived: 0 };
    for (const row of Array.isArray(rows) ? rows : []) {
        if (row?.bucket === 'dead') continue;
        counts.all += 1;
        if (counts[row?.bucket] !== undefined) counts[row.bucket] += 1;
    }
    return counts;
}

function visibleElement(element) {
    return Boolean(element && element.isConnected && element.getClientRects?.().length);
}

export { reconcileDocumentSections, countsFor, visibleElement };
