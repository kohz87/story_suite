// Gear form: cuts a typed value to one tidy line of at most `max` characters.

import { cutAt } from '../../../text.js';

export const short = (value, max) => cutAt(String(value ?? '').replace(/\s+/g, ' ').trim(), max);
