// Small value helpers: a deep copy, a JSON byte size, and a safe read along a path.
import { dmOwn } from '../schema.js';

export const copy = value => structuredClone(value);
export const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
export const atPath = (value, path) => path.reduce((next, key) => dmOwn(next, key) ? next[key] : null, value);
