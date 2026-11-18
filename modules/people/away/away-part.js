// Story Director's **away** part (AWAYFOLLOW, owner 18 Nov): people away from the scene, on the Follow star. Anyone the narrator marks away
// is kept (followed or not); the lines and the paragraph are taught while someone is followed or away (env `away`, module/create.js).
// Kinds: `away` (away-line.js) and the retired `key` (`- key Name | died`, read and dropped quietly). Domain `away` (away-domain.js);
// tail `[Elsewhere]` (away-prompt.js); queries `director.away` and `director.away.view` (away-queries.js). No setting, no switch.

import { initialAway, validateAway } from './away-domain.js';
import { applyAwayLine, dropKeyLine } from './away-line.js';
import { TEXT, awayTail } from './away-prompt.js';
import { awayQuery, awayView } from './away-queries.js';
import { calendarFrom } from '../../world/world/known.js';

/** `context.tail(view)` → `{ lines, optional }`. */
function tail(view) {
    const minutes = view?.state?.domains?.director?.time?.minutes;
    const calendar = calendarFrom(typeof view?.query === 'function' ? (name, args) => view.query(name, args) : null);
    return { lines: awayTail(view?.state?.domains?.away, { now: Number.isSafeInteger(minutes) ? minutes : null, calendar }).lines, optional: [] };
}

export const part = {
    domains: { away: { initial: initialAway, validate: validateAway } },
    queries: { 'director.away': awayQuery, 'director.away.view': awayView },
    kinds: {
        away: { grammar: env => (env?.away ? TEXT.grammar : ''), apply: applyAwayLine },
        key: { grammar: () => '', heads: ['- key'], apply: dropKeyLine },
    },
    context: { static: env => (env?.away ? TEXT.static : ''), tail, budget: 300 },
};
