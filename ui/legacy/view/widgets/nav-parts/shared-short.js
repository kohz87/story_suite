// Shared by the nav parts: one line of text cut at a limit.

import { str } from '../dom.js';
import { cutAt } from '../../../../../core/text.js';

export const short = (value, max) => cutAt(str(value).replace(/\s+/g, ' ').trim(), max);
