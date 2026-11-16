// Shared helper of the hero card parts: a value as one short plain line.

import { str } from '../dom.js';
import { cutAt } from '../../../../../core/text.js';

export const short = (value, max) => cutAt(str(value).replace(/\s+/g, ' ').trim(), max);
