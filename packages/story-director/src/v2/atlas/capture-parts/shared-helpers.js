// Shared string coercion and context query helpers for atlas capture.

export const asText = value => (typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value));
export const queryOf = ctx => (typeof ctx?.query === 'function' ? (name, args) => ctx.query(name, args) : null);
