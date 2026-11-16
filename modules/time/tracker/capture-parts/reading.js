// Story Director v2, tracker part: reads a story line as a v1 op, leaving out the labels the Director does not keep.

import { lineKey, parseChanges } from '../../../changes.js';
import { bareName, capKey, lineText } from './text.js';
import { clip } from './shared-clip.js';

// Labels Story Block's generic state rules reserve (ops.js checkOps: `qty` is a count, `id` and
// `…_id` are IDs, three keys no state may hold): kept under such a name in `fields`, they would get
// the whole line refused. They mean nothing to the Director, so they are left out with a Problem.
const RESERVED_LABEL = /^(?:qty|id|.+_id|.+Id|__proto__|constructor|prototype)$/;
const IGNORED_LABELS = new Set(['xp', 'exp', 'experience', 'target', 'met', 'ready']);

/**
 * The line without the labels the Director does not keep (RESERVED_LABEL, IGNORED_LABELS):
 * `{ line, dropped: [label] }`.
 */
export function withoutDroppedLabels(line) {
    const labels = line?.labels;
    if (!labels || typeof labels !== 'object') return { line, dropped: [] };
    const kept = {};
    const dropped = [];
    for (const [label, value] of Object.entries(labels)) {
        const name = String(label).trim();
        if (RESERVED_LABEL.test(name) || RESERVED_LABEL.test(name.toLowerCase()) || IGNORED_LABELS.has(name.toLowerCase())) dropped.push(name);
        else kept[label] = value;
    }
    return dropped.length ? { line: { ...line, labels: kept }, dropped } : { line, dropped };
}

export function droppedProblem(line, dropped) {
    const xp = dropped.filter(label => IGNORED_LABELS.has(label.toLowerCase()));
    const other = dropped.filter(label => !IGNORED_LABELS.has(label.toLowerCase()));
    const said = [
        xp.length ? `${xp.map(label => `"${label}:"`).join(', ')} is ignored: the story describes any experience or rewards` : '',
        other.length ? `${other.map(label => `"${label}:"`).join(', ')} ${other.length === 1 ? 'is a name' : 'are names'} the Director does not keep` : '',
    ].filter(Boolean).join('; ');
    return { kind: 'label', severity: 'info', key: capKey(bareName(line?.name)), op: line?.op, text: `${said}; the rest of the line is used.` };
}

/**
 * The v1 op a v2 line is: `{ op }`, or `{ error }`. The text and labels go through v1's own
 * parser (a stand-in key keeps the name out of it), so `— step: done`, `| reason: …`, a
 * difficulty word and the rest read exactly as v1 reads them.
 */
export function toV1Op(line) {
    const op = line?.op;
    if (!['+', '-', '~', '!'].includes(op)) return { error: `"${lineText(line)}" asks code to decide something; Director lines use + ~ - or !.` };
    const written = bareName(line?.name);
    const key = capKey(written);
    const id = lineKey(key);
    if (!id) return { error: `"${lineText(line)}" names nothing.` };
    const labels = Object.entries(line?.labels ?? {})
        .map(([label, value]) => ` | ${String(label).trim().toLowerCase()}:${String(value ?? '').trim() ? ` ${String(value).trim()}` : ''}`)
        .join('');
    const text = String(line?.text ?? '').trim();
    const stand = `${op}${op === '+' ? ` ${line.kind}` : ''} x${text ? ` — ${text}` : ''}${labels}`;
    const parsed = parseChanges(stand).ops[0];
    if (!parsed) return { error: `"${lineText(line)}" could not be read.` };
    for (const key of ['target', 'rank', 'met', 'ready', 'xp', 'exp', 'experience']) {
        delete parsed.fields?.[key];
        delete parsed.extra?.[key];
    }
    return {
        op: {
            ...parsed,
            kind: op === '+' ? line.kind : null,
            // The kind a `- quest` / `~ quest` line wrote: it settles a near match between a quest and, say, its old hook.
            ...(op !== '+' && line.kind === 'quest' ? { lineKind: 'quest' } : {}),
            key,
            id,
            raw: clip(String(line?.raw ?? '').trim()) || lineText(line),
        },
        ...(key !== written ? { cut: written.length } : {}),
    };
}
