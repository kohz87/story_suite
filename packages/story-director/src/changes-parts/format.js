// Story Director: formatting a structured op back into a change line.
import { FIELDS } from './fields.js';
import { inferKind } from './identity.js';
import { splitLabel } from './shared-label.js';

function labelledPart(name, value) {
    return value ? `${name}: ${value}` : `${name}:`;
}

// Unlabeled leading text that would read back as `label: value` gets its label written out,
// so the round trip cannot reclassify it.
function leadPart(name, value) {
    return splitLabel(value) ? labelledPart(name, value) : value;
}

/** One change line for an op; `parseChanges(formatOp(op))` gives the same op back. */
export function formatOp(op) {
    const fields = op.fields ?? {};
    const extra = op.extra ?? {};
    const closing = op.op === '-' || op.op === '!';
    const parts = [];

    if (closing) {
        if (op.reason) parts.push(leadPart('reason', op.reason));
    } else if (Object.hasOwn(fields, 'desc')) {
        parts.push(fields.desc ? leadPart('desc', fields.desc) : 'desc:');
    }
    for (const name of FIELDS) {
        if (name === 'desc' && !closing) continue;
        if (Object.hasOwn(fields, name)) parts.push(labelledPart(name, fields[name]));
    }
    for (const [label, value] of Object.entries(extra)) parts.push(labelledPart(label, value));

    // A `+` always names its kind: inference could differ, and a key starting with an alias
    // word (`World Bank`) would otherwise lose that word to the kind.
    const kind = op.op === '+' ? ` ${op.kind || inferKind(fields)}` : '';
    const head = `${op.op}${kind} ${op.key}`;
    if (parts.length) return `${head} — ${parts.join(' | ')}`;
    // A bare dash keeps a key containing `: ` from being split at the colon.
    return /:(?:\s|$)/.test(op.key) ? `${head} —` : head;
}
