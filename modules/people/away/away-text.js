// The away part's text helpers: a name's key, one plain line, a cut at a code point, the line as the story wrote it.

import { lineKey } from '../../world/changes.js';

/** The identity of a name (`lineKey`): lower case, punctuation squashed. '' for a name with no letters or digits. */
export const keyOf = name => lineKey(String(name ?? ''));

/** `value` as one plain line (control and format characters out, spaces made one), cut to `max` code points with an ellipsis when it was longer. */
export function cutPoints(value, max) {
    const flat = (typeof value === 'string' || typeof value === 'number' ? String(value) : '').replace(/[\p{Cc}\p{Cf}]+/gu, ' ').replace(/\s+/g, ' ').trim();
    const chars = Array.from(flat);
    return chars.length <= max ? chars.join('') : `${chars.slice(0, Math.max(0, max - 1)).join('').trimEnd()}…`;
}

/** The line as the story wrote it, for messages. */
export function lineText(line) {
    const labels = Object.entries(line?.labels ?? {}).map(([label, value]) => ` | ${label}: ${value}`).join('');
    return `${line?.op ?? ''} ${line?.kind ?? ''} ${line?.name ?? ''}${line?.text ? ` — ${line.text}` : ''}${labels}`.trim();
}

/** The JSON pointer of one absence record (`/away/aw_x`) inside the domain. */
export const recordPath = (table, id) => `/${table}/${String(id).replace(/~/g, '~0').replace(/\//g, '~1')}`;
