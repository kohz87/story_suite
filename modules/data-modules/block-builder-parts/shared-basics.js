// Shared form-building helpers: the problem result, the key slugger and the number reader.
import { slugify } from '../../../packs/validate/core.js';

export const problem = (path, message) => ({ ok: false, errors: [{ code: 'DM_SCHEMA', path, message }] });
export const keyFor = (name, max = 40) => slugify(name).slice(0, max).replace(/-+$/, '');
export const number = value => typeof value === 'number' ? value
    : typeof value === 'string' && value.trim() ? Number(value) : NaN;
