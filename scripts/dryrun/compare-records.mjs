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

// A failed step (Re-read, prompt build, state) is an error, never evidence of equality, even when both sides failed alike.
function errorDifferences(record, side) {
  if (!record || typeof record !== 'object') return [];
  if (!Array.isArray(record.errors)) {
    return [{ reply: null, field: `${side}.errors`, before: 'no error list in the recording', after: 'record it again' }];
  }
  const found = record.errors.map(item => ({
    reply: item?.reply ?? null,
    field: `${side} ERROR ${item?.step ?? '?'}`,
    before: cut(item?.detail ?? ''),
    after: 'a failed step is not a pass',
  }));
  for (const reply of Array.isArray(record.replies) ? record.replies : []) {
    if (reply?.reread?.ok !== true && !record.errors.some(item => item?.step === 'reread' && item?.reply === reply.index)) {
      found.push({ reply: reply.index, field: `${side} ERROR reread`, before: 'no successful Re-read recorded', after: 'a failed step is not a pass' });
    }
  }
  return found;
}

/**
 * Compares two chat recordings, returning `{ equal, differences }` capped at 20 entries. A recording with any
 * error (a failed Re-read, an empty static prompt) is never equal, even to an identical recording.
 */
export function compareRecords(a, b) {
  const differences = [...errorDifferences(a, 'old'), ...errorDifferences(b, 'new')];
  const hadErrors = differences.length > 0;
  differences.splice(MAX_DIFFERENCES);
  if (hadErrors) {
    const rest = [];
    compareBody(a, b, rest);
    for (const item of rest) if (differences.length < MAX_DIFFERENCES) differences.push(item);
    return { equal: false, differences };
  }
  compareBody(a, b, differences);
  return { equal: differences.length === 0, differences };
}

function compareBody(a, b, differences) {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
    diffValues(a, b, null, '', differences);
    return;
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
}
