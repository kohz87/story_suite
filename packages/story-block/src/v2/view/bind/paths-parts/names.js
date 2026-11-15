// The reserved binding names: identifier pattern, names a loop may not take, and the private pointers symbol.

export const IDENT = /^[A-Za-z_$][\w$]*$/;
/** Names a loop may not take: they are the scope's own roots and helpers. */
export const RESERVED = new Set(['state', 'q', 'draft', 'settings', 'query', 'ratio', 'pct', 'changed', 'len', 'contains', 'sum', 'fmt', 'true', 'false', 'null']);
export const POINTERS = Symbol('ss.pointers');
