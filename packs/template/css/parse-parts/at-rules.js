// Name sets for the scoper: root aliases, group at-rules, dropped at-rules, and the at-rule name reader.

export const SCOPE_ALIASES = /^(?::root|html|body|:host|:scope)(?![\w-])/i;
export const GROUPS = new Set(['media', 'supports', 'container', 'layer', 'document']);
export const DROPPED = new Set(['import', 'charset', 'namespace', 'page']);

export function atName(prelude) {
    return (/^@(-webkit-|-moz-)?([\w-]+)/.exec(prelude)?.[2] ?? '').toLowerCase();
}
