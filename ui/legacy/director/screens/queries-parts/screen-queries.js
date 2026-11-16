// Story Director v2, part screens: the part's view queries, as the table the module registers.

import { THREADS_FEATURE } from '../../../../../modules/time/tracker/threads.js';
import { behindView } from './behind-view.js';
import { currentGoal, questBoard } from './goal.js';
import { nextDue } from './next-due.js';
import { planView } from './plan.js';
import { problemsList } from './problems.js';
import { statusExtras } from './status.js';

export function screenQueries({ settings = null } = {}) {
    return {
        // The agendas, clocks, beats and secrets: the feature `story-director.threads`' (answers null while it is off, so the screen draws none).
        'director.behind': Object.assign((state, args, tools) => behindView(state, args, tools), { feature: THREADS_FEATURE }),
        // `{ on: true }` while the feature is on, null while it is off: the Director screen's World card and the World screen's News and Factions read it.
        // The Director screen's cards (planView).
        'director.plan': (state, args, tools) => planView(state, args, tools, { settings }),
        'director.threads.on': Object.assign(() => ({ on: true }), { feature: THREADS_FEATURE }),
        'director.goal': (state, args, tools) => currentGoal(state, args, tools),
        'quest.board': (state, args, tools) => questBoard(state, args, tools),
        'director.next': (state, args, tools) => nextDue(state, args, tools, { settings }),
        'director.problems': (state, args, tools) => problemsList(state, args, tools),
        'director.status': (state, args, tools) => statusExtras(state, args, tools, { settings }),
    };
}
