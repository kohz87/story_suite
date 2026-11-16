// The shared text trimmer of the tiers parts: a value as one tidy line cut to a length.

import { str } from '../dom.js';
import { cutAt } from '../../../../../../../core/text.js';

export const short = (value, max) => cutAt(str(value).replace(/\s+/g, ' ').trim(), max);
