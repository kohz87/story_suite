// Story Suite v2: tidying a value to one short line of at most `max` characters.

import { str } from '../dom.js';
import { cutAt } from '../../../../../core/text.js';

export const short = (value, max) => cutAt(str(value).replace(/\s+/g, ' ').trim(), max);
