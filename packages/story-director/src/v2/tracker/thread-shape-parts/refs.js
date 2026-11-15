// The checks for a thread source and a thread cursor.

import { count, recordId } from './scalars.js';
import { closed } from './forms.js';

export const source = value => closed(value, ['sid', 'swipeKey', 'evidence', 'ordinal'])
    && ['sid', 'swipeKey', 'evidence'].every(key => recordId(value[key])) && count(value.ordinal) && value.ordinal <= 1000000;
export const cursor = value => closed(value, ['sid', 'swipeKey', 'block', 'op', 'rev'])
    && ['sid', 'swipeKey', 'block'].every(key => recordId(value[key])) && count(value.op) && count(value.rev);
