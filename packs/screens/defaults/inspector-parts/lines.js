// Builds one row of the Inspector's change list: a state difference or a stored op.

import { preview } from '../../inspect.js';
import { el } from './shared-dom.js';

export const MARKS = { add: '+', remove: '−', change: '~' };

// A row of the look's list card: the mark in a tile, the path (raw, so monospace) and the values.
export function diffLine(doc, entry) {
    const row = el(doc, 'li', `ss-listcard-row sb-insp-${entry.kind}`);
    row.setAttribute('data-path', entry.path);
    const item = el(doc, 'div', 'ss-listcard-item');
    const mark = el(doc, 'span', 'ss-listcard-icon sb-insp-mark', MARKS[entry.kind] ?? '?');
    mark.setAttribute('aria-label', entry.kind);
    const text = entry.kind === 'add' ? preview(entry.after) : entry.kind === 'remove' ? `(was ${preview(entry.before)})` : `${preview(entry.before)} → ${preview(entry.after)}`;
    const main = el(doc, 'span', 'ss-listcard-main');
    main.append(el(doc, 'span', 'ss-listcard-title sb-insp-path', entry.path || '/'), el(doc, 'span', 'ss-listcard-sub', text));
    item.append(mark, main);
    row.appendChild(item);
    return row;
}

export function opLine(doc, op) {
    const row = el(doc, 'li', `ss-listcard-row sb-insp-${op?.op === 'add' ? 'add' : op?.op === 'remove' ? 'remove' : 'change'}`);
    const parts = [op?.op ?? '?', String(op?.path ?? '')];
    if (op && 'value' in op) parts.push(`= ${preview(op.value)}`);
    if (op && 'was' in op) parts.push(`(was ${preview(op.was)}${op.count ? ` at ${op.count}` : ''})`);
    const item = el(doc, 'div', 'ss-listcard-item');
    const main = el(doc, 'span', 'ss-listcard-main');
    main.appendChild(el(doc, 'span', 'ss-listcard-title', parts.join(' ')));
    item.append(el(doc, 'span', 'ss-listcard-icon sb-insp-mark', MARKS[op?.op === 'replace' ? 'change' : op?.op] ?? '?'), main);
    row.appendChild(item);
    return row;
}
