// Shared text helpers of the glass widgets: pick an allowed value, cut a label to one short line.

import { str } from '../dom.js';
import { cutAt } from '../../../../../core/text.js';

export const LABEL_MAX = 60;

export const pick = (list, value, fallback) => (list.includes(value) ? value : fallback);
export const short = (value, max) => cutAt(str(value).replace(/\s+/g, ' ').trim(), max);
