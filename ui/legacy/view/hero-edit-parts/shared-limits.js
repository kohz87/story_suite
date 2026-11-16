// Hero editor: the shared limits and the one-line text cutter.

import { cutAt } from '../../../../core/text.js';

export const short = (value, max) => cutAt(String(value ?? '').replace(/\s+/g, ' ').trim(), max);

export const CLOCK_KEYS = Object.freeze(['year', 'month', 'day', 'time']);
export const HERE_MAX = 12;
export const NAME_MAX = 80;
