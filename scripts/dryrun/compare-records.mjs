const MAX_DIFFERENCES = 20;
const MAX_VALUE_CHARS = 200;

function cut(value) {
  if (value === undefined) return 'undefined';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (str.length <= MAX_VALUE_CHARS) return str;
  return `${str.slice(0, MAX_VALUE_CHARS - 3)}...`;
}

function diffValues(a, b, reply, field, out) {
  if (out.length >= MAX_DIFFERENCES) return;
  if (Object.is(a, b)) return;

  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    out.push({ reply, field, before: cut(a), after: cut(b) });
    return;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) {
      out.push({ reply, field, before: cut(a), after: cut(b) });
      return;
    }
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len && out.length < MAX_DIFFERENCES; i++) {
      const nextField = field ? `${field}[${i}]` : `[${i}]`;
      if (i >= a.length) {
        out.push({ reply, field: nextField, before: 'undefined', after: cut(b[i]) });
      } else if (i >= b.length) {
        out.push({ reply, field: nextField, before: cut(a[i]), after: 'undefined' });
      } else {
        diffValues(a[i], b[i], reply, nextField, out);
      }
    }
    return;
  }

  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of [...keys].sort()) {
    if (out.length >= MAX_DIFFERENCES) break;
    const nextField = field ? `${field}.${key}` : key;
    if (!(key in a)) {
      out.push({ reply, field: nextField, before: 'undefined', after: cut(b[key]) });
    } else if (!(key in b)) {
      out.push({ reply, field: nextField, before: cut(a[key]), after: 'undefined' });
    } else {
      diffValues(a[key], b[key], reply, nextField, out);
    }
  }
}

/**
 * Compares two chat recordings, returning `{ equal, differences }` capped at 20 entries.
 */
export function compareRecords(a, b) {
  const differences = [];
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
    diffValues(a, b, null, '', differences);
    return { equal: differences.length === 0, differences };
  }

  const topKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  topKeys.delete('replies');
  for (const key of [...topKeys].sort()) {
    if (differences.length >= MAX_DIFFERENCES) break;
    diffValues(a[key], b[key], null, key, differences);
  }

  const mapA = new Map((Array.isArray(a.replies) ? a.replies : []).map(r => [r.index, r]));
  const mapB = new Map((Array.isArray(b.replies) ? b.replies : []).map(r => [r.index, r]));
  const indices = [...new Set([...mapA.keys(), ...mapB.keys()])].sort((x, y) => x - y);

  for (const index of indices) {
    if (differences.length >= MAX_DIFFERENCES) break;
    if (!mapA.has(index)) {
      differences.push({ reply: index, field: '(reply)', before: 'missing', after: cut(mapB.get(index)) });
    } else if (!mapB.has(index)) {
      differences.push({ reply: index, field: '(reply)', before: cut(mapA.get(index)), after: 'missing' });
    } else {
      diffValues(mapA.get(index), mapB.get(index), index, '', differences);
    }
  }

  return { equal: differences.length === 0, differences };
}
