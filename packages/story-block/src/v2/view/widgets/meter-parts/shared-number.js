// Shared by the meter parts: reads a prop as a number, or null when it is not one.

import { num } from '../dom.js';

// A number given as a prop, or null when it is not one (null, '', a word): the mark is left out.
export const numberOr = value => (value === null || value === undefined || value === '' ? null : num(value, null));
