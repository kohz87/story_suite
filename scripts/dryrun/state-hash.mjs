// Stable hashing of host state, so two runs (old code, new code) compare by bytes. Key order and undefined never matter.
import { createHash } from 'node:crypto';

export function stableStringify(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) return 'null';
    return JSON.stringify(value);
  }
  if (typeof value.toJSON === 'function') {
    return stableStringify(value.toJSON());
  }
  if (Array.isArray(value)) {
    const items = value.map(item =>
      item === undefined || typeof item === 'function' || typeof item === 'symbol'
        ? 'null'
        : stableStringify(item),
    );
    return `[${items.join(',')}]`;
  }
  const keys = Object.keys(value)
    .filter(k => value[k] !== undefined && typeof value[k] !== 'function' && typeof value[k] !== 'symbol')
    .sort();
  const entries = keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
  return `{${entries.join(',')}}`;
}

export function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function toJson(value) {
  return value === undefined ? null : JSON.parse(stableStringify(value));
}
