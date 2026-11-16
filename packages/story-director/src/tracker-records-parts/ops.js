// Op inspection, finding construction, and untracked-op normalization.

import { kindOf, lineKey } from '../changes.js';

// A `~` on a key that is not tracked, with something to say, becomes a record of this kind.
const UNTRACKED_KIND = 'hook';

export function finding(kind, severity, op, message, extra = {}) {
    return { kind, severity, key: op.key ?? null, message, ...extra };
}

// Whether an op has anything to write: a field, or a part, with a value.
export function hasContent(op) {
    return [...Object.values(op.fields ?? {}), ...Object.values(op.extra ?? {})].some(value => String(value ?? '').trim());
}

// The record a `~` on a key that is not tracked becomes: a hook, unless its `type:` names a
// kind (`type: clock`; a quest category such as `type: bounty` makes a quest of that type).
export function untrackedRecordOp(op, id) {
    const word = lineKey(op.fields?.type ?? '');
    const named = kindOf(word);
    const fields = { ...op.fields };
    // The type was the kind; only a quest's own category (bounty, contract…) stays its type.
    if (named && (named !== 'quest' || word === 'quest' || word === 'quests')) delete fields.type;
    // A job by its parts (0.9.4): who it is for or what it pays.
    const job = !named && ['giver', 'reward'].some(name => String(fields[name] ?? '').trim());
    return { ...op, id, kind: named || (job ? 'quest' : UNTRACKED_KIND), fields };
}

export function withArticle(word) {
    return `${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word}`;
}
