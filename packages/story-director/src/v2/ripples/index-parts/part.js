// The ripples part definition: three read-only queries.

import { problemsQuery } from './reads.js';
import { swayQuery, leaderQuery } from './queries.js';

/** The part: three read-only queries (sway, leader, the table's problems), no state, no prompt text, no feature (a reader's switch must not change a pack's branch). */
export const part = {
    domains: {},
    commands: {},
    queries: { 'ripples.sway': swayQuery, 'ripples.leader': leaderQuery, 'ripples.problems': problemsQuery },
    kinds: {},
    hooks: {},
    tabs: [],
    widgets: {},
};
