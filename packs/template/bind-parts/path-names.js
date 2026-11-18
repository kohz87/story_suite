// Path names: the forbidden keys, the identifier pattern, the reserved scope names and the pointer symbol.

export const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);
export const IDENT = /^[A-Za-z_$][\w$]*$/;
/** Names a loop may not take: they are the scope's own roots and helpers. */
export const RESERVED = new Set(['state', 'q', 'draft', 'settings', 'query', 'ratio', 'pct', 'changed', 'len', 'contains', 'sum', 'fmt', 'true', 'false', 'null']);
export const POINTERS = Symbol('ss.pointers');
