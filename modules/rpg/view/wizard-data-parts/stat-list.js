// The stats a draft is made of: Combat Rules v1's seven (WIS, no LUK), or the earlier rules' seven for the one draft that rebuilds a join in a chat made under them.

import { STATS_EARLIER, STATS_V1 } from '../../names.js';

/** The stat keys of `draft` (a draft that says `standard: true` is the earlier rules'; every other draft is v1's). */
export const statsOf = draft => (draft?.standard === true ? STATS_EARLIER : STATS_V1);
