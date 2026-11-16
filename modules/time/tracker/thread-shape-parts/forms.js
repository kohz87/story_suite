// The text, closed-object and hash checks.

import { map } from './scalars.js';

export const text = (value, max, nonempty = false) => typeof value === 'string' && [...value].length <= max
    && (!nonempty || value.trim().length > 0) && !/[\p{Cc}<>]/u.test(value);
export const closed = (value, required, optional = []) => map(value) && required.every(key => Object.hasOwn(value, key))
    && Object.keys(value).every(key => [...required, ...optional].includes(key));
export const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
