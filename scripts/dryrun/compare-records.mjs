import { historyErrors } from './compare-history.mjs';

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
// A deliberate Re-read refusal (the reply came back as a refusal with a code and a message, nothing thrown) that both sides gave alike.
function refusalOf(record, index) {
  const reply = Array.isArray(record?.replies) ? record.replies.find(r => r?.index === index) : null;
  const read = reply?.reread;
  const result = read?.result;
  if (!read || read.ok !== false || read.code === 'THREW' || !result || typeof result !== 'object') return null;
  if (typeof result.code !== 'string' || typeof result.message !== 'string' || result.code !== read.code) return null;
  return { code: result.code, message: result.message };
}

function expectedRefusals(a, b) {
  const found = [];
  for (const reply of Array.isArray(a?.replies) ? a.replies : []) {
    const left = refusalOf(a, reply?.index);
    const right = left ? refusalOf(b, reply.index) : null;
    if (left && right && left.code === right.code && left.message === right.message) found.push({ reply: reply.index, code: left.code });
  }
  return found;
}

function errorDifferences(record, side, expected = new Set()) {
  if (!record || typeof record !== 'object') return [];
  if (!Array.isArray(record.errors)) {
    return [{ reply: null, field: `${side}.errors`, before: 'no error list in the recording', after: 'record it again' }];
  }
  const isExpected = item => item?.step === 'reread' && expected.has(item?.reply);
  const found = record.errors.filter(item => !isExpected(item)).map(item => ({
    reply: item?.reply ?? null,
    field: `${side} ERROR ${item?.step ?? '?'}`,
    before: cut(item?.detail ?? ''),
    after: 'a failed step is not a pass',
  }));
  for (const reply of Array.isArray(record.replies) ? record.replies : []) {
    if (reply?.reread?.ok !== true && !expected.has(reply?.index) && !record.errors.some(item => item?.step === 'reread' && item?.reply === reply.index)) {
      found.push({ reply: reply.index, field: `${side} ERROR reread`, before: 'no successful Re-read recorded', after: 'a failed step is not a pass' });
    }
  }
  return found;
}

/**
 * Compares two chat recordings, returning `{ equal, differences }` capped at 20 entries. A recording with any
 * error (a thrown Re-read, a one-sided refusal, an empty static prompt, a held-back prompt) is never equal, even to an identical
 * recording. A Re-read refusal with the same code and message on both sides is on purpose: it counts as agreement and is listed in
 * `expectedRefusals` (reply and code only) when there is any.
 */
export function compareRecords(a, b) {
  const refusals = expectedRefusals(a, b);
  const expected = new Set(refusals.map(r => r.reply));
  const differences = [...errorDifferences(a, 'old', expected), ...errorDifferences(b, 'new', expected), ...historyErrors(a, 'old'), ...historyErrors(b, 'new')];
  const hadErrors = differences.length > 0;
  differences.splice(MAX_DIFFERENCES);
  if (hadErrors) {
    const rest = [];
    compareBody(a, b, rest);
    for (const item of rest) if (differences.length < MAX_DIFFERENCES) differences.push(item);
    return withRefusals({ equal: false, differences }, refusals);
  }
  compareBody(a, b, differences);
  return withRefusals({ equal: differences.length === 0, differences }, refusals);
}

function withRefusals(result, refusals) {
  return refusals.length ? { ...result, expectedRefusals: refusals } : result;
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
