// Builds a People row of named numbers or a shown-only row, and holds the whole-number clamp the old panel's boxes use.

export const clamp = (min, max, fallback) => v => Math.max(min, Math.min(max, Math.round(Number(v) || fallback)));
const lower = label => String(label).toLowerCase();

/** The shared row shape: `people.<key>`, no hint, unit, tags or options unless `rest` gives them. */
export const row = (group, key, type, label, rest) => ({ group, key: `people.${key}`, type, label, hint: null, unit: null, tags: [], wide: false, options: null, ...rest });

/** A row of named numbers (`names`) stored as one object under `store` with lower-case keys; `clean(object)` is the old panel's normalizer, `blank` what an empty box means. */
export const multiRow = (group, key, label, store, names, { hint = null, cut, clean, blank = 0, dflt }) => row(group, key, 'multi', label, {
  hint, wide: true, store, reset: [[store, dflt]],
  read: b => Object.fromEntries(names.map(n => [n, Object.hasOwn(b[store] ?? {}, lower(n)) ? b[store][lower(n)] : dflt[lower(n)] ?? null])),
  write: (v, b) => {
    const next = { ...(b[store] ?? {}) };
    for (const n of names) if (v && Object.hasOwn(v, n)) next[lower(n)] = v[n] === null || v[n] === '' ? blank : cut(v[n]);
    return [[store, clean(next)]];
  },
});

/** A row the page shows but cannot change yet: its value is read live, as text. */
export const shownRow = (group, key, label, value, { hint = null, tags = [] } = {}) => row(group, key, 'info', label, { hint, tags, read: typeof value === 'function' ? value : () => value, write: null });
