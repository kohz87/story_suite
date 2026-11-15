// The folded "Changed this turn" section and the small dot a changed thing carries.
import { el } from './elements.js';

const CHANGE_GLYPH = { added: '+', removed: '−', changed: '~', moved: '↪' };

function describeChange(change) {
    const label = String(change?.label ?? '').trim();
    const from = String(change?.from ?? '').trim();
    const to = String(change?.to ?? '').trim();
    if (change?.type === 'added') return to ? `${label}: ${to}` : `${label} (new)`;
    if (change?.type === 'removed') return `${label} (gone)`;
    return `${label}: ${from || '—'} → ${to || '—'}`;
}

/**
 * One folded "Changed this turn · N" section, the same in every display, so the board
 * itself stays calm: changed things carry only a small dot (changeDot), and the wording
 * of each change lives here. Collapsed by default; the reader opens it when they care.
 */
export function renderChanges(parent, changes, { describe = describeChange, fromEarlierReply = false } = {}) {
    const list = (Array.isArray(changes) ? changes : []).filter(Boolean);
    if (!list.length) return null;
    const details = el('details', 'story-block-changes');
    const summary = el('summary', 'story-block-changes-summary');
    summary.append(
        el('span', 'story-block-changes-title', fromEarlierReply ? 'Changed in an earlier reply' : 'Changed this turn'),
        el('span', 'story-block-changes-count', String(list.length)),
    );
    if (fromEarlierReply) summary.title = 'The newest reply did not update this block; these are the last changes it made.';
    const items = el('ul', 'story-block-changes-list');
    for (const change of list) {
        const item = el('li', `story-block-changes-item is-${change.type ?? 'changed'}`);
        const glyph = el('span', 'story-block-changes-glyph', CHANGE_GLYPH[change.type] ?? '~');
        glyph.setAttribute('aria-hidden', 'true');
        item.append(glyph, el('span', 'story-block-changes-text', describe(change)));
        items.appendChild(item);
    }
    details.append(summary, items);
    parent.appendChild(details);
    return details;
}

/** The small mark a changed field, row or person carries; the detail is in renderChanges. */
export function changeDot(change) {
    const dot = el('span', `story-block-change-dot is-${change?.type ?? 'changed'}`);
    dot.setAttribute('role', 'img');
    dot.setAttribute('aria-label', change?.type === 'added' ? 'new this turn' : 'changed this turn');
    dot.title = change?.type === 'added' ? 'New this turn' : 'Changed this turn';
    return dot;
}
